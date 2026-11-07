# Fase5B — Cobertura finita R02:formularios y cuentas

Fecha:2026-10-21. R02=PARTIAL;S02/S03/S09 tienen correcciones R02A verificadas en sus estados descritos,no paridad integral. Fuentes:inventario S00–S24,plan/lista finita y ejecución del bloque account-forms. Sin cambios de servicios/almacenes de autenticación,contratos,reglas de contraseña o negocio clínico.

| Pantalla | Inspección actual / evidencia | Pendiente dentro del grupo |
|---|---|---|
| S00 inicio/restauración | Flutter SplashScreen limita la espera visual a5s y AuthNotifier limita `/users/me` a4s. R02G/H/I cubren carreras y errores controlados; `phase5b_session_transport_test.dart` ejercita Dio real contra loopback:503, reset TCP y respuesta HTTP de4,3s, verificando sesión/cache clínica limpia y respuesta tardía descartada. Next HomePage espera hidratación; `home-loading-accessibility.test.tsx` cubre carga y destinos. Next limita `/users/me` a4s y `session-transport.integration.test.ts` verifica Axios real contra loopback:503, reset TCP y respuesta tardía de4,8s, manteniendo la sesión anónima. Las tres suites Next focales pasan14 tests. | Transporte de cliente local cubierto y límite de perfil alineado; servicio desplegado/BFF/FastAPI, DNS/TLS/proxy, comparación visual/temporal integral y accesibilidad física permanecen UNKNOWN. La arquitectura conserva bearer Flutter y cookie/BFF Next. |
| S01 login | Flutter mantiene `TextFormField`/validadores;401 se presenta como “Correo o contraseña incorrectos”, error global live region. Enter avanza y Done envía usando los validadores. | Next enlaza errores con `aria-describedby`/alerta;store convierte el 401 genérico FastAPI “Invalid email or password” al mismo copy español. Error conserva campos; JSDOM y Chrome prueban Enter desde contraseña; E2E usa credenciales sintéticas con backend real local. Lector/teclado físico y paridad visual integral siguen UNKNOWN. |
| S02 recuperación | R02A:validación/envío único,bloqueo,error seguro429/500/503/red/timeout,borrador,success condicional. Flutter Done del teclado envía por la validación existente. | Next `<form onSubmit>` se prueba con Enter en JSDOM. Ambos usan datos sintéticos/transporte mock;SMTP/correo institucional no verificado. Comparación visual y teclado físico UNKNOWN. |
| S03 restablecimiento | R02A:mismos controles y errores;400 token inválido distinto de5xx;token no renderizado;unit Next sin token ofrece recuperación;Flutter Done en confirmación envía por handler validado y error servidor es live region; token/datasource mock. | Next form Enter y alerta `role=alert` probados en JSDOM. Enlace/deep-link móvil y recorrido correo→reset real siguen pendientes; diferencia Flutter sin token conservada. |
| S09 cambio de contraseña | R02A:campos bloqueados,errores seguros y logout tras éxito;Flutter teclado Next/Next/Done y error servidor live region;datasource mock. | Next `<form onSubmit>` envía con Enter y errores son `role=alert` en JSDOM. Sin auth real, periféricos ni representación integral; UNKNOWN. |
| S18 alta/importación | R02B:form nativo Next,lock compartido ambos clientes,preview consumida/reinicio de página,error seguro/dispose/capa exacta;11+3 tests Next/18 Flutter,E2E específico real PASS. Backend408 PASS/0 SKIP con20 E2E sobre build final. | Comparación integral de formulario/opciones por rol,viewport/teclado/lector y estados no capturados.Permisos/reglas de importación siguen FastAPI. No cerrar por dos pares390. |
| S22 perfil administrativo base | R02C:editor Next conserva borrador ante GET fallido;PUT confirmado/GET fallido distinto de fallo PUT,retry GET-only,form/bloqueo y capa exacta.Flutter compartido sin cambios,20 tests admin/app_admin;E2E real y gate backend409 PASS/0 SKIP,21 E2E sobre build final. Revalidación 2026-11-05: widget Flutter320/texto2× y Chromium con fixture sintético a320/768/1440/720 CSS px verifican wrapping de valores largos. | Reflow base y `LockedTile` no truncados;Next28 y Flutter21 PASS,analyze/lint/typecheck/build PASS. Pantalla integral PARTIAL: firma/storage, contraste completo, zoom nativo, lector/foco/teclado físico y paridad visual siguen UNKNOWN/excluidos. |

