import 'package:dio/dio.dart';

enum AccountFormOperation { forgot, reset, change }

/// Presentation only; never renders response bodies, tokens or diagnostics.
String accountFormError(Object error, AccountFormOperation operation) {
  final status = error is DioException ? error.response?.statusCode : null;
  if (status == 400 && operation == AccountFormOperation.reset) {
    return 'Token inválido o expirado. Solicita un nuevo enlace.';
  }
  if (status == 400 && operation == AccountFormOperation.change) {
    return 'La contraseña actual no es correcta.';
  }
  final message = switch (status) {
    401 => 'Tu sesión expiró. Inicia sesión nuevamente.',
    403 => 'No tienes permiso para realizar esta acción.',
    422 => 'Revisa los datos del formulario.',
    429 => 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
    500 => 'Ocurrió un error en el servidor. Intenta nuevamente.',
    503 => 'El servicio no está disponible temporalmente.',
    _ => null,
  };
  if (message != null) return message;
  if (error is DioException &&
      const [
        DioExceptionType.connectionTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.receiveTimeout,
      ].contains(error.type)) {
    return 'El servicio tardó demasiado en responder. Intenta nuevamente.';
  }
  return 'No se pudo completar la solicitud. Comprueba la conexión e intenta nuevamente.';
}
