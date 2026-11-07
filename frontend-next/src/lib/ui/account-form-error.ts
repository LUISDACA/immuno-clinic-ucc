import { isAxiosError } from 'axios';

// Presentation only. Never display diagnostics, response bodies or identifiers.
export function accountFormError(error: unknown, operation: 'forgot' | 'reset' | 'change'): string {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 400 && operation === 'reset') return 'Token inválido o expirado. Solicita un nuevo enlace.';
  if (status === 400 && operation === 'change') return 'La contraseña actual no es correcta.';
  const messages: Record<number, string> = {
    401: 'Tu sesión expiró. Inicia sesión nuevamente.',
    403: 'No tienes permiso para realizar esta acción.',
    422: 'Revisa los datos del formulario.',
    429: 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
    500: 'Ocurrió un error en el servidor. Intenta nuevamente.',
    503: 'El servicio no está disponible temporalmente.',
  };
  if (status && messages[status]) return messages[status];
  if (isAxiosError(error) && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '')) {
    return 'El servicio tardó demasiado en responder. Intenta nuevamente.';
  }
  return 'No se pudo completar la solicitud. Comprueba la conexión e intenta nuevamente.';
}