## Dimensiones de S02/S03/S09 en R02A

| Dimensión | Evidencia actual | Límite |
|---|---|---|
| Datos/acciones | Endpoints,payloads,normalización y validadores existentes conservados;transporte controlado verifica UI. | Backend sigue siendo autoridad;no nueva política de contraseña. |
| Loading/busy | Guardas sincrónicas+fieldset Next y _isLoading Flutter;doble submit una petición;campos/visibilidad bloqueados. | No lock distribuido ni nueva idempotencia. |
| Empty | Validación de campos vacíos;token ausente Next sin petición. | No listas:empty de paginación N/A.Falta de token Flutter sin nuevo botón de recuperación pendiente. |
| Error/retry | Código HTTP estático seguro;sin diagnóstico/PII;error retiene borrador y requiere acción explícita.Nunca reintenta solo por render. | Reintento de timeout no prueba resultado de una escritura incierta. |
| Success | Componentes/widgets:correo condicional,reset confirmado por mock,cambio exitoso sigue logout. | Navegador nuevo induce solo fallos;no prueba correo/reset/cambio real exitoso. |
| Permisos | S02/S03 públicos,S09 autenticado,guardas API/layout/store existentes intactos;backend completo conserva regresiones. | Los mocks no sustituyen pruebas de rol/dispositivo. |
| Navegación | Links/rutas existentes conservados,logout→login en Next y logout previo a éxito Flutter. | Deep links y back nativo requieren evidencia propia. |
| Paginación/filtros | N/A:no listados en estos tres formularios. | S18 tiene resultados de importación y se valida aparte. |
| Responsive | Flutter390×568 con TextScaler2 sin RenderFlex overflow y envío accesible;Chrome390 sin overflow horizontal. | No acredita todos los textos visibles:helper de requisitos nativo y composición/teclado físico siguen en R05. |
| Accesibilidad | Labels existentes,aria-describedby en errores Next,tooltip de visibilidad reset Flutter,región viva de error forgot y contraste oscuro corregido. | No validación universal de lector,foco/zoom ni contraste integral claro/oscuro. |
| Temas | Seis pares503 claro/oscuro390;error oscuro Flutter pasa ratio>=4,5;decoración web deja de tapar contenido en cambio de contraseña. | No igualdad de píxeles ni todas las combinaciones de estado/rol/viewport. |
| Sesión expirada | Next unit401 muestra copy segura;interceptores de generación/sesión existentes intactos;backend/E2E previos se conservan. | No nuevo E2E de expiración nativa ni cambio del protocolo Fase2. |

R02 continúa abierto hasta completar sus siete pantallas y registrar pendientes de R05/R06,sin convertir UNKNOWN en PASS. UI-16/UI-17,firma,PDF/QR,Azure,Maps y clínica excluidos. T-02/T-03 y almacenamiento institucional no validados. Sin commit.


## Dimensiones S18 en R02B

