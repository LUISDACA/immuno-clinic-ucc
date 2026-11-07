# Cierre de pendientes de Fase 1

Verificado el 2026-09-27. Sin commit, despliegue, claves productivas ni cambios
de criterios clínicos. Esta evidencia actualiza `phase1-implementation.md`.
No se inició Fase 2.

## Clasificación

| Pendiente | Estado | Evidencia / límite |
|---|---|---|
| Flutter: cinco archivos que no compilaban | DONE | Una dependencia común, `app_theme.dart`, referenciaba una clase que cambió de biblioteca entre los SDK inspeccionados. Se conserva el constructor mediante la interfaz estable del tema. Analyze limpio y 30 tests pasan. |
| Android debug | DONE | APK generado con JDK 17 temporal y Gradle 8.14, URL de API local y firma debug. No se instaló en dispositivo. |
| Android release firmado | BLOCKED | No existe `frontend/android/key.properties`; no se buscó ni creó una firma de producción. El debug no acredita un release listo para tienda. |
| Tres pruebas concurrentes originales | DONE | Ejecutadas sin excluirlas, tanto con SQLite en archivo como con PostgreSQL 18; respuestas y request IDs verificados, con timeout explícito para evitar bloqueos indefinidos. |
| Aprobación / edición | DONE | Prueba PostgreSQL de bloqueo y refresco del objeto previamente cargado; edición posterior a aprobación devuelve 409 sin alterar fecha. E2E prueba también la respuesta HTTP. |
| Refresh / reset | DONE | Carrera de consumo de reset reproducida con dos 200 antes de corregirla; UPDATE condicional atómico produce un 200 y un 400. Refresh posterior al reset devuelve 401. |
| Catálogo concurrente | DONE | Ediciones serializadas por bloqueo de la vacuna; prueba de espera ante lock externo y dos reconciliaciones sin duplicar dosis sobre PostgreSQL. |
| Contrato y transporte de correo | DONE | Alta, recuperación y recordatorio aceptados por SMTP local real. Tests de rechazo, conexión fallida, template inexistente, escape HTML, logs y fallback SendGrid simulado → SMTP real. |
| Entrega externa / autenticación SMTP / SendGrid real | UNKNOWN | No se usaron credenciales reales ni se verificaron buzón, DNS, SPF/DKIM/DMARC, TLS del proveedor o webhooks. Aceptación SMTP local no prueba entrega externa. |
| E2E crítico API | DONE | Login → esquema → carga/descarga de PDF de evidencia → revisión → PDF certificado. Ejecutado con `admin` y `app_admin`, y rechazos a estudiante ajeno/administrador fuera de alcance. PostgreSQL, archivos locales y renderizador PDF reales. |
| E2E gráfico en navegador / dispositivo | UNKNOWN | La prueba usa HTTPX/ASGI y JWT reales; no conduce interfaces gráficas. Widgets Flutter y pruebas Next son capas adicionales, no sustituyen ese recorrido gráfico. |
| Literales históricos JMeter en fuentes actuales | DONE | Comparación sin mostrar valores de los tres literales recuperados del JMX de HEAD contra el árbol de texto actual: cero coincidencias. Test estructural del JMX pasa. |
| Vigencia / revocación de credenciales antiguas | UNKNOWN | No se probaron credenciales antiguas. La inspección no demuestra revocación ni elimina el historial Git. |
| Suite backend completa | DONE | 294 passed, sin skips ni deselections con los dos destinos PostgreSQL temporales habilitados. |
| Backend por defecto (SQLite) | DONE | 291 passed, 3 skipped explícitos: migración PostgreSQL y los dos tests de locks de catálogo. Los tres tests originales de concurrencia sí pasan; no son los omitidos. |
| Next tests / lint / typecheck / build | DONE | 36 tests; ESLint, tsc y build correctos; 26 páginas estáticas generadas, rutas dinámicas compiladas. |
| Revisión de diff | DONE | Ruff/format y `git diff --check` correctos. Cambios ajenos preservados, ninguna migración adicional en este cierre. |

El cierre técnico local tiene evidencia para los puntos DONE. No se declara
preparación productiva ni cierre de los puntos BLOCKED/UNKNOWN.

## Causas raíz y correcciones

### Flutter y Android

En el tag local Flutter 3.41.6, `CupertinoPageTransitionsBuilder` está declarado
en `src/material/page_transitions_theme.dart`. En el SDK instalado 3.44.9 está
en `src/cupertino/route.dart`. El código importaba solo Material. Cinco archivos
de tests fallaban al cargar el mismo tema; no eran cinco fallos independientes.

Un import directo de Cupertino resolvía solo el SDK nuevo. La solución final
obtiene los builders Apple de `const PageTransitionsTheme().builders`, presente
en ambos SDK inspeccionados, y conserva los FadeUpwards explícitos para las
otras plataformas. No se cambian colores, tipografía, duraciones ni curva de
animación. Test específico para los builders en tema claro y oscuro.

