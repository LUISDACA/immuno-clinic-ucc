/// Failure classes for clean error handling.
abstract class Failure {
  final String message;
  const Failure(this.message);
}

class ServerFailure extends Failure {
  final int? statusCode;
  const ServerFailure(super.message, {this.statusCode});
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'Sin conexión a internet']);
}

class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Error en almacenamiento local']);
}

class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Error de autenticación']);
}

class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}