| Dimensión | Evidencia | Límite |
|---|---|---|
| Datos/acciones | Tres POST existentes;File/bytes/payload capturados;fecha YYYY-MM-DD preservada;wrapper comprueba perfiles sintéticos en PostgreSQL. | No nuevo contrato,regla clínica o política institucional.Sexo inicial/campos por rol siguen diferentes. |
| Busy | Creación/preview/importación mutuamente excluidas;picker Flutter bloquea antes de await;campos fijos y doble submit1 petición. | Lock local por instancia;no idempotencia distribuida. |
| Empty | Campos required/email nativos Next;validación Flutter existente;will_create0 deshabilita confirmación según backend. | Formato/cabeceras/vacío de archivo siguen backend;no nuevo validador clínico. |
| Error/retry | UI estática segura,borrador conservado;fallo de nueva preview retira resultado antiguo;timeout no se anuncia como éxito. | Next generic por operación y Flutter diferencia estados HTTP;sin validación integral de todos los errores por rol. |
| Success | Creación e importación reales web→BFF→FastAPI→PostgreSQL,detalle/resultados y nueva preview de existente;Flutter confirma preview/resultados con Dio controlado. | Correo/FCM deshabilitados,no test de entrega ni transporte nativo real. |
| Permisos | Ámbito de ambos estudiantes sintéticos comprobado en DB;guardas y permisos existentes intactos. | Gate backend mantiene permisos;no se amplían roles ni puede UI decidir ámbito efectivo. |
| Navegación/lifecycle | Next detalle tras creación;callbacks tras unmount no navegan;Flutter picker/create/preview tardíos no usan ref/setState inválidos. | Back/deep link/recarga no persisten archivos o borrador;no se añade almacenamiento sensible. |
| Paginación | Resultados existentes locales20 por página;re-preview desmonta panel y vuelve a página1,probado después de página2. | API devuelve todas las filas del archivo ya cargado;no descarga masiva adicional de usuarios ni endpoint nuevo. |
| Temas/responsive | Dos pares390 preview claro/oscuro;capa web sobre decoración solo en ruta create;sin overflow horizontal en escenas E2E. | Modal Flutter/inline Next distintos;no equivalencia visual integral,768/1440/320/200% pendientes aplicables. |
| Accesibilidad | Labels previos preservados;form nativo/Enter Chrome,error role=alert Next y fieldset disabled. | Foco en error,lector,teclado virtual/dispositivo físico y contraste integral UNKNOWN. |
| Sesión expirada | Test widget401 con mensaje seguro;helper de mutación mantiene protección de propietario;interceptores de sesión sin cambios. | No nuevo E2E de expiración móvil/cambio de usuario en esta pantalla. |

Controles B5-R02B01–R02B05 DONE en estados probados:Next499/Flutter382/backend408 PASS y gates;S18 yR02 siguen PARTIAL como pantallas/cobertura integral.


## Dimensiones S22 base en R02C

| Dimensión | Evidencia / límite |
|---|---|
| Datos/acciones/permisos | Mismos GET/PUT/payloads;Next nombres/cargo,ámbito bloqueado;Flutter componente/notifier compartidos intactos.Permiso403 real al cambio de ámbito del admin.No ampliar roles/campos. |
| Loading/empty | Sin datos:spinner,error no se disfraza de No registrado.null profile no inventa datos;retry inicial sin botón hasta respuesta.Con datos retenidos:error oculta datos/acciones y conserva editor. |
| Error/retry | Safe QueryError/mensajes estáticos,no cuerpo/diagnóstico;borrador conservado,retry doble1 GET,PUT confirmado no se repite,PUT fallido requiere nuevo envío explícito. |
| Busy/success | Lock y payload inmutable;Cancelar no abandona POST en mismo frame;éxito real y cargo final comprobados en DB.Aviso confirmado ligado a lectura concreta,retirado tras GET exitoso incluso idéntico. |
| Lifecycle/cache | Unmount/propietario previo no notifican ni restauran datos;GET anterior no borra error posterior.No persistencia de borrador tras recarga/sesión ni nuevo almacenamiento local. |
| Navegación | E2E login por rol→perfil→editar→guardar/recuperar→expiración controlada→login.Capa solo /admin/profile;no rutas nuevas. |
| Paginación | N/A:perfil individual,solo GET/PUT.No listados ni descargas masivas. |
| Temas/responsive | Cuatro pares390 de guardado confirmado/GET503,roles admin/app_admin y claro/oscuro.Sin paridad de píxeles;otras geometrías/contraste/truncamientos siguen pendientes. |
| Accesibilidad | Form Next con nombre,labels previos,estado busy y errores/avisos semánticos;widgets reales por rol.Lector,foco después de error,zoom/teclado/dispositivo físico UNKNOWN. |
| Sesión | Unit401 seguro y E2E401 controlado retira contenido protegido;guard de propietario actual conservado.No prueba de revocación nueva ni FCM. |
| Firma excluida | No se modifica hook/JSX/consultas/upload ni object URL;ProfileView se desmonta ante error como antes.404 sintético nativo y ausencia de firma en fixture no validan almacenamiento/imagen real. |

Controles B5-R02C01–R02C05 DONE:Next528/Flutter402/backend409 PASS y gates.S22/R02 siguen PARTIAL.Inventario finito:quedan comparación integral de estados/viewport registrados,sin ampliar clínica ni firma.

## R02D — S00 inicio y S01 login