La primera compilación Android falló con el JDK 25.0.2 de Android Studio antes
de compilar la aplicación. Con Temurin 17.0.20.1 temporal, las tareas Gradle
completaron. Se retiraron las adiciones automáticas del migrador Flutter a
`gradle.properties` y se comprobó nuevamente el build sin ellas. No se cambió
la configuración global de Java, Gradle ni Flutter. Permanecen avisos de
deprecación de dependencias/Gradle; no se actualizaron versiones de plugins.

Artifact local: `frontend/build/app/outputs/apk/debug/ImmunoClinic.apk`
(también `frontend/build/app/outputs/flutter-apk/app-debug.apk`). Solo debug,
con API `http://10.0.2.2:8000/api/v1`. No destinado a publicación.
Tamaño verificado: 186368553 bytes. SHA256:
`1523ce9fb485c16dd5e538573dca08eb0270327c198f78354dea39871b2b8648`.

### Concurrencia

El arnés original usaba el engine de aplicación configurado por conftest como
`sqlite+aiosqlite:///:memory:`. Su `StaticPool` reutiliza la misma conexión para
sesiones concurrentes, con `pool_pre_ping=True`. No proporciona transacciones
independientes; la suite se detenía en solicitudes concurrentes al healthcheck.
No fue necesario alterar middleware ni el pool PostgreSQL productivo.

El fixture HTTP ahora crea SQLite en archivo con pool de conexiones o un esquema
temporal PostgreSQL. Inyecta sesiones independientes mediante `get_db`, mantiene
la autenticación real y limita el tiempo de `gather`. La repetición en ambos
motores verifica los tres casos originales, sin serializar artificialmente
las peticiones ni sustituir respuestas.

Las pruebas PostgreSQL encontraron dos controles adicionales:

- Reset: lectura de `used=false` y posterior marcado permitían reutilización
  concurrente. `consume_reset_token` realiza `UPDATE ... WHERE used=false AND
  expires_at>now RETURNING user_id`; consumo, contraseña y revocación se confirman
  en la misma transacción. Un rollback no consume el token.
- Catálogo: la reconciliación de configuraciones no adquiría el lock de la
  vacuna. Las mutaciones ahora usan `FOR UPDATE OF vaccines` y refrescan el ORM
  antes de leer configuraciones, serializando las modificaciones de esa vacuna.

No se introdujo rotación de refresh ni revocación inmediata de access tokens.
En una carrera refresh/reset, un refresh iniciado antes de la confirmación puede
haber emitido acceso; después del reset no se puede renovar con el refresh
revocado. Esa semántica se prueba expresamente y no se presenta como revocación
de JWT de acceso ya emitidos.

SQLite no implementa `FOR UPDATE`. Los dos tests de locks/reconciliación de
catálogo requieren PostgreSQL, igual que la prueba de migración. Con las
variables PostgreSQL se ejecutan todos; no se simula soporte de locks en SQLite.
La primera ejecución por defecto hizo visible una colisión UNIQUE al ejecutar
la reconciliación concurrente sin locks: por eso ese test quedó condicionado al
motor PostgreSQL, donde ya se había verificado el control. No se modifica la
implementación productiva para aparentar soporte de bloqueos en SQLite.

## Contrato de correo

| Flujo | Invocador | Momento / error público |
|---|---|---|
| Alta manual e importación | `StudentAdminService.create_student` | Cuenta confirmada antes de envío; fallo de correo no revierte la cuenta ni entrega su contraseña en la respuesta. Restablecer acceso tras reparar el canal. |
| Recuperación | `AuthService.forgot_password` | Token hash persistido antes del envío. BackgroundTasks en HTTP; respuesta genérica tanto para cuenta inexistente como fallo de entrega, evitando enumeración. |
| Recordatorios | `_create_reminder_if_needed` | Días configurados; conserva deduplicación diaria de la notificación. No existe cola durable ni reintento garantizado de correo. |

Las funciones de envío devuelven `EmailDeliveryStatus`: `accepted` significa
aceptación del proveedor; `disabled`, correo deshabilitado; `failed`, renderizado
o transporte fallido. Los contratos HTTP existentes se conservan. Los logs
incluyen transporte, template y clase de error, sin destinatario, asunto clínico,
contenido, contraseña ni prefijo del token. HTML dinámico se escapa.

Configuración: `EMAIL_ENABLED` (false por defecto), `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD`, **`SMTP_FROM`**, `SMTP_TIMEOUT_SECONDS` (10),
`SENDGRID_API_KEY`, `FRONTEND_URL`, `PASSWORD_RESET_URL_BASE` y
`VACCINE_EMAIL_REMINDER_DAYS`. Se corrigió `EMAIL_FROM` en `.env.example`, que
no era el nombre leído por Settings. Usuario/contraseña vacíos permiten SMTP
local sin AUTH; 465 utiliza TLS directo y 587 STARTTLS. No se ha probado TLS
de un proveedor externo. No usar SMTP sin TLS con credenciales reales.

