# Despliegue de producción

Esta guía usa Render para publicar el backend FastAPI y PostgreSQL. Después se compila el frontend apuntando a la URL pública del backend.

## 1. Antes de subir a GitHub

No subas archivos privados:

- `backend/.env`
- `backend/*firebase*.json`
- `backend/*service-account*.json`
- `frontend/android/key.properties`
- `frontend/android/app/*.jks`
- `frontend/android/app/*.keystore`

El proyecto ya tiene reglas en `.gitignore` para esos archivos.

## 2. Crear backend y base de datos en Render

1. Sube el proyecto a GitHub.
2. En Render, crea un **Blueprint** desde el repositorio.
3. Render detectará `render.yaml` y creará:
   - `immunoclinic-backend`
   - `immunoclinic-db`
4. El plan gratis no soporta `preDeployCommand`, por eso el `startCommand` corre primero `alembic upgrade head` y luego inicia FastAPI.
5. Antes de desplegar, configura las variables secretas del servicio web:
   - `FIREBASE_CREDENTIALS_JSON`
   - `CORS_ORIGINS`, por ejemplo `["https://tu-frontend.vercel.app"]`
   - `CORS_ORIGIN_REGEX`, opcional para previews, por ejemplo `https://.*\.vercel\.app`
   - `FRONTEND_URL`, por ejemplo `https://tu-frontend.vercel.app` si tienes frontend web
   - `PASSWORD_RESET_URL_BASE=https://immunoclinic-backend.onrender.com`
   - `APP_DEEP_LINK_BASE=immunoclinic://auth`
   - `S3_BUCKET`
   - `S3_ACCESS_KEY`
   - `S3_SECRET_KEY`
   - `S3_ENDPOINT` si usas un proveedor compatible con S3 distinto de AWS
   - `SENDGRID_API_KEY`
   - `SMTP_FROM`, con un remitente verificado en SendGrid
   - `VACCINE_EMAIL_REMINDER_DAYS=3,2,1,0`
   - `CRON_SECRET`, una cadena larga aleatoria para proteger el cron externo
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`

Para obtener el contenido compacto del JSON de Firebase desde PowerShell:

```powershell
Get-Content -Raw backend\ucc-immunoclinic-firebase-adminsdk-fbsvc-2042725821.json | ConvertFrom-Json | ConvertTo-Json -Compress
```

Copia la salida completa y pégala como valor de `FIREBASE_CREDENTIALS_JSON` en Render.

## 3. Storage persistente

El backend está configurado para producción con `STORAGE_TYPE=s3`. Usa almacenamiento persistente compatible con S3, por ejemplo AWS S3, Cloudflare R2, MinIO o Backblaze B2.

Las evidencias no se exponen como archivos públicos; el backend las entrega por endpoints autenticados.

## 4. Email de recuperación

`EMAIL_ENABLED=true` está configurado para producción. Para que recuperación de contraseña envíe correos y abra la app:

1. Configura `SENDGRID_API_KEY`.
2. Configura `SMTP_FROM` con un remitente verificado.
3. Configura `PASSWORD_RESET_URL_BASE=https://immunoclinic-backend.onrender.com`.
4. Configura `APP_DEEP_LINK_BASE=immunoclinic://auth`.
5. Instala una APK que incluya el intent filter de `immunoclinic://auth/reset-password`.
6. Prueba el flujo "Olvidé mi contraseña" con un usuario real.

El link enviado tendrá esta forma:

```text
https://immunoclinic-backend.onrender.com/reset-password?token=TOKEN
```

Ese enlace HTTPS abre una página puente que intenta abrir la APK con `immunoclinic://auth/reset-password?token=TOKEN`.
Si la app no está instalada, Android mostrará la página con el botón. Para un flujo público web + app se recomienda configurar App Links HTTPS con dominio propio.

El mismo servicio de email tambien envia:

- correo de bienvenida cuando se crea una cuenta de estudiante;
- recordatorios de vacuna cuando faltan 3, 2, 1 dias y el mismo dia de vencimiento.

Los dias se controlan con `VACCINE_EMAIL_REMINDER_DAYS`. El job evita repetir el mismo recordatorio el mismo dia.

Para que los recordatorios sean confiables en Render free, configura un cron externo diario que haga:

```text
POST https://immunoclinic-backend.onrender.com/api/v1/notifications/cron/vaccine-reminders
Header: X-Cron-Secret: TU_CRON_SECRET
```

Ese endpoint despierta Render y ejecuta los recordatorios aunque el servicio haya estado dormido. Usa el mismo valor de `CRON_SECRET` en Render y en el cron externo.

Cuando rotes SendGrid, crea una API key nueva en SendGrid, actualiza `SENDGRID_API_KEY` en Render, redeploya y luego elimina la key antigua.

## 5. Verificar backend

Cuando termine el despliegue, abre:

```text
https://TU-SERVICIO.onrender.com/
```

Debe responder con `status: healthy`.

La API queda en:

```text
https://TU-SERVICIO.onrender.com/api/v1
```

## 6. Firma release Android

Crea un keystore local. Ejemplo:

```powershell
keytool -genkey -v -keystore frontend\android\app\immunoclinic-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias immunoclinic
```

Copia la plantilla:

```powershell
Copy-Item frontend\android\key.properties.example frontend\android\key.properties
```

Edita `frontend\android\key.properties` con tus contraseñas reales. Ese archivo no debe subirse a Git.

## 7. Generar builds

Usa siempre la URL real del backend.

APK release:

```powershell
.\scripts\build_android_release.cmd "https://TU-SERVICIO.onrender.com/api/v1"
```

Web release:

```powershell
.\scripts\build_web_release.cmd "https://TU-SERVICIO.onrender.com/api/v1"
```

La APK queda en:

```text
frontend\build\app\outputs\flutter-apk\app-release.apk
```

Instálala en celulares reales y prueba iniciar sesión, subir evidencias, descargar certificado, recuperar contraseña y recibir notificaciones.
