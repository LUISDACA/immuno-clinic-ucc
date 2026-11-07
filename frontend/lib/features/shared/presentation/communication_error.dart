import 'package:dio/dio.dart';

/// Safe presentation copy: never render a server diagnostic or response body.
String communicationQueryErrorMessage(Object error) {
  final status = error is DioException ? error.response?.statusCode : null;
  return switch (status) {
    401 => 'Tu sesión expiró. Inicia sesión nuevamente.',
    403 => 'No tienes permiso para consultar esta información.',
    404 => 'No se encontró la información solicitada.',
    429 => 'Demasiadas solicitudes. Espera antes de reintentar.',
    500 => 'Ocurrió un error en el servidor. Intenta nuevamente.',
    503 => 'El servicio no está disponible temporalmente.',
    _ => 'No se pudo cargar la información. Comprueba la conexión y reintenta.',
  };
}
