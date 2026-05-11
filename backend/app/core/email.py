"""Production-ready email service using aiosmtplib and Jinja2 templates."""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from urllib.parse import quote

import aiosmtplib
from jinja2 import Environment, FileSystemLoader

from app.core.config import settings

logger = logging.getLogger(__name__)

# Setup Jinja2 environment
TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "email"
jinja_env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))


async def send_email(
    subject: str,
    recipient: str,
    template_name: str,
    context: dict,
) -> None:
    """Send an HTML email using SendGrid API or SMTP."""
    if not settings.EMAIL_ENABLED:
        logger.warning(
            "EMAIL_ENABLED is false. Email to %s NOT sent. Subject: %s",
            recipient,
            subject,
        )
        if "reset_link" in context:
            raw_token = context["reset_link"].split("token=")[-1]
            token_preview = raw_token[:8] + "..." if len(raw_token) > 8 else "***"
            logger.info(
                "Mock password reset email generated for %s token_preview=%s",
                recipient,
                token_preview,
            )
        return

    template = jinja_env.get_template(template_name)
    html_content = template.render(context)

    # 1. Try SendGrid API first if key is present
    if settings.SENDGRID_API_KEY:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=settings.SMTP_FROM,
                to_emails=recipient,
                subject=subject,
                html_content=html_content,
            )
            sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
            # Use anyio.to_thread since sendgrid is synchronous
            import anyio

            response = await anyio.to_thread.run_sync(sg.send, message)
            logger.info(
                "Email sent via SendGrid API to %s status=%s message_id=%s",
                recipient,
                response.status_code,
                response.headers.get("X-Message-Id"),
            )
            return
        except ModuleNotFoundError:
            logger.error("SendGrid API key configured, but sendgrid is not installed")
        except Exception as e:
            logger.error("Failed to send email via SendGrid API to %s: %s", recipient, str(e))
            # Fallback to SMTP if SendGrid fails? For now just log and continue to SMTP

    # 2. Fallback to SMTP
    try:
        message = MIMEMultipart()
        message["From"] = settings.SMTP_FROM
        message["To"] = recipient
        message["Subject"] = subject
        message.attach(MIMEText(html_content, "html"))

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_PORT == 465,
            start_tls=settings.SMTP_PORT == 587,
        )
        logger.info("Email sent via SMTP to %s", recipient)
    except Exception as e:
        logger.error("Failed to send email via SMTP to %s: %s", recipient, str(e))


async def send_password_reset_email(email: str, token: str) -> None:
    """Send a password reset email with a secure token link."""
    reset_base = settings.PASSWORD_RESET_URL_BASE or settings.FRONTEND_URL
    if reset_base.startswith("immunoclinic://"):
        reset_base = settings.FRONTEND_URL
    reset_link = f"{reset_base.rstrip('/')}/reset-password?token={quote(token, safe='')}"

    await send_email(
        subject="Restablece tu contraseña - ImmunoClinic",
        recipient=email,
        template_name="reset_password.html",
        context={"reset_link": reset_link},
    )


async def send_account_created_email(
    email: str,
    *,
    full_name: str,
    temporary_password: str,
) -> None:
    """Send account creation instructions to a new student."""
    await send_email(
        subject="Tu cuenta de ImmunoClinic ha sido creada",
        recipient=email,
        template_name="account_created.html",
        context={
            "full_name": full_name,
            "email": email,
            "temporary_password": temporary_password,
            "app_name": settings.APP_NAME,
        },
    )


async def send_vaccine_due_email(
    email: str,
    *,
    full_name: str,
    vaccine_name: str,
    dose_label: str,
    due_date: str,
    days_until_due: int,
) -> None:
    """Send an email reminder for a due vaccine dose."""
    if days_until_due == 0:
        subject = f"Tu vacuna vence hoy - {settings.APP_NAME}"
        due_text = "hoy"
    elif days_until_due == 1:
        subject = f"Tu vacuna vence en 1 dia - {settings.APP_NAME}"
        due_text = "en 1 dia"
    else:
        subject = f"Tu vacuna vence en {days_until_due} dias - {settings.APP_NAME}"
        due_text = f"en {days_until_due} dias"

    await send_email(
        subject=subject,
        recipient=email,
        template_name="vaccine_due.html",
        context={
            "full_name": full_name,
            "vaccine_name": vaccine_name,
            "dose_label": dose_label,
            "due_date": due_date,
            "days_until_due": days_until_due,
            "due_text": due_text,
            "app_name": settings.APP_NAME,
        },
    )
