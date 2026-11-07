# Fase 2 — ejecución por bloques

Arquitectura aprobada: PostgreSQL compartido; FastAPI autoridad; BFF Next con cookie
opaca; rotación v2 estricta; sin Redis, Azure, Maps, PDF/QR ni reglas clínicas.
Sin commits. Los cambios de Fase 1 y los cambios ajenos se conservan.

## Bloque 1 — modelo y migración: DONE (verificación local)

Causa: refresh sin sesión/familia; no hay versión de credenciales ni almacenamiento BFF.
Archivos: auth/models.py, users/models.py, migración 2026_09_27_0100,
tests/test_phase2_migration.py.
Cambio: auth_sessions, web_sessions privada, auth_version, generación/consumo/sucesor
en refresh_tokens; índices de unicidad. Campos nuevos permiten filas legacy sin borrarlas.
web_sessions no tiene FK a auth_sessions: evita locks cruzados mientras BFF espera HTTP.
Pruebas: migración real desde esquema anterior con usuario y refresh sintéticos,
preservación de contraseña/token, segunda ejecución idempotente. Auth/security existentes.
Ejecutado: pytest tests/test_phase2_migration.py tests/test_auth_integration.py
 tests/test_security.py --tb=short: **14 passed**; migración en PostgreSQL 18 local.
Ruff y git diff --check correctos; diff del bloque revisado.
Primer intento de migración falló por fixture sin created_at; corregido y repetido
sobre otra base vacía. SQLite en sandbox quedó bloqueado; fuera del sandbox pasó.
Rollback: forward-only, conservar columnas/tablas y desplegar versión compatible.
UNKNOWN: aplicación sobre volumen productivo y conectividad BFF real.

## Bloques siguientes

2–9: pendientes, no se declaran DONE.

## Bloque 2 — rotación/replay: DONE (pruebas locales del bloque)

Causa: refresh reutilizable y access independiente de su revocación.
Archivos: auth/service.py, sessions.py, router_v2.py, schemas.py, repository.py;
core/security.py, dependencies.py, config.py, main.py; test_phase2_sessions.py.
Solución: /api/v2/auth, locks usuario→sesión→token, sucesor único, revocación de
familia confirmada antes del 401, access con sid/av, logout idempotente por miembro
conocido, listado/revocación de sesiones propias, hashes retenidos hasta expiración.
Pruebas ejecutadas: test_phase2_sessions + test_auth_integration + test_security:
**17 passed**, HTTP y carrera de doble refresh sobre PostgreSQL real.
Un test detectó cambio del tipo de excepción Python: se conservó UnauthorizedException.
Ruff y diff check correctos; cambios del bloque revisados.
Riesgo: replay estricto invalida también al ganador de una carrera; respuesta perdida
requiere login. Rollback: solo binario consciente de sid/av, conservar historial.
UNKNOWN/pendiente transversal: fecha de retirada v1, cuotas v2 (bloque 8), FCM (6).
AUTH_V1_ENABLED=true mantiene transición explícita; no significa cierre de toda Fase 2.

## Bloque 3 — contraseña: DONE (verificación local)

Causa: consumo atómico de un enlace no invalidaba los demás; cambio de contraseña
no invalidaba access. Se serializa también forgot/login/reset/cambio por usuario.
Archivos: auth/repository.py, service.py; test_phase2_sessions.py,
test_auth_rate_limit_and_background.py, test_phase1_e2e.py.
Cambio: auth_version++, revocación de familias, invalidación de todos los enlaces
pendientes dentro de la misma transacción; relectura de contraseña tras adquirir lock.
Pruebas: enlaces diferentes concurrentes (200/400), access y refresh rechazados tras
cambio/reset, nuevo login válido. E2E de alta ahora espera 401 tras cambiar contraseña.
Ejecutado: sesiones + phase1_e2e + auth_rate_limit/background + auth_integration:
**29 passed**, sin skips, HTTP/concurrencia PostgreSQL y SMTP local.
Ruff y git diff --check correctos; diff revisado.
Rollback: conservar versiones/revocaciones, nuevos enlaces y login; no revivir tokens.
Riesgo: usuarios deben iniciar sesión de nuevo incluso tras cambio obligatorio.
UNKNOWN: entrega externa de correo (no se utilizaron credenciales reales).