| Dimensión | Flutter | Next | Resultado / límite |
|---|---|---|---|
| Inicio/restauración | Splash llama `checkSession`, valida identidad/rol, descarta respuesta posterior a logout y conduce a login al vencer su espera de5s. Pruebas `auth_provider_test.dart` y `app_smoke_test.dart` cubren error simulado, carrera logout y timeout local. | Provider limita restauración a5s, limpia estado anónimo/cache ante fallo y descarta respuesta después de logout. `session-transport.integration.test.ts` prueba Axios real contra servidor Node local con503, reset TCP y respuesta demorada6s; termina anónimo/hidratado y borra query clínica. | Estados locales y transporte/timeout HTTP de loopback cubiertos (R02F–R02K); DNS/TLS/proxy/BFF/FastAPI desplegados, comparación visual/temporal integral y accesibilidad física no validados y siguen UNKNOWN. |
| Login/loading | Campos `TextFormField`;botón depende de carga y validación Flutter. | Formulario y botón bloqueado durante carga;validadores existentes. | Sin cambios de validadores,copy,API/store/rutas ni estilo. |
| Error por campo | Flutter asocia `validator` con `TextFormField`;tests existentes no comprobaban esa semántica. | Antes,`<p>` sin `aria-describedby` ni anuncio. Test nuevo falló;ahora cada campo enlaza su mensaje mediante `aria-describedby` y el mensaje usa `role=alert`. | Semántica probada en DOM;lector real y orden de foco no probados. |
| Gates / estado vigente | R02G/I: `auth_provider_test.dart` 10 PASS; `app_smoke_test.dart` 2 PASS; Flutter analyze PASS. SDK temporal3.41.6/Dart3.11.4 y caché recuperada según lockfile. | R02F/I: `phase1-auth.test.ts` 8 PASS; `home-loading-accessibility.test.tsx` cubre carga; R02J/K `session-transport.integration.test.ts` 3 PASS; Next lint/typecheck PASS. | Transporte HTTP local real, incluido el timeout, está probado; servicio remoto/TLS/proxy y paridad integral siguen UNKNOWN. R02/S00 PARTIAL; ver [R02F–R02K](../audits/phase5b-implementation.md#continuación--r02f-límite-de-espera-en-restauración-de-sesión-next-2026-11-02). |

### Navegación después de hidratar S00

`home-loading-accessibility.test.tsx`: **7 PASS**. Además del estado inicial, prueba que una sesión ya hidratada se enruta a login cuando es anónima, a `/student` para estudiante, a `/admin` para `admin` y `app_admin`, y a la pantalla de cambio obligatorio correspondiente por rol. Es una prueba de componente con store controlado, no un recorrido navegador desde la respuesta HTTP. No cambia auth, permisos ni rutas. Paridad temporal/visual con Flutter y validación física permanecen UNKNOWN; S00/R02 PARTIAL.

### Error de autenticación S01

Flutter `login_screen_test.dart`: **3 PASS**, incluida comprobación del flag live region del mensaje que entrega el provider. Next `phase5b-login-accessibility.test.tsx`: **2 PASS**, incluidos rol de alerta para error del servidor y conservación de email/contraseña ingresados. Flutter analyze, Next lint/typecheck y `git diff --check` PASS. No se alteró texto, lógica de autenticación ni transporte. TalkBack/VoiceOver y prueba física de foco/teclado permanecen UNKNOWN; S01/R02 siguen PARTIAL.

### Teclado del login S01

Flutter reproduce Enter en correo como avance al siguiente campo y Done en contraseña como submit por la misma ruta validada del botón. La prueba nueva falló antes con `loginCalls=0`; tras configurar `TextInputAction.next/done` y `onFieldSubmitted`, `login_flow_test.dart` + `login_screen_test.dart`: **5 PASS**; `flutter analyze --no-pub`: PASS. Next usa el submit nativo de `<form>`; su test de accesibilidad/error se mantiene **2 PASS**. No se cambian validadores, payload ni protocolo. Teclado físico en dispositivo y lectores continúan UNKNOWN; S01/R02 PARTIAL.

**Next Enter.** `phase5b-login-accessibility.test.tsx` ahora también escribe credenciales sintéticas y pulsa Enter; el submit llama una vez a `login` con email normalizado/password intacta. Suite actual **3 PASS**, lint/typecheck PASS. Es JSDOM, no E2E de navegador; la verificación física continúa UNKNOWN.

**Chrome Enter desde contraseña.** En los E2E anteriores el helper enfocaba `button[type=submit]`, por lo que no probaba la presentación implícita del form desde el campo. El helper ahora enfoca `#password` y pulsa Enter. `tests/test_phase5b_account_forms_browser.py`: **1 PASS** con Chrome/Next BFF/FastAPI/PostgreSQL sintéticos; el flujo llega al dashboard student antes de probar los fallos controlados de formularios. El primer intento no inició porque la DB local indicada no existía; se creó vacía, el fixture aisló y eliminó su schema, y el reintento pasó. No se enviaron correos ni se cambió una contraseña real. Teclado físico/lector siguen UNKNOWN.

### Error 401 de autenticación S01

FastAPI define credenciales inválidas con HTTP401 y `detail="Invalid email or password"`; Flutter sustituye ese texto por “Correo o contraseña incorrectos”, mientras Next antes mostraba el detalle inglés. Next store ahora traduce únicamente status401 al mismo texto. `phase1-auth.test.ts`: **9 PASS**; lint/typecheck/build webpack PASS. Otros estados de error/login siguen en sus rutas actuales y no se consideran cubiertos por este ajuste.

La prueba de login integrada usa la API mockeada con respuesta401 y pulsa Enter en el formulario: alerta español, sin mostrar detalle original y con campos conservados. Suite UI login **4 PASS** más store **9 PASS**; lint/typecheck PASS. Fuente real/postgres permanece sin ejecutar en este control.

### Teclado de recuperación S02

Se demostró que Flutter Done no disparaba la operación (`api.calls=[]`). Ahora llama `_handleSubmit`, manteniendo validación, normalización y guard de doble envío; la solicitud comprobada usa `/auth/forgot-password` y correo sintético. Flutter `phase5b_account_forms_test.dart`: **38 PASS**; analyze PASS. Next `phase5b-account-forms.test.tsx`: **33 PASS**, con Enter por `userEvent`/JSDOM; lint/typecheck PASS. No se enviaron correos; SMTP real, teclado físico y lector permanecen UNKNOWN.

### Teclado de restablecimiento S03

Flutter Done en el campo de confirmación tampoco enviaba (`api.calls=[]`). Ahora contraseña nueva define `TextInputAction.next` y confirmación usa `done` conectado a `_resetPassword`. Next prueba Enter del mismo formulario en JSDOM. Suites completas `phase5b_account_forms_test.dart`: **39 PASS** y `phase5b-account-forms.test.tsx`: **34 PASS**; Flutter analyze, Next lint/typecheck y formato PASS. Se usaron tokens/passwords sintéticos y transportes mock; no se alteró ninguna contraseña real ni se envió correo. S03 submit de teclado automatizado DONE; deep links/correo/dispositivo físico siguen UNKNOWN.

### Teclado de cambio de contraseña S09

Se reprodujo Done de Flutter sin petición (`api.calls=[]`). Ahora contraseña actual/nueva usan `next` y confirmación usa `done` conectado a `_submit`. Next Enter también se prueba en JSDOM. Suites de formularios actuales: Flutter **40 PASS**, Next **35 PASS**; Flutter analyze, Next lint/typecheck y formato PASS. Credenciales sintéticas, API mock; no se cambió contraseña real. S09 submit automatizado DONE para este caso; sesión real, dispositivos/lectores y cobertura completa por rol UNKNOWN.

### Anuncio de errores S03/S09

Flutter mostraba los errores de servidor sin `liveRegion`, a diferencia de la alerta Next. Reset y cambio ahora marcan el texto visible como región viva. Regresiones 503 con datasource falso inspeccionan el árbol Semantics: Flutter account forms **42 PASS**, analyze PASS; Next account forms **35 PASS** y verifica `role=alert`. No valida lectores físicos; S03/S09 semántica automatizada DONE en ese estado, accesibilidad física UNKNOWN.

### Confirmación visible tras logout S09 — 2026-11-05

El logout dispara redirect y desmonta la pantalla protegida, así que un mensaje local de éxito podía perderse. Flutter ahora usa el messenger global capturado antes de logout; Next usa el toaster global. Flutter prueba los recorridos student/admin hasta `/login` y confirma el aviso (**44 PASS**, analyze PASS). Next prueba `AuthGate` y que el aviso se publica aunque el formulario se desmonte durante logout (**36 PASS**, lint/typecheck/build webpack PASS). Es prueba sintética, no una sesión real ni lector/dispositivo físico; esos puntos siguen UNKNOWN.