SendGrid, si está configurado, tiene prioridad y SMTP es fallback. Se valida
aceptación HTTP 2xx. No hay garantía de entrega única: un error ambiguo del
proveedor seguido de fallback puede duplicar el correo. No se añadió outbox ni
se prometen reintentos durables. Estos límites son explícitos, no éxitos asumidos.

`SMTPInbox` es un servidor asyncio en `127.0.0.1` con puerto efímero. Recibe
mensajes MIME reales mediante aiosmtplib; no reemplaza el método de envío.
Solo el fallo SendGrid se simula, y su fallback atraviesa ese SMTP local.
Se añadió además un E2E de alta → correo → login con contraseña recibida →
403 hasta cambiar contraseña → acceso al esquema.

## Reproducción y evidencia

Entorno: Python 3.14.4, PostgreSQL 18, Node 22.16.0, Flutter 3.44.9, Dart 3.12.2,
Gradle 8.14 y JDK temporal 17.0.20.1. La ejecución exacta con Python 3.12/Flutter
3.41.6 de CI sigue sin ejecutarse; se inspeccionó la API de tema del tag 3.41.6.

Desde `backend`, usar un PostgreSQL **local desechable** y dos bases con nombre
`immuno_phase1_*`: una para integración y otra vacía para migración. Proporcionar
`PHASE1_INTEGRATION_URL` y `PHASE1_POSTGRES_URL` como variables de entorno,
con URLs SQLAlchemy `postgresql+asyncpg`. No usar datos ni destinos productivos.
El fixture crea/retira un esquema aleatorio por test; la prueba de migración
conserva su base para inspección y exige una base vacía en cada ejecución.

```text
pytest -q --tb=short                       # 294 passed con PostgreSQL habilitado
ruff check app tests                      # correcto
ruff format --check app tests             # correcto
```

Las pruebas generales existentes mantienen SQLite; los tests HTTP/E2E usan
PostgreSQL con `PHASE1_INTEGRATION_URL`. La migración real se verifica por
separado dentro de la misma suite. No se afirma que los 294 tests utilicen
PostgreSQL ni que `metadata.create_all` pruebe Alembic.

Desde `frontend-next`: `npm test`, `npm run lint`, `npx tsc --noEmit` y
`npm run build`. Desde `frontend`: `flutter analyze --no-pub` y
`flutter test --no-pub` (30 tests). Los archivos Dart cambiados pasan format.

Build debug reproducido desde `frontend/android` con `JAVA_HOME` apuntando a
JDK 17 y `./gradlew assembleDebug -Ptarget=lib/main.dart`, pasando únicamente el
dart-define de URL local. No se ejecutó release por ausencia de configuración
de firma. No se usaron argumentos con contraseñas.

## Archivos de este cierre

- `frontend/lib/core/theme/app_theme.dart` y nuevo `frontend/test/core/theme/app_theme_test.dart`.
- `backend/tests/conftest.py`, `backend/tests/test_api_e2e.py` y nuevo `backend/tests/integration_support.py`.
- Nuevos `backend/tests/test_phase1_e2e.py`, `backend/tests/test_email_transport.py`.
- `backend/app/modules/auth/repository.py`, `backend/app/modules/auth/service.py`.
- `backend/app/modules/admin/vaccines/service.py`.
- `backend/app/core/email.py`, `backend/app/core/config.py`, `backend/.env.example`.
- Este informe, referencia en `phase1-implementation.md` y actualización de la matriz UI.

Ninguna migración nueva en este cierre. Se conserva la migración aditiva de la
primera entrega. Se revisaron los diffs sin imprimir los valores retirados de
JMeter; el escaneo compara esos valores solo en memoria. Se excluyen historial
`.git`, dependencias/cachés y artifacts generados del análisis de fuentes;
se incluyen archivos de texto ocultos/ignorados de configuración. No se modifican
los cambios ajenos en `.gitignore` ni el archivo `codex`.

## Otros pendientes ya identificados, sin ampliación de fase

- **BLOCKED por decisión de dominio:** política/versionado de cambios de sexo y
  catálogo histórico; la regeneración por sexo sigue siendo un riesgo conocido
  y no se cambia en este cierre. Falta decisión clínica, no evidencia de que
  el riesgo haya desaparecido.
- **UNKNOWN operativo:** recuperación de cuentas antiguas cuya contraseña fue
  derivada del documento, rotación de credenciales históricas, sincronización
  de estudiantes reactivados, ensayo de rollback/volumen real en staging.
- **UNKNOWN fuera de estas pruebas:** entrega FCM real, paridad por capturas,
  recorrido en dispositivo/navegador, análisis exhaustivo de dependencias y
  typecheck estático backend. No se convierten en DONE por pasar unit tests.

Estos puntos y los límites de firma/correo externo requieren evidencia o
decisiones adicionales; no se comienza Fase 2 ni se declara listo para producción.