## Bloque 4 — Flutter: DONE (analyze y pruebas locales)

Causa: guardado del refresh anterior, escrituras de credenciales separadas, respuesta
asíncrona capaz de restaurar una sesión después de logout.
Archivos: core/session/session_manager.dart, core/network/api_client.dart,
core/constants/app_constants.dart, auth_remote_ds.dart, auth_provider.dart,
change_password_screen.dart; test/core/session/session_rotation_test.dart y auth_provider_test.
Solución: auth v2 conservando APIs clínicas v1, par indivisible en secure storage,
escrituras serializadas y generaciones, single-flight refresh, un reintento de API,
respuesta perdida exige login; cambio de contraseña termina sesión.
Pruebas ejecutadas: flutter analyze limpio; flutter test --no-pub **37 passed**.
Tres pruebas nuevas: par tardío después de logout, 401 paralelos con una rotación,
respuesta refresh tardía sin restauración. Format y diff check correctos; diff revisado.
Primera ejecución detectó nuevos miembros públicos incompatibles con fakes; se hicieron
privados y se repitió toda la suite. Sin cambios visuales intencionados.
Rollback: app compatible con v2; no restaurar pares antiguos. UNKNOWN: dispositivo/build
actual; coordinación del dispositivo FCM se completa en bloque 6.

## Contrato de autenticación durante la transición

- `POST /api/v2/auth/login`: `{email,password}`; devuelve `access_token`,
  `refresh_token`, `token_type`, `must_change_password`, `expires_in`,
  `refresh_expires_in` y `session_id`. Flutter lo guarda como par en Secure Storage;
  el BFF lo conserva cifrado en PostgreSQL y al navegador solo devuelve el flag.
- `POST /api/v2/auth/refresh`: `{refresh_token}`; 200 devuelve el par completo nuevo,
  mantiene `session_id` y consume el token anterior. Reutilizar cualquier token consumido
  revoca la familia y sus access tokens; devuelve 401 `SESSION_INVALID`. Solicitudes
  inválidas devuelven 422 `INVALID_REQUEST` sin reflejar valores enviados.
- `POST /api/v2/auth/logout`: `{refresh_token}`; 204 revoca familia y FCM asociado.
  Cualquier miembro conocido de la familia permite logout idempotente.
- FastAPI conserva `/api/v1/auth` durante transición. V1 crea sesiones vinculadas,
  pero su refresh es heredado y no rota. `AUTH_V1_ENABLED=true` por defecto; fecha de
  retiro UNKNOWN. Los endpoints clínicos siguen en v1 y validan `sid` + `auth_version`.
- Contratos aditivos sin retirar los GET previos: `POST /api/v1/admin/students/search`
  acepta el cuerpo de filtros/paginación y `POST /api/v1/communications/recipients/search`
  acepta `{target,search}`. Flutter y Next ya los usan para que nombres/correos buscados
  no viajen en URL; los GET viejos permanecen para clientes anteriores.
- Las respuestas 422 FastAPI ya no incluyen el valor rechazado: rutas auth usan
  `{detail:"Solicitud inválida",code:"INVALID_REQUEST"}` y otras rutas conservan
  detalle por `loc/msg/type`, sin `input`. Es un cambio deliberado de privacidad; clientes
  deben mostrar mensajes propios y no depender de que el servidor repita datos sensibles.

## Bloque 5 — BFF: DONE (incluye E2E PostgreSQL)

**Causa raíz:** Next conservaba el refresh en cliente, su renovación no coordinaba procesos
y todas las llamadas clínicas mantenían el bloqueo PostgreSQL. **Archivos:**
`frontend-next/src/lib/server/session.ts`, `src/app/api/[...path]/route.ts`, cliente/API de
auth, stores/providers, README, `.env.example`, paquete y pruebas BFF.
El bloqueo de fila PostgreSQL ahora cubre solo lectura/rotación o revocación del par;
la llamada a rutas clínicas se realiza tras cerrar la transacción, evitando serializar
todas las solicitudes de una cookie por la duración de descargas o consultas largas.
El contrato BFF/CSRF y las variables exclusivamente servidoras están en
`frontend-next/README.md` y `.env.example`. El flujo probado en PostgreSQL local hace
login v2, llamada autenticada a esquema, rotación, logout y verifica la fila revocada
con ciphertext borrado. Respuestas no exponen el par. Next 16.3.6 tras actualización
de dependencias: **46 pruebas pasadas**, lint, typecheck, build y `npm audit` (0 avisos).
E2E no usa FastAPI real: mockea HTTP upstream, pero usa PostgreSQL real para el estado.
Rollback: conservar tabla y clave; cerrar/revocar cookies existentes si se pierde la clave.
UNKNOWN: rol PostgreSQL restringido y conectividad/dominio del entorno actual; no se tocó
Azure ni otro despliegue.

## Bloque 6 — FCM y logout: DONE (pruebas locales)

**Causa raíz:** tokens FCM sin vínculo con familia y el cambio de cuenta no seguía el orden
de desregistro, revocación y borrado local. **Archivos:** Flutter auth provider, session
manager, push service y `backend/app/modules/notifications/{models,repository,service,router}.py`.
La app desregistra el token del dispositivo con access token fijado antes de cerrar la
sesión local, cancela la suscripción de renovación y luego borra el token Firebase y
notificaciones locales. El backend vincula cada token a `session_id`, y una reasignación
lo desactiva para la cuenta anterior. Las revocaciones de familia desactivan sus tokens.
El push de transporte usa un texto genérico y `event=updates_available`; una prueba asegura
que valores clínicos de entrada no aparecen en el payload. Backend suite y Flutter suite
pasan. UNKNOWN: recepción de FCM real con proyecto/dispositivo configurado y credenciales;
no se usaron credenciales reales. Rollback: conservar la tabla/columnas y desplegar una
versión consciente de `session_id`; no volver a compartir un token entre cuentas.

## Bloque 7 — privacidad, logs y caché local: DONE con UNKNOWN de política de retención

**Causa raíz:** esquema clínico en preferencias sin caducidad, datos personales en logs/URLs
y notificaciones push con contenido potencialmente específico. **Archivos:** Flutter
scheme cache/provider, comunicaciones/router, configuración DB, logs de seed/correo/reminders,
sender push, APIs de búsqueda FastAPI/Flutter/Next y documentación de contratos.
La caché offline del esquema ahora vive en Flutter Secure Storage, está separada por usuario,
caduca a las 24 horas y se borra en logout/cambio de usuario; cache vieja o con reloj futuro
no se usa. Las 24 h son un límite técnico conservador pendiente de política formal: UNKNOWN.
SQL echo se desactiva para evitar parámetros clínicos/personales en logs; logs de envío de
correo y recordatorio no registran dirección, excepción ni contenido. Se retiró el nombre/
correo del deep link de comunicaciones. Los nuevos POST de búsqueda documentados evitan PII
en query strings manteniendo GET para clientes antiguos. Push carece de datos clínicos.
Flutter tests, suite backend, Next suite/lint/typecheck/build pasan. El reset token sigue en
query de enlace de un solo uso por compatibilidad móvil; valoración de fragment/deep-link
universal UNKNOWN. No se inspeccionaron logs de proveedor externo. Rollback: solo si se
mantiene cifrado/caducidad; no recuperar almacenamiento clínico en SharedPreferences.

## Bloque 8 — rate limiting compartido: DONE en pruebas; CIDR del proxy UNKNOWN

**Causa raíz:** el límite anterior confiaba en XFF y su storage no coordinaba workers.
**Archivos:** `backend/app/core/rate_limit.py`, config, FastAPI startup, modelos, migración
`2026_09_27_0300_rate_limit_buckets.py`, v2 auth router y pruebas PostgreSQL.
Se reemplazó almacenamiento local por ventanas atómicas en PostgreSQL compartido (HMAC del
identificador, contador acotado y limpieza por lotes cada 5 minutos). Se conserva la cuota
configurada de login/forgot; v2 login aplica la misma política de login. Se ignora XFF salvo
que el peer esté dentro de `TRUSTED_PROXY_CIDRS`; se recorre la cadena desde el peer hacia
el cliente. Pruebas sobre conexiones PostgreSQL independientes demuestran 3/12 solicitudes
permitidas en la cuota sintética y la ruta devuelve 429 + Retry-After tras 5 rechazos
sintéticos. Backend completo pasa. UNKNOWN: rangos efectivos del proxy del despliegue actual;
con lista vacía se usa el peer TCP (seguro frente a spoofing, pero puede agrupar usuarios
detrás de proxy). No modificar Azure/deploy impide confirmarlo. UNKNOWN: cuota específica de
refresh; conserva protección por rotación/replay y se requiere medir tráfico legítimo antes
de fijar otra cuota. Rollback: no borrar tabla/counters; revertir binario solo a versión con
lectura compatible de la tabla, nunca a rate limit aislado por worker.

## Bloque 9 — E2E y concurrencia: DONE (PostgreSQL local)

**Causa raíz:** pruebas previas no recorrían sesión rotatoria con la cadena clínica completa
ni todos los escritores compartidos. **Archivos:** `test_phase1_e2e.py`,
`test_phase2_sessions.py`, `test_phase2_rate_limit.py`, `test_phase2_push.py`,
`test_phase2_migration.py` y BFF E2E con esquema PostgreSQL aislado.
El E2E ejecuta login v2 por estudiante y administradores (admin y app_admin), busca por los
POST nuevos, descarga esquema, registra evidencia, prueba permisos con estudiante/tercero,
aprueba como rol autorizado y descarga/verifica PDF. Se probaron los dos roles de revisión.
También hay pruebas PostgreSQL concurrentes de doble refresh/replay, reset con enlaces
distintos, refresh/reset, operaciones de catálogo y buckets por conexiones independientes.
Verificación final: backend **306 passed, 2 skipped** en suite total; casos de concurrencia
PostgreSQL y flujo crítico ejecutados (grupo focalizado: **18 passed**). Next **46 passed**
usando PostgreSQL real para sesiones BFF, lint/typecheck/build correctos, npm audit 0; Flutter
analyze limpio y **37 passed**. Ruff y `git diff --check` pasaron.
Los dos skips de backend son los harness de migración que exigen variables de una DB vacía;
ambos se ejecutaron aparte y pasaron cada uno (**phase1 migration: 1 passed**;
**phase2 migration: 1 passed**) en bases locales desechables. No se cuentan los skips como
éxito de prueba.
Sin commit. No se hace deploy.

## Estado global y UNKNOWN restantes

Bloques 1–9 implementados y sus verificaciones locales pasan, sujeto a los UNKNOWN indicados.
Pendientes antes de considerar apta una liberación: probar el BFF con permisos mínimos y
conectividad del entorno real; confirmar CIDR del proxy sin confiar ciegamente en XFF;
definir retención offline; validar FCM/SMTP con infraestructura de prueba autorizada; fijar
retiro de V1 y cuota refresh; decidir enlace reset sin token en query manteniendo deep links.
Android debug: BLOCKED porque no hay `java`/`JAVA_HOME` (verificado directamente con Gradle);
iOS: UNKNOWN/no disponible en este host.
