# Fase 5B — Matriz de evidencia por bloques

Fecha: 2026-10-09, America/Bogota. Implementación/evidencia: [phase5b-implementation.md](../audits/phase5b-implementation.md). **Paridad integral PARTIAL.** FastAPI sigue siendo autoridad de negocio; no se copian decisiones clínicas Flutter.

La primera sección cubre Enter del test y contención de decoración; las siguientes, detalle/esquema, catálogo/diálogos y etiquetas/notificaciones/panel de usuario. El [inventario completo de pantallas](phase5-parity-matrix.md) y los bloques restantes del [plan](../audits/phase5b-plan.md) conservan sus pendientes. PASS de un componente o paleta no equivale a paridad de una pantalla completa.

## Estado vigente de R06 — 2026-11-06

| Decisión | Flutter / FastAPI | Next | Estado y verificación |
|---|---|---|---|
| H02: historial app_admin | FastAPI ya autoriza `admin` y `app_admin`; Flutter conserva la ruta administrativa | El menú incluye Historial para ambos roles y el guard acepta ambos bajo `AuthGate requireRole="admin"` | DONE en acceso y navegación. Componentes Next cubren app_admin permitido y estudiante bloqueado; el E2E real con PostgreSQL verifica ruta y contenido app_admin. |
| C02: hilo sin interlocutor identificable | Flutter elige un participante distinto del usuario actual y no representa etiqueta si no hay ninguno | Next aplica el mismo criterio; omite nombre/avatar/placeholder cuando no se identifica contraparte | DONE en lista y detalle. Pruebas sintéticas en ambos clientes; sin asignación de destinatario ni cambio de API/permisos. |
| A07: semestre | FastAPI publica `semesters: [1..10]`, la lista seleccionada de Flutter | Dashboard, filtros y formularios consumen opciones de FastAPI; nuevas altas aceptan 1–10. Los registros históricos fuera del rango siguen visibles y filtrables, y su valor se conserva al editar sin cambio | DONE para la decisión de opciones. Filtros/consultas mantienen compatibilidad histórica hasta20; sin migración ni actualización de datos. |

La verificación funcional acotada pasa: backend/admin18 tests, Next579 PASS/3 SKIP y suite focal90 PASS, Flutter445 PASS/analyze PASS, Next lint/typecheck/build webpack, Ruff y `git diff --check` PASS. El E2E PostgreSQL se documenta en [la implementación](../audits/phase5b-implementation.md#decisiones-r06-h02-c02-y-a07). R04/S11 siguen PARTIAL; R05 permanece UNKNOWN para validación física; Fase5B no se cierra.

| Pantalla/estado | Referencia Flutter disponible | Next ejecutado | Evidencia / límite |
|---|---|---|---|
| Login claro, SO oscuro | AppColors claro rasterizado,8 tokens | CSS real, preferencia persistida, acción con contraste≥4,5 | [Captura](evidence/phase5b/shared-theme/next-login-light-os-dark.png). Coincidencia de paleta; pantalla Flutter completa **UNKNOWN**. |
| Login oscuro, SO claro | AppColors oscuro rasterizado,8 tokens | CSS real y preferencia manual | [Captura](evidence/phase5b/shared-theme/next-login-dark-os-light.png). Paleta; no golden de pantalla. |
| Login system, SO claro/oscuro | Paletas AppColors | Reload y cambio de preferencia SO conservan system | [Claro](evidence/phase5b/shared-theme/next-login-system-os-light.png), [oscuro](evidence/phase5b/shared-theme/next-login-system-os-dark.png); comparación de4×8 valores [JSON](evidence/phase5b/shared-theme/palette-comparison.json). |
| Dashboard estudiante, Badge | Estado clínico/backend intacto; referencia de paleta | Badge real oscuro/claro con contraste medido; estado no calculado en test/UI | [Oscuro](evidence/phase5b/shared-theme/next-dashboard-student-dark-os-dark.png), [claro](evidence/phase5b/shared-theme/next-dashboard-student-light-os-dark.png). Fixture sintético, sin cierre visual integral. |
| Selector de tema / teclado | Referencia de preferencia existente; lector móvil no probado | Tab alcanza Claro, foco visible, Enter activa, aria-pressed y persistencia | **PASS** componente+Chrome. [Captura](evidence/phase5b/shared-theme/next-theme-selector-keyboard-light-os-dark.png). Semántica completa del UserMenu pendiente en otro bloque. |
| Login/error de envío | Flujo funcional existente; pantalla Flutter no capturada aquí | Alert real, contraste claro y contenido preservado | [Captura](evidence/phase5b/shared-theme/next-login-error-light-os-dark.png). Sin cambio de contrato/error/autenticación. |
| Login/error en320/390/768/1440 | Responsive Flutter completo **UNKNOWN** | clientWidth=scrollWidth=innerWidth=ancho solicitado | **PASS** navegador; [JSON](evidence/phase5b/shared-theme/measurements.json) y [móvil390](evidence/phase5b/shared-theme/next-login-error-mobile-light-os-dark.png). Sin autoampliación causada por círculos. |
| Login/formulario largo,320×400 | Teclado virtual/dispositivo físico **UNKNOWN** | Scroll vertical funcional; envío visible después de desplazar | **PASS** Chrome. No acredita todos los formularios ni teclado virtual. |
| Contenido/feedback/overlay dentro del fondo | Funcionalidad existente preservada | Contenido fuera de aria-hidden y de la capa recortada; botón activable por teclado | **2 tests de componente PASS**; JSDOM verifica estructura/interacción, no clipping de píxeles. Menú real visible en captura de selector. |
| Navegación/permisos/sesión/contexto de5A | Referencia funcional5A ya cerrada | E2E5A pasa con fondo corregido; regressiones backend/Next/Flutter pasan | **PASS** para pruebas existentes. No afirmar cobertura visual de cada estado de sesión en cada pantalla. |
| Labels fuera del catálogo y panel de usuario | Inventario y código Flutter | Pendientes al final del primer bloque; resueltos técnicamente en bloque4, documentado abajo | **DONE** controles acotados; paridad integral **UNKNOWN** y bloque5 pendiente. |
| Certificados/verificador UI-16/UI-17 | Capacidades documentadas | Sin cambios de capacidades | **BLOCKED por alcance**. No rediseño PDF/QR. |

Los screenshots de login pueden incluir avisos de sesión/error del flujo existente; no se etiquetan como todos los estados success/empty/loading probados. Los viewports son pruebas de reflow propuestas, no una política institucional.

## Continuación — R02, S01 login claro

| Elemento / estado | Flutter físico | Next / resultado | Estado y límite |
|---|---|---|---|
| Login base, claro, sin error visible | [POCO X4 Pro](evidence/phase5b/login-parity/flutter-login-light-physical.png), captura1080×2400 con barras del SO | [Chrome393×873](evidence/phase5b/login-parity/next-login-light-393x873.png). Marca dentro de la tarjeta, título a la izquierda, rótulos centrados/flotantes | **DONE** composición base. Sin golden píxel a píxel ni comparación de tipografía automatizada. |
| Tarjeta y controles | Card Flutter redondeada; logo, campos y acción en una sola composición | Next: x24,345×516px, radio24px; campos y botón52px. `scrollWidth=393`; estado sin overflow | **PASS** medidas del viewport revisado. No equivale a todos los anchos ni a escalado de fuente web. |
| Rótulos y accesibilidad automatizada | Flutter conserva `labelText`; el registro físico anterior cubre texto grande del botón | Next conserva `<label for>` y mueve el rótulo según el estado del campo. Component test verifica la asociación y valor; Chromium verifica estado vacío/relleno | **DONE** semántica/estados comprobados. Foco con teclado/lector físico Next **UNKNOWN**. |
| Recuperar contraseña | Usa el encabezado compartido de autenticación | [Captura Next](evidence/phase5b/login-parity/next-forgot-password-light-393x873.png); header `display:flex`, max-width448px, sin overflow | **DONE** no-regresión del shell común en esta ruta/viewport. No cubre reset ni cambio de contraseña. |
| Restauración anónima | API real no necesaria para comparar vista | E2E intercepta GET `/api/users/me` con503 sintético; no hay mensaje de sesión vencida, login, cookies reales ni mutaciones. Una captura directa anterior sí lo mostró, sin status HTTP registrado | **PASS** solo para503 sintético; causa de la alerta directa **UNKNOWN**. Servicio FastAPI/BFF y sesión real **UNKNOWN**. |

La medición detallada está en [measurements.json](evidence/phase5b/login-parity/measurements.json), y el runner repetible en `frontend-next/tests/e2e/phase5b-login-layout-browser.mjs`. Gates: Next focal5 PASS; suite completa582 PASS/3 SKIP sin PostgreSQL en esa corrida; lint, typecheck y build webpack PASS. **R02/Fase5B siguen PARTIAL**: otros estados de login, otros viewports/temas, foco/teclado nativo y pantallas restantes no quedan cerrados por esta comparación.

El [diagnóstico previo](../audits/phase5b-theme-diagnosis.md) conserva la evidencia FAILED y la sonda de DOM. Las nuevas capturas de `shared-theme` provienen del runner del repositorio corregido contra build final; no se usa una sonda temporal para declarar PASS.

Estados loading/empty/success/error de todas las pantallas, zoom/texto ampliado, lectores de pantalla y comparación visual completa Flutter/Next siguen pendientes. T-02/T-03 siguen PARTIAL; sin preparación productiva ni commit.

## Continuación — bloque2, detalle y esquema

Referencia funcional inspeccionada: `AdminStudentDetailScreen._schemeTab` y `SchemeDetailScreen._buildVaccineCard` usan `ExpansionTile`, nombres y estados enviados por backend. Flutter no recibe cambios. Sus acordeones empiezan cerrados; Next administrativo ya abría los dos primeros y conserva ese comportamiento. No se oculta esta diferencia como paridad exacta.

| Pantalla / estado | Flutter / autoridad | Next / evidencia nueva | Estado y límite |
|---|---|---|---|
| Detalle administrativo, esquema con datos, claro/SO oscuro | Card/ExpansionTile con tema Flutter; datos backend | [Antes](evidence/phase5b/detail-scheme/before-detail-admin-scheme-light-os-dark.png) y [después](evidence/phase5b/detail-scheme/after-detail-admin-scheme-light-os-dark.png); root claro, tarjeta blanca y título de dosis legible | **DONE** corrección de superficies/texto. Captura Flutter pareada **UNKNOWN**. |
| Detalle administrativo, oscuro/SO claro | Referencia AppColors oscuro y expansión | [Después](evidence/phase5b/detail-scheme/after-detail-admin-scheme-dark-os-light.png), CSS oscuro aunque SO claro | **DONE** preferencia representada. No se acredita toda la identidad gráfica de AppShell. |
| Detalle, tres pestañas / teclado / deep link | Tabs de perfil/esquema/evidencia; navegación funcional5A | tablist/tab/tabpanel, IDs relacionados; flechas/Home/End enfocan; Enter/Espacio activan. URL conserva página de evidencia y retorno con página/filtro; Chrome verifica recarga | **DONE** controles y contexto probado. Lectores de pantalla reales **UNKNOWN**. |
| Detalle, expansión y acciones explícitas | ExpansionTile; revisión y comentario separados | aria-expanded/controls y región etiquetada; dos primeras abiertas en Next como antes. Teclado colapsa/abre y retiene foco. Cancelar aprobación/denegación no confirma | **DONE** corrección semántica; apertura inicial difiere entre plataformas y no se modifica por cosmética. |
| Detalle, comentario / confirmaciones | Capacidad funcional existente; permisos backend | Contraste medido de comentario, botón y marco de confirmación en ambos temas; cancelación restaura comentario sin revisión | **DONE** elementos medidos. No se toca endpoint/payload/confirmación ni permiso. |
| Esquema estudiante, datos / expansión / roles | ExpansionTile inicialmente cerrado, orden y estados backend | [Claro](evidence/phase5b/detail-scheme/after-student-scheme-light-os-dark.png), [oscuro](evidence/phase5b/detail-scheme/after-student-scheme-dark-os-light.png); acordeón cerrado al cargar, Enter/Espacio abre/cierra, sin Aprobar/Denegar | **DONE** controles probados; no se calcula elegibilidad en tests/clientes. |
| Ambos esquemas,320/390/768/1440, claro y oscuro | Dispositivo Flutter y comparación responsive integral pendientes | Chrome comprueba innerWidth=clientWidth=scrollWidth=ancho solicitado; [admin móvil](evidence/phase5b/detail-scheme/after-admin-detail-scheme-light-mobile.png), [estudiante móvil](evidence/phase5b/detail-scheme/after-student-scheme-light-mobile.png) | **DONE** ausencia de overflow horizontal en fixtures probados. Zoom, teclado virtual y composición visual de toda navegación **UNKNOWN**. |
| Carga/vacío/error/expiración, perfil y evidencia en ambos temas | Inventario y tests funcionales existentes | Gates de regresión ejecutados; no nuevas capturas pareadas de cada combinación | **UNKNOWN** cobertura visual integral. No se extrapola PASS de esquema con datos. |

[Mediciones](evidence/phase5b/detail-scheme/measurements.json) contienen colores, contrastes, expansión y geometría; no IDs de usuario, cookies, tokens ni datos clínicos. Solo fixtures sintéticos en capturas. **Bloque2 = PARTIAL como matriz visual completa; correcciones técnicas acotadas verificadas. Fase5B = PARTIAL.**

## Continuación — bloque3, catálogo y diálogos

Referencia Flutter inspeccionada: `VaccineCatalogScreen._openEditor` usa showDialog/Dialog; `_toggleActive` usa AlertDialog con Cancelar/confirmación; `_VaccineEditor` usa TextFormField con labelText, selectores y FilterChip. Next conserva campos, opciones y payloads; FastAPI autoriza escritura únicamente a app_admin. No se copia ninguna regla del editor Flutter ni se modifican valores clínicos.

| Pantalla / estado | Referencia Flutter | Next / evidencia | Estado y límite |
|---|---|---|---|
| Crear, claro/SO oscuro | Dialog y tema AppTheme; no pantalla pareada disponible | [Antes](evidence/phase5b/catalog-dialog/before-catalog-editor-light-os-dark.png), [después](evidence/phase5b/catalog-dialog/after-catalog-editor-light-os-dark.png); superficies de tokens | **DONE** corrección de tema medida; comparación Flutter de pantalla **UNKNOWN**. |
| Crear, oscuro/SO claro | Tema y controles existentes | [Después](evidence/phase5b/catalog-dialog/after-catalog-editor-dark-os-light.png); selección de chip anunciada y fondo compuesto medido | **DONE** para elementos medidos; hover/disabled integral **UNKNOWN**. |
| Modal por teclado | Navegación modal Flutter | Nombre asociado, foco Nombre o Cancelar, fondo inerte, Tab/Shift+Tab circulan, Escape/backdrop cierran, foco vuelve al disparador | **DONE** componente y Chrome real. No se atribuye modalidad a JSDOM ni a lectores reales. |
| Campos y filas de dosis | labelText, selectores y chips | Labels/IDs/helpers/grupos asociados; foco al añadir/quitar fila, fallback a Agregar si no hay fila | **DONE** estructura/interacción; reglas y opciones intactas. |
| Edición | Código inmutable y advertencia existente | [Claro](evidence/phase5b/catalog-dialog/after-catalog-edit-light-os-dark.png), [oscuro](evidence/phase5b/catalog-dialog/after-catalog-edit-dark-os-light.png); código disabled, helper asociado, payload update sin code | **DONE** representación y regresión de contrato existente. No se valida reconciliación institucional. |
| Activar/desactivar | AlertDialog y confirmación explícita | [Confirmación](evidence/phase5b/catalog-dialog/after-catalog-toggle-light-os-dark.png); foco inicial Cancelar, Escape sin mutación; tests de submit único, bloqueo pendiente y error seguro | **DONE** controles; no nueva semántica de activación. |
| Escritura pendiente | Operación existente de catálogo | [Guardando](evidence/phase5b/catalog-dialog/after-catalog-saving-dark.png); fieldset disabled, aria-busy, foco dentro, cierre bloqueado y sin doble POST | **DONE**, petición sintética retenida temporalmente por CDP. |
| Fallo y reintento | Manejo funcional existente | [Error](evidence/phase5b/catalog-dialog/after-catalog-error-dark.png); 503 controlado, datos conservados y error dentro del modal; reintento real crea catálogo en PostgreSQL y refresca lista | **DONE** recuperación. El503 es inducido, no una caída real de PostgreSQL. |
| Responsive320/390/768/1440 | Dispositivo/zoom Flutter aún no capturados | Dialog cabe en viewport sin overflow horizontal, scroll interno deja envío accesible; [móvil arriba](evidence/phase5b/catalog-dialog/after-catalog-editor-light-mobile.png), [móvil abajo](evidence/phase5b/catalog-dialog/after-catalog-editor-dark-mobile-bottom.png) | **DONE** geometría/interacción probadas. Zoom, teclado virtual y dispositivo real **UNKNOWN**. |
| Permisos | Backend y navegación por rol | app_admin emite POST real; admin normal es redirigido por guard existente; GET BFF→FastAPI devuelve403 a admin y estudiante | **DONE** evidencia acotada; permisos no se amplían. |
| Loading/empty/error de listado, sesión expirada en modal, lector y Flutter pareado | Inventario y tests funcionales existentes | Gates existentes y limpieza al desmontar; sin nuevas capturas completas de todos los estados | **UNKNOWN** cobertura visual integral. |

[Mediciones](evidence/phase5b/catalog-dialog/measurements.json) y [baseline del build previo](evidence/phase5b/catalog-dialog/baseline.json). Solo fixtures sintéticos; sin tokens/IDs personales en metadata. **Correcciones técnicas acotadas verificadas; bloque3 como paridad visual completa PARTIAL. Fase5B permanece PARTIAL.**


## Continuación — bloque4: etiquetas y acciones independientes

| Pantalla/estado | Referencia funcional Flutter | Next y evidencia | Estado / límite |
|---|---|---|---|
| Lista estudiantes / filtros | Listado/filtros nativos; Fase5A conserva contexto | 5 etiquetas relacionadas; click enfoca Select en Chrome; page=2 conservada. [Captura](evidence/phase5b/controls/after-student-filters.png). | **DONE** asociación; apariencia pareada completa **UNKNOWN**. |
| Alta estudiante | Formulario y campos existentes, sin copiar opciones institucionales | 15 etiquetas asociadas, IDs únicos, sexo/date/import incluidos, valores y attrs preservados. [Captura](evidence/phase5b/controls/after-student-create-labels.png). | **DONE** semántica; UI-18 institucional no se modifica. |
| Detalle / editar perfil | Datos y edición administrativa existentes | 11 etiquetas, foco por click, formularios y escrituras sin cambios. [Captura](evidence/phase5b/controls/after-student-edit-labels.png). | **DONE** asociación; todos los estados visuales **UNKNOWN**. |
| Alta administrador app_admin | Permiso definido por backend; formulario actual Next | 7 etiquetas incluidas contraseña/programa/sede; atributos conservados. [Captura](evidence/phase5b/controls/after-admin-create-labels.png). | **DONE** asociación; no nuevas capacidades/permisos. |
| Notificaciones estudiante/admin / no leída | notifications_screen.dart: IconButton independiente; abrir marca y navega | Botones hermanos nativos con nombres; Enter/Espacio; estado textual; marcar no navega. [Estudiante claro](evidence/phase5b/controls/after-notifications-student-light.png), [admin oscuro](evidence/phase5b/controls/after-notifications-admin-dark.png). | **DONE** estructura/acciones; pantalla Flutter pareada **UNKNOWN**. |
| Notificaciones / lectura exitosa y recarga | Provider Flutter actualiza lectura/contador | Query y contador actualizados contra PostgreSQL; destinos por backend; lectura persistida en recarga. [Estudiante](evidence/phase5b/controls/after-notifications-read-student.png), [admin](evidence/phase5b/controls/after-notifications-read-admin.png). | **DONE** comportamiento; no se promete nueva semántica ni ausencia de fallos de infraestructura. |
| Notificaciones / loading/empty/error | Referencia funcional de estados | Componente cubre carga/vacío sin acciones; tests5A de errores/retry conservados. | **DONE** regresión ejecutada; capturas pareadas de cada estado/tema **UNKNOWN**. |
| Usuario / links/tema/logout | PopupMenuButton dashboards: perfil/historial/contraseña/logout | Panel disclosure con región nombrada y controles nativos; Tab alcanza link, Escape retorna, foco exterior cierra, tema no hace logout. Función logout exacta; Chrome comprueba401 posterior. [Claro móvil](evidence/phase5b/controls/after-user-panel-student-light-mobile.png), [oscuro admin](evidence/phase5b/controls/after-user-panel-admin-dark.png). | **DONE** teclado/disclosure; lectores reales **UNKNOWN**. No se aplica patrón de flechas menu ARIA a controles heterogéneos. |
| Usuario/notificaciones / responsive | Controles adaptados a plataforma | 320/390/768/1440, ambos temas y roles: ancho real, scrollWidth y límites del panel; 18 capturas totales de este bloque. [Mediciones](evidence/phase5b/controls/measurements.json). | **DONE** geometría en esos tamaños; alturas inferiores/zoom/dispositivo físico **UNKNOWN**. |

19 tests nuevos de componentes, un E2E nuevo real; los gates definitivos se registran en [implementación](../audits/phase5b-implementation.md#continuación--bloque4-etiquetas-notificaciones-y-panel-de-usuario). No se deduce paridad de cada pantalla Flutter de coincidencia de tokens. Sin cambios clínicos/contratos/auth/Flutter funcional. **Fase5B PARTIAL; bloque5 pendiente; UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL.**


## Continuación — bloque5, primera comparación pareada: notificaciones

2026-10-10, America/Bogota. Alcance de esta ejecución: pantalla compartida de notificaciones. Otras pantallas del bloque5 siguen pendientes; no se da por cerrada Fase5B. FastAPI conserva datos, destinos y permisos. [Fixture común sin datos institucionales](fixtures/phase5b-notifications.json).

| Estado / validación | Flutter real / fuente local | Next real / Chrome | Resultado y límite |
|---|---|---|---|
| Datos no leídos, claro | [390×844](evidence/phase5b/notifications-comparison/after-flutter-notifications-unread-light-390-text1.png) | [Estudiante](evidence/phase5b/notifications-comparison/after-next-notifications-student-unread-light-390-csszoom1.png) | Título, mensajes, contador y acciones equivalentes. Next incluye fecha y estado textual; Flutter estado semántico. Shell propio de plataforma. **DONE** referencia acotada, no igualdad de píxeles. |
| Datos no leídos, oscuro | [Flutter](evidence/phase5b/notifications-comparison/after-flutter-notifications-unread-dark-390-text1.png) | [Admin](evidence/phase5b/notifications-comparison/after-next-notifications-admin-unread-dark-390-csszoom1.png) | Mismo fixture en roles permitidos; el widget Flutter es compartido, no se presenta como E2E de autorización móvil. **DONE** muestra. |
| Leído, claro/oscuro | [Oscuro](evidence/phase5b/notifications-comparison/after-flutter-notifications-read-dark-390-text1.png) | [Oscuro](evidence/phase5b/notifications-comparison/after-next-notifications-student-read-dark-390-csszoom1.png) | No botón de marcado para leído. Estado Flutter controlado por notifier de prueba; respuesta Next leída controlada para presentación. Lectura real persistente sigue cubierta en el E2E anterior. **DONE** representación. |
| Vacío, oscuro | [Antes](evidence/phase5b/notifications-comparison/before-flutter-notifications-empty-dark-390-text1.png), [después](evidence/phase5b/notifications-comparison/after-flutter-notifications-empty-dark-390-text1.png) | [Next](evidence/phase5b/notifications-comparison/after-next-notifications-student-empty-dark-390-csszoom1.png) | Flutter pasó de contraste3,85 a11,00 usando onSurfaceVariant; claro8,93. **DONE** corrección comprobada con ThemeData real. No copiar composición web a móvil. |
| Carga, claro/oscuro | [Flutter oscuro](evidence/phase5b/notifications-comparison/after-flutter-notifications-loading-dark-390-text1.png) | [Next oscuro](evidence/phase5b/notifications-comparison/after-next-notifications-student-loading-dark-390-csszoom1.png) | Spinner/notificador bloqueado de prueba; GET de Chrome retenido por CDP. **DONE** muestra, no evidencia de tiempos de red reales. |
| Error503 + retry | [Flutter error oscuro](evidence/phase5b/notification-errors/flutter-notifications-error-initial-dark-390-text1.png), corregido posteriormente en B5-N04 | [Next oscuro](evidence/phase5b/notifications-comparison/after-next-notifications-student-error-dark-390-csszoom1.png) | **DONE** error/reintento Flutter en lo probado; representación disponible en ambas plataformas. Capturas con estado/error controlado; no infraestructura fallando. Mensaje Flutter genérico y Next específico según HTTP. Diferencia de refresh con datos previos sigue pendiente, documentada abajo. |
| Texto ampliado y scroll | [Flutter texto2×](evidence/phase5b/notifications-comparison/after-flutter-notifications-unread-dark-390-text2.png); 320 adicional sin error de layout | [Next CSS zoom2×, contenido](evidence/phase5b/notifications-comparison/after-next-notifications-student-unread-dark-390-csszoom2-content.png) | Ambos permiten acceder al contenido; Next necesita scroll tras la navegación superior ampliada. CSS zoom no equivale a zoom nativo del navegador ni al TextScaler de Flutter. **DONE** simulaciones; zoom nativo/dispositivo **UNKNOWN**. |
| Lectura/abrir y accesibilidad | Tooltip de marcado, Semantics Leída/No leída, labeledTapTargetGuideline y androidTapTargetGuideline; marcar no navega, abrir marca una vez | Controles hermanos/contador/destinos reales del bloque4; nuevo flujo rechaza app_admin por403 real para ambos roles | **DONE** en pruebas ejecutadas. TalkBack/VoiceOver **UNKNOWN**. No se cambia provider ni el contrato. |

Fuentes Inter locales verificadas contra google_fonts6.3.3 y MaterialIcons real, sin descargas dentro del test. Registro de contraste: [Flutter](evidence/phase5b/notifications-comparison/flutter-measurements.json). Registro de respuestas y geometría: [Next](evidence/phase5b/notifications-comparison/next-measurements.json). Las referencias con fuentes reales no reemplazan pruebas de permisos backend ni se aceptan como baseline universal de todas las pantallas.

Pendientes del bloque5: dashboards/panel, listas/altas, detalle/perfil/evidencia, esquema, catálogo y comunicaciones en sus estados pareados; zoom nativo y lectores/dispositivos. Sin cambios de UI-16/UI-17. **FASE5B PARTIAL**, T-02/T-03 PARTIAL, sin commit.

## Continuación — error y reintento Flutter, B5-N04

| Estado / criterio | Flutter | Next / resultado |
|---|---|---|
| Fallo inicial | Error seguro + Reintentar; [claro](evidence/phase5b/notification-errors/flutter-notifications-error-initial-light-390-text1.png), [oscuro](evidence/phase5b/notification-errors/flutter-notifications-error-initial-dark-390-text1.png) | QueryError + retry ya presente, captura503 controlada enlazada arriba. **DONE** capacidades de error/reintento; no equivalencia textual ni pixel a pixel. |
| Fallo de refresh con lista anterior | [Oscuro/texto2](evidence/phase5b/notification-errors/flutter-notifications-error-retained-dark-390-text2.png): lista/contador retenidos, aviso y reintento; lectura confirmada conservada | Antes Next retornaba QueryError aun con data previa. **DONE** retención/reintento Next en la continuación B5-N06 para fallos transitorios; error de acceso/cancelación conserva vista error-only. Comparación ampliada B5-N09 permanece PARTIAL. |
| Reintento / doble invocación / respuestas tardías | Notifier real + datasource controlado: recuperación con datos o vacío, un GET compartido; respuesta anterior no sobrescribe éxito/error nuevo | Regresiones previas web pasan. No se presenta el widget móvil como E2E HTTP/dispositivo real. **DONE** en Flutter probado; dispositivos/transporte real UNKNOWN. |
| Usuario distinto / logout | Provider reconstruido por userId limpia error/datos; ignora respuesta del usuario anterior, sin cambiar auth | Sesión/BFF conservados y suites/E2E pasan. **DONE** regresiones cubiertas; no nuevo control de autenticación. |
| Temas / TextScaler / accesibilidad | Ocho capturas390×844, claro/oscuro, texto1/2, inicial/datos retenidos; nombres y targets accesibles. Contraste Reintentar16,23 claro/14,48 oscuro | Tokens existentes; solo nuevo botón Flutter usa onSurface para evitar2,51 de contraste claro heredado. No cambia tema global. **DONE** mediciones; lectores/zoom nativo UNKNOWN. |

[Índice/hash](evidence/phase5b/notification-errors/capture-index.json), [mediciones](evidence/phase5b/notification-errors/flutter-measurements.json), [pruebas/resultados](../audits/phase5b-implementation.md#continuación--b5-n04-error-y-reintento-de-notificaciones-flutter). Las ocho capturas nuevas no son nuevos goldens. Los16 anteriores permanecen intactos y pasan en la suite97. **B5-N04/B5-N05 DONE; FASE5B PARTIAL**. UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL. Sin commit.

## Continuación — refresh/reintento Next y protección de datos retenidos

| Estado / criterio | Flutter de referencia | Next / resultado final |
|---|---|---|
| Refresh503 con datos, claro | [Flutter](evidence/phase5b/notification-errors/flutter-notifications-error-retained-light-390-text1.png) | [Estudiante](evidence/phase5b/notification-refresh/retained-student-light-390-csszoom1.png): conserva avisos y contador de página con error seguro y aviso de últimos datos. **DONE** capacidad equivalente, shell nativo de plataforma; no igualdad pixel a pixel. |
| Refresh503 con datos, oscuro | [Flutter](evidence/phase5b/notification-errors/flutter-notifications-error-retained-dark-390-text1.png) | [Admin](evidence/phase5b/notification-refresh/retained-admin-dark-390-csszoom1.png): mismo fixture sin PII clínica. **DONE** representación acotada. |
| Retry pendiente / recuperación | Widgets con datasource controlado y notifier real,11 tests del bloque anterior | [Pendiente](evidence/phase5b/notification-refresh/retrying-student-light-390.png), [recuperado](evidence/phase5b/notification-refresh/recovered-student-light-390.png): un GET para doble retry, control disabled/aria-busy, datos visibles mientras espera y aviso retirado al éxito. **DONE** CDP +40 tests nuevos de página/shell y carreras de requests. |
|403 y503 posterior | No se altera auth/permisos Flutter | [403](evidence/phase5b/notification-refresh/forbidden-student-light-390.png), [503 posterior](evidence/phase5b/notification-refresh/blocked-after-denial-student-light-390.png): datos/acciones ocultos desde el primer403, incluso durante retry automático y tras salir/regresar, hasta GET exitoso. Cancelación y401/400/404/422 probados en componentes;401→login en Chrome. **DONE** controles de presentación; errores CDP sintéticos, no revocación real nueva. |
| Shell / contador de navegación | Controles propios de Flutter conservados | Un alert en notificaciones, error global conservado en otros módulos; contador fallido oculto. **DONE** por rol en componentes y smoke E2E final del shell real. Claves de consulta independientes conservadas. |
| CSS zoom2 / sticky header | [Flutter texto2](evidence/phase5b/notification-errors/flutter-notifications-error-retained-dark-390-text2.png) | Diagnóstico histórico: texto truncado y error solapado. La captura [Next ampliado](evidence/phase5b/notification-refresh/retained-admin-dark-390-csszoom2-content.png) se actualizó en la continuación B5-N09 de abajo: texto reorganizado y margen bajo header. **B5-N09 PARTIAL** por validación nativa UNKNOWN; no equiparar CSS zoom con TextScaler o zoom nativo. |

[Índice/hash24 PNG](evidence/phase5b/notification-refresh/capture-index.json), [mediciones por rol/tema](evidence/phase5b/notification-refresh/measurements.json), [resultados/rollback](../audits/phase5b-implementation.md#continuación--refresh-fallido-de-notificaciones-next). Backend390 PASS/3 SKIP con cinco E2E; Next206 PASS, lint/typecheck/webpack PASS; Flutter97 PASS/analyze PASS. No actualización de goldens Flutter. **B5-N06/B5-N07/B5-N08 DONE; FASE5B PARTIAL**. Otras pantallas/estados, lectores, dispositivos y zoom nativo pendientes/UNKNOWN. UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL. Sin commit.

## Continuación — B5-N09, lectura y desplazamiento de notificaciones

| Estado / criterio | Flutter de referencia | Next / evidencia y límite |
|---|---|---|
| Título en espacio reducido, claro/oscuro | [Título multilínea, texto2](evidence/phase5b/notifications-comparison/after-flutter-notifications-unread-dark-390-text2.png); mismo fixture ordinario | [Admin oscuro390 CSS zoom2](evidence/phase5b/notification-reflow/unread-admin-dark-390-csszoom2.png): icono/destino, texto a ancho completo y marcado separado abajo. Fragments de título/mensaje/fecha contenidos, sin elipsis/clamp en estrecho; requiere scroll vertical si la fila es alta. **DONE** para defectos demostrados y tamaños medidos; no equivalencia de ampliación móvil/nativa. |
| Texto largo/palabra sin espacios320 | Flutter conserva título multilínea/subtítulo2 líneas; no golden adicional con este texto | [Estudiante claro320](evidence/phase5b/notification-reflow/long-copy-student-light-320-csszoom1.png): texto sintético completo en estrecho, cortes de palabra sin pérdida de contenido. **DONE** Next probado; comparación adicional del texto largo en Flutter UNKNOWN. |
| Estado normal de escritorio | Misma acción de abrir/marcar; Flutter tiene shell nativo | [Admin oscuro1280](evidence/phase5b/notification-reflow/unread-admin-dark-1280-csszoom1.png): composición en fila, título adaptable y resumen del mensaje de2 líneas conservado. **DONE** smoke de representación; no paridad de composición de escritorio/móvil. |
| Error retenido + scroll | [Flutter oscuro/texto2](evidence/phase5b/notification-errors/flutter-notifications-error-retained-dark-390-text2.png): error delante de lista | [Next oscuro](evidence/phase5b/notification-refresh/retained-admin-dark-390-csszoom2-content.png): alert completo bajo sticky header tras scrollIntoView. Offset observado según altura real, ResizeObserver/fallback/cleanup probados. **DONE** corrección CSS zoom2 en Chrome; zoom nativo/otros navegadores UNKNOWN. |
| Capas decorativas / contador | Flutter no sitúa aros del shell web sobre datos | AppShell limita nueva capa de contenido a notificaciones; RGB del padding superior del badge coincide con fondo opaco en12 escenarios de escritorio. La prueba falla con build anterior y pasa tras ajuste. **DONE** control de pintura local, sin cambiar brand.tsx/global/otras rutas. |
| Teclado / acciones independientes | Marcar no abre; abrir conserva acción backend | Tab alcanza marcado hermano en320/CSS zoom2; unit Enter/Espacio con título largo mantiene lectura/navegación separadas. **DONE** Chrome/componentes; lector físico UNKNOWN. |

[36 PNG con hashes](evidence/phase5b/notification-reflow/capture-index.json), [geometría/pintura/teclado](evidence/phase5b/notification-reflow/measurements.json), [causas/archivos/gates/rollback](../audits/phase5b-implementation.md#continuación--b5-n09-reflow-de-notificaciones). Next214 PASS y lint/typecheck/webpack PASS; Flutter97 PASS/analyze PASS. E2E aislado final1 PASS; backend/PostgreSQL final390 PASS/3 SKIP, incluidos cinco E2E. SKIP de migraciones sin bases/variables, no se cuentan como PASS; no migraciones nuevas. Sin cambios clínicos/API/auth/Flutter ni goldens. **B5-N09 PARTIAL: correcciones técnicas DONE, validación nativa UNKNOWN. FASE5B PARTIAL.** UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL; sin commit.


## Continuación — dashboard estudiante, estados pareados

| Estado / criterio | Flutter de referencia | Next / resultado |
|---|---|---|
| Datos y cinco contadores, cero denegadas | [Claro](evidence/phase5b/student-dashboard/after-flutter-dashboard-data-light-390-text1-top.png), [oscuro/texto2](evidence/phase5b/student-dashboard/after-flutter-dashboard-data-dark-390-text2-top.png); mismos agregados sintéticos | [Claro](evidence/phase5b/student-dashboard/after-next-dashboard-data-light-390-csszoom1-stats.png), [oscuro/CSS zoom2](evidence/phase5b/student-dashboard/after-next-dashboard-data-dark-390-csszoom2-stats.png). Siempre cinco contadores de DTO; badge deriva solo de is_up_to_date. DONE en lo ensayado; ninguna evaluación clínica local. |
| Carga | Estadísticas con skeleton, hero/accesos preservados | Cinco placeholders, botón disabled/aria-busy y ningún badge clínico antes de respuesta. DONE componentes/CDP; tiempos de red reales UNKNOWN. |
| Cero | Cinco ceros del fixture, no error | Cinco ceros, conserva accesos. DONE representación de DTO sintético; no definir qué elegibilidad institucional implica un catálogo vacío. |
| Error / permisos / recuperación | _StatsError mantiene hero/accesos y retry existente | QueryError ahora solo dentro de estadísticas;403/404/500/503 seguros y retry. Error tras refresh oculta contadores/badge anteriores.403 administrativo real y401→login controlado en E2E. DONE pruebas; no modificar autorización/auth/cache. |
| Refresh / petición retrasada / doble click | Fuerza notifier existente, disabled en loading;25 nuevos tests de referencia/control | Un GET compartido, respuesta actualiza UI,403 oculta cache y retry recupera. DONE tests/Chrome; no mutaciones clínicas ni nuevas políticas de retención. |
| Accesos / contraste | [Antes](evidence/phase5b/student-dashboard/before-flutter-dashboard-data-light-390-text1-actions.png), [después](evidence/phase5b/student-dashboard/after-flutter-dashboard-data-light-390-text1-actions.png): onSurface17,06 claro/12,98 oscuro, iconos conservados | [Después](evidence/phase5b/student-dashboard/after-next-dashboard-data-light-390-csszoom1-actions.png). Mantiene7 rutas originales, descripciones web y tarjetas nativas Flutter; no igualdad pixel a pixel. DONE corrección de texto; contraste integral/iconos/reader UNKNOWN. |
| Etiquetas ampliadas / responsive | Aprobadas/etc multilínea sin ellipsis a TextScaler2; tooltip Notificaciones enlaza misma ruta | CSS module exclusivo: reflow de hero/título/accesos en22rem y capa local;24 escenarios sin recorte de labels ni overflow horizontal. DONE simulación; zoom nativo/dispositivos UNKNOWN. |
| Offline | Conserva Información no verificada por falta de conexión en fixtures con cache antigua | No introducir offline/cache clínica Next. Capacidad móvil existente representada, sin nueva implementación ni equivalencia offline web. UNKNOWN para transporte físico. |

[Resultados/causas/rollback](../audits/phase5b-implementation.md#continuación--dashboard-estudiante-b5-d01-a-b5-d04), [fixture agregado](fixtures/phase5b-student-dashboard.json).40 capturas previas Flutter,40 nuevas referencias y48 Next; mediciones numéricas sin datos institucionales. Flutter122/Next226 PASS; backend/PostgreSQL391 PASS/3 SKIP con seis E2E, lint/typecheck/analyze/formato/webpack PASS y E2E final aislado1 PASS/22,64 s. [Índice y SHA-256](evidence/phase5b/student-dashboard/capture-index.json), [mediciones Next](evidence/phase5b/student-dashboard/next-measurements.json); títulos capturados visibles bajo header con separación mínima15,5 px. Tres migraciones SKIP por falta de otras bases aisladas, no PASS; sin migraciones nuevas. **Dashboard PARTIAL / correcciones técnicas verificadas; FASE5B PARTIAL.** UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL. Sin commit.

Revalidación S04 (2026-10-26): Next `phase5b-student-dashboard.test.tsx` **12 PASS**; Flutter `phase5b_student_dashboard_reference_test.dart` **25 PASS**. No se repitió E2E/PostgreSQL ni se regeneraron goldens. La matriz principal se actualizó para distinguir loading de cero válido, los accesos por ubicación y la señal offline exclusivamente Flutter.


## Continuación — dashboards administrativos por rol

| Estado / criterio | Flutter | Next / resultado y límite |
|---|---|---|
| Datos admin, claro/oscuro | [Claro](evidence/phase5b/admin-dashboard/after-flutter-admin-data-light-390-text1-top.png), [oscuro/texto2](evidence/phase5b/admin-dashboard/after-flutter-admin-data-dark-390-text2-top.png); cinco contadores/backend, gráficos existentes | [Claro](evidence/phase5b/admin-dashboard/after-next-admin-data-light-390-csszoom1-stats.png), [oscuro/CSS zoom2](evidence/phase5b/admin-dashboard/after-next-admin-data-dark-390-csszoom2-stats.png); misma fixture agregada, cinco campos comprobados también contra API real. DONE datos probados; no nueva clínica ni igualdad de composición. |
| Datos app_admin | Administradores/catálogo/comunicaciones y análisis global; sin crear estudiante en dashboard. Contador de comunicación en AppBar y tarjeta. | [Acciones](evidence/phase5b/admin-dashboard/after-next-app_admin-data-light-390-csszoom1-actions.png), [análisis oscuro](evidence/phase5b/admin-dashboard/after-next-app_admin-data-dark-390-csszoom1-stats.png). Permisos reales403/200 de cuentas según rol; estudiante403 de estadísticas. Next adapta búsqueda de comunicaciones al rol; contador visible en navegación, no en la tarjeta. DONE sin ampliar capacidades; solo difiere la ubicación del contador. |
| Loading/cero | AsyncValue spinner/cero; gráficos se omiten según datos; sin inventar nueva semántica de vacío | Skeleton/placeholder y ceros/Sin datos.; navegación permanece, refresh disabled/aria-busy. DONE representaciones controladas; transporte/dispositivo físico UNKNOWN. |
| Error / recuperación | [Antes](evidence/phase5b/admin-dashboard/before-flutter-app_admin-error-dark-390-text1-content.png), [después](evidence/phase5b/admin-dashboard/after-flutter-app_admin-error-dark-390-text1-content.png): seguro y Reintentar, mismo provider; mensaje export seguro | QueryError por HTTP, reintento/doble refresh; **todo gráfico anterior oculto después de403**. DONE en tests/E2E; errores503/403/401 controlados no son prueba de infraestructura/auth nueva. |
| Semestre y navegación | _openStudents incluye filtro; State mantiene al volver | Todos los cinco enlaces conservan semestre, incluido Totales. DONE enlaces; **B5-A06 DONE en continuación URL abajo**: filtro dashboard conserva opciones actuales con reload/back/deep-link. Opciones Flutter10/Next12/API20: **UNKNOWN** política institucional, no cambiar. |
| Responsive / capas |32 referencias:390,claro/oscuro,TextScaler1/2,datos/cero/loading/error,ambos roles |48 escenarios390 CSS zoom1/2 y1280,ambos temas/roles; de536/445 a390 solicitado, sin labels recortadas. minmax grid/reflow local y capa del shell solo /admin; no esconder texto para aprobar. DONE simulación; zoom nativo/dispositivo UNKNOWN. |
| Ranking / accesibilidad | Flutter muestra3 inicialmente, filtra total0, nombres con ellipsis, desempate por total | Next mantiene3 admin/4 global; aria-expanded/controls y Enter/colapso. DONE acción/semántica probada; diferencias de ranking conservadas y texto largo/reader/contraste de gráficos pendientes. Ninguna nueva política clínica. |
| Export / sesión | Callback/provider original; error no interpola excepción. Tooltip Notificaciones conserva destino | Función CSV original, nombre accesible;401→login usa auth existente. DONE regresiones acotadas; descarga nativa/expiración criptográfica no acreditadas aquí. |

[Hallazgos, pruebas y rollback](../audits/phase5b-implementation.md#continuación--dashboard-administrativo-b5-a01-a-b5-a05).64 capturas Flutter before diagnósticas,64 nuevos goldens y96 Next; captura diagnóstica Next intermedia de445 no acredita PASS. Next245/Flutter160 PASS; E2E específico1 PASS,41,15 s; backend/PostgreSQL final392 PASS/3 SKIP con siete E2E; lint/typecheck/webpack/analyze/formato PASS. [Índice/hash](evidence/phase5b/admin-dashboard/capture-index.json), [mediciones web](evidence/phase5b/admin-dashboard/next-measurements.json), [contraste del nuevo reintento17,06 claro/12,98 oscuro](evidence/phase5b/admin-dashboard/flutter-measurements.json). Tres migraciones omitidas por falta de otras bases aisladas, SKIP y no PASS; sin nuevas migraciones. **Dashboard integral PARTIAL / FASE5B PARTIAL**. UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL; sin commit.


## Continuación — B5-A06 conservación de semestre

| Criterio | Flutter / referencia | Next / evidencia y límite |
|---|---|---|
| Abrir estadística y regresar | Test nuevo en pantalla real: Semestre3 se conserva al push/pop de las5 tarjetas; params active/scheme/semester y nueva consulta preservados | E2E real: link Totales→lista filtrada3→history.back restaura dashboard3 y cinco contadores de API. DONE específico. No navegación virtual/deep links móvil nuevos. |
| Reload / deep link | State móvil no define URL web; no inventar deep link Flutter | /admin?semester=3 carga únicamente ese filtro, recarga conserva, sin petición inicial de Todos en componente. DONE específico, build webpack con Suspense PASS. |
| Cambios e historial | Selección móvil existente, mismo provider | router.push sin scroll:1→3→atrás→adelante, query/selector/enlaces coinciden con URL; Todos escribe /admin. DONE componente/Chrome. Enlace directo de shell /admin representa Todos; no preferencia global almacenada. |
| Respuesta tardía | No cambio de provider/cache móvil ni validación de identidad nueva | Componentes: éxito y403 antiguos no sobrescriben query vigente; Chrome retiene GET1 e inyecta agregado sintético777, UI3 sigue coincidiendo con backend real. DONE carrera de semestre; cambios de cuenta fuera de esta prueba. |
| Export / roles | Callback CSV original | Exportación usa semestre restaurado en componentes. app_admin sigue global, estudiante403 real de estadísticas y AuthGate lo devuelve a estudiante. DONE controles existentes, sin nuevo protocolo auth ni descarga nativa probada. |
| Opciones / entrada no soportada | Flutter1–10 intacto | Next1–12 intacto, backend1–20 intacto. Parser acepta un único valor exacto del selector; duplicados/formato no canónico/fuera de opciones muestranTodos. **B5-A07 UNKNOWN** institucional; no convertir esto en validación backend. URL de selección nueva no reenvía search/returnTo/arbitrarios. |

[Pruebas/entorno/rollback](../audits/phase5b-implementation.md#continuación--b5-a06-contexto-de-semestre-del-dashboard), [8 casos E2E](evidence/phase5b/dashboard-context/results.json). Solo metadatos sintéticos de navegación, sin capturas nuevas/PII/tokens. B5-A06 DONE en opciones actuales: Next286 PASS/lint/typecheck/webpack PASS; Flutter161 PASS/analyze/formato PASS; backend/PostgreSQL396 PASS/0 SKIP, incluidos ocho E2E y tres pruebas de migración existentes. E2E contexto1 PASS y referencia Flutter39 PASS. [Índice/hash](evidence/phase5b/dashboard-context/evidence-index.json). Sin migraciones nuevas ni cierre institucional de T-02/T-03. **FASE5B PARTIAL**; UI-16/UI-17 BLOCKED, T-02/T-03 PARTIAL. Sin commit.

## Continuación — comunicaciones, interlocutor B5-C01

| Estado / capacidad | Flutter / autoridad | Next / evidencia y límite |
|---|---|---|
| Conversaciones entrantes y salientes | _ThreadTile._participant y _ThreadHeader._participant excluyen al usuario actual; FastAPI devuelve participantes autorizados | communicationPeer aplica ese mismo orden a lista y encabezado. Cuatro pares de roles, dos perspectivas cada uno. **DONE** representación funcional específica; no cambio de destinatarios/permisos. |
| Relaciones legacy / nullability | recipient o created_by pueden ser null; student no identifica siempre a un estudiante | Diez fixtures compartidos, veinte tests de pantallas Flutter y veinte de componentes Next. Casos sin recipient o sin creador con otro participante identificable. **DONE** para esos casos; sin otro participante identificable **B5-C02 UNKNOWN**, preservar fallback actual. |
| Lista → detalle → reload | Widgets reales muestran el mismo interlocutor para cada fixture | Ocho perspectivas Chrome sobre Next production/FastAPI/PostgreSQL; URL únicamente con ID del hilo. **DONE** para identidad representada en navegación/recarga; no nueva validación del contexto completo de filtros. |
| Permisos | FastAPI decide acceso por participante/ámbito, no por helper de UI | Estudiante recibe403 al leer y cambiar estado de conversación administrativa ajena, con CSRF válido. **DONE** prueba de control existente; helper no concede acciones. |
| Claro, móvil390, datos sintéticos | Referencia funcional por widgets, sin nueva golden pareada | [Lista](evidence/phase5b/communications-peer/next-list-student-light.png), [detalle](evidence/phase5b/communications-peer/next-detail-student-light.png). Se inspeccionó el interlocutor; **UNKNOWN** paridad visual integral. Decoración se superpone al compositor: **B5-C03 PENDING**, no corregido ni ocultado como PASS visual. |
| Loading / empty / error / success / sesión expirada | Pantallas/providers inspeccionados; suites existentes conservadas | Este bloque prueba success/participantes y conserva regresiones de5A; no agrega ni acredita toda combinación visual de esos estados. **UNKNOWN** capturas pareadas y lectura por lector real. |
| Crear / responder / cerrar / reabrir / marcado de lectura | Contratos actuales de Flutter y FastAPI | Siete tests existentes de comunicaciones pasan junto a los nuevos. No modificar mutaciones, confirmations, polling, draft, fechas, read sync ni destinatarios. Comparación visual/teclado integral pendiente. |

[Resultados de navegador](evidence/phase5b/communications-peer/results.json) contienen roles, booleanos y códigosHTTP; no IDs/cookies/tokens ni información clínica. Capturas solo sintéticas. [Auditoría y gates](../audits/phase5b-implementation.md#continuación--b5-c01-interlocutor-de-comunicaciones). **FASE5B PARTIAL**; UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL. No commit.

**B5-C01 DONE** dentro de los casos descritos: veinte pruebas Next nuevas y veinte Flutter sobre el fixture común, E2E específico1 PASS con ocho perspectivas. Gates finales: backend/PostgreSQL397 PASS/0 SKIP con nueve E2E y tres migraciones existentes; Next306 PASS/lint/typecheck/build webpack PASS; Flutter181 PASS/analyze/formato PASS. [Índice/hash](evidence/phase5b/communications-peer/evidence-index.json). B5-C02 UNKNOWN y B5-C03 PENDING conservados; no migraciones nuevas ni cierre visual/institucional.

## Continuación — comunicaciones, capas B5-C03

La etiqueta PENDING de B5-C03 de la sección anterior corresponde a la evidencia previa. La nueva corrección solo amplía el contexto de apilamiento del shell a comunicaciones; no modifica datos, acciones, reglas o diseño del PDF/QR.

| Pantalla / estado | Flutter / referencia | Next / evidencia y límite |
|---|---|---|
| Detalle con datos, compositor y feedback | Scaffold/Column/_Composer sobre su superficie; pantallas reales conservan los20 tests de interlocutores, sin cambios productivos | [Antes admin claro390](evidence/phase5b/communications-layers/before-admin-detail-light-390.png): círculo encima del pie. [Después](evidence/phase5b/communications-layers/after-admin-detail-light-390.png): tarjeta delante de decoración. Muestreo previo4/57 diferencias; posterior0. Corrección técnica de capas comprobada. |
| Lista y detalle, claro/oscuro | Mismas capacidades móviles; no nueva golden pareada ni composición idéntica declarada | Tres roles×dos pantallas×dos temas×cuatro anchos=48 escenas. position/z-index reales,2736 puntos del interior opaco sin diferencia. [Estudiante oscuro](evidence/phase5b/communications-layers/after-student-detail-dark-390.png), [lista admin claro](evidence/phase5b/communications-layers/after-admin-list-light-390.png). Se inspeccionaron capturas; no todos los píxeles, contrastes ni estados. |
| Reflow320/390/768/1440 | Validación nativa/dispositivos UNKNOWN | Sin overflow horizontal ni recorte decorativo/aria-hidden del contenido, paneles muestreados visibles. Conserva scroll y header sin añadir overflow. No prueba zoom nativo, teclado virtual ni todas las longitudes de texto. |
| Teclado / intención | _Composer conserva escritura/envío actuales | Escribir borrador y Tab a Enviar en detalle, por rol/tema; no se envía por recorrer controles. Red:0 mutaciones de mensaje/estado/revisión por esa interacción. Test de componente conserva feedback y botón separado. Sin cambio de mutación ni auth. |
| Alcance de rutas | No equivalente móvil para condición de URL web | Listas/detalles/barra final y capas anteriores comprobadas; prefijos communications-old/communications-extra y otras rutas conservan política previa. No ampliar el cambio a todo AppShell ni al fondo compartido. |
| Loading / empty / error / sesión expirada / contraste de burbujas | Implementaciones inspeccionadas y regresiones existentes conservadas | **UNKNOWN** comparación visual completa por tema/rol; este bloque no la cierra. B5-C02 UNKNOWN sigue separado de capas. |

[Mediciones anteriores](evidence/phase5b/communications-layers/before-measurements.json), [48 escenas posteriores](evidence/phase5b/communications-layers/after-measurements.json), [auditoría y gates finales](../audits/phase5b-implementation.md#continuación--b5-c03-capas-de-comunicaciones). JSON solo geometría/colores/roles/booleanos; capturas solo sintéticas. Gates Next323 PASS/lint/typecheck/webpack PASS y Flutter181 PASS/analyze PASS. No cambios de backend funcional, Flutter funcional o migraciones. **FASE5B PARTIAL**; UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL. No commit.

**B5-C03 DONE** para las capas/escenas comprobadas. Backend/PostgreSQL398 PASS/0 SKIP,27 warnings,332,82 s; diez E2E y tres migraciones existentes. [Índice/hash](evidence/phase5b/communications-layers/evidence-index.json). Antes4/57 puntos alterados; después0/2736. Sin nueva golden Flutter ni paridad visual integral declarada. B5-C02/B5-A07 UNKNOWN, estados completos y validación nativa pendientes. Fase5B PARTIAL. Sin commit.

## Continuación — comunicaciones, lectura C04 y contraste C05

| Pantalla / estado | Flutter / referencia | Next / evidencia y límite |
|---|---|---|
| Mensaje propio enviado | Pantalla real/AppTheme/Inter local: [antes claro](evidence/phase5b/communications-recovery/before-flutter-detail-light-sent-390.png), [después](evidence/phase5b/communications-recovery/after-flutter-detail-light-sent-390.png). Nombre/cuerpo pasan2,642→7,947:1; fecha2,166→7,947:1. Fondo y layout intactos | [Antes](evidence/phase5b/communications-recovery/before-next-admin-messages-light-390.png), [después](evidence/phase5b/communications-recovery/after-next-admin-messages-light-390.png). Blanco fijo→negro, mismo fondo/forma/alineación. Claro7,947:1 y oscuro comprobado con CSS real; solo mensaje propio, no todos los controles/avatares. |
| Envío pendiente | [Claro](evidence/phase5b/communications-recovery/after-flutter-detail-light-pending-390.png), [oscuro](evidence/phase5b/communications-recovery/after-flutter-detail-dark-pending-390.png). Recorrido optimista real, Opacity0,72; composición con scaffold da4,558/4,578:1 en tres textos. Dos tests/cuatro goldens nuevas; fuentes locales | Next conserva el contrato existente sin burbuja optimista nueva. No añadir equivalencia de comportamiento inventada. Dispositivos/texto ampliado UNKNOWN en estas capturas. |
| Marcado de lectura / retry | Contrato existente markCategoryRead communication; no cambiar proveedor/autoridad | Un coordinador por instancia/marcador, error visible durante retry, disabled/aria-busy y una llamada ante dos clics. [Retry estudiante](evidence/phase5b/communications-recovery/after-next-student-read-retry-pending-light-390.png). Liberación continúa al backend real; confirma categoría leída y conserva borrador. |
| Respuestas tardías | No nuevos cambios de cache/auth Flutter | Componentes con QueryClient real: marcador posterior, hilo, identidad, unmount y StrictMode con cache. Viejo resultado no borra error nuevo ni invalida cache de contexto posterior. No prometer exclusión entre pestañas ni cancelación retroactiva del servidor. |
| Loading / empty / error / success | Flutter mantiene sus pantallas/polling. **Pendiente** comparación/capturas de carga, vacío, error y recuperación |40 casos Chrome: admin/student×temas×lista/detalle×loading/empty/403/404/503. Respuestas controladas explícitas; retry termina con FastAPI/PostgreSQL real. messages=[] muestra No hay mensajes; no estado clínico nuevo. **B5-C06 PARTIAL**, cobertura Next no cierra Flutter. |
| Retry de consulta con/sin cache | No cambio de lectura móvil | Sin cache vuelve a LoadingState; con cache el error/control queda ocupado y evita reiniciar petición. Los datos no se representan como lista vacía tras error ni se conservan visibles ante denegación. Formulario/borrador preservados.27 tests nuevos, más27 existentes=54 focalizados PASS. |
| Autorización y sesión | FastAPI sigue siendo autoridad; sin nuevos protocolos | Estudiante obtiene403 real al consultar estadísticas administrativas.401 controlado al final activa redirección de sesión existente y retira contenido protegido. Recorrido de estados/lectura:0 mensajes/estados/revisiones no previstos. App_admin cubierto por componente y regresiones de backend, sin afirmar una captura nueva por cada estado de ese rol. |

[47 casos web](evidence/phase5b/communications-recovery/after-next-measurements.json), [mediciones Flutter](evidence/phase5b/communications-recovery/after-flutter-measurements.json), [índice/hash](evidence/phase5b/communications-recovery/evidence-index.json), [causas/pruebas/rollback](../audits/phase5b-implementation.md#continuación--b5-c04c05-recuperación-de-lectura-y-contraste-de-mensajes).53 PNG sintéticos, cuatro nuevas goldens Flutter aisladas; no modificar referencias anteriores. No cambios de backend funcional, contratos, permisos, auth, clínica o migraciones. Next350 PASS/lint/typecheck/webpack PASS y Flutter183 PASS/analyze/formato PASS; backend/PostgreSQL399 PASS/0 SKIP,51 warnings,350,54 s,once E2E y tres migraciones existentes. **C04/C05 DONE en sus alcances; C06 PARTIAL; FASE5B PARTIAL**. C02/A07 UNKNOWN; UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL. Sin commit.

## Continuación — C06 estados de comunicaciones Flutter

Estado vigente:C06 **DONE para los estados/recuperación probados**; esta sección sustituye su PARTIAL histórico anterior. **FASE5B PARTIAL**. No igualdad de píxeles ni cierre general de accesibilidad.

| Pantalla / estado | Flutter | Next / comparación |
|---|---|---|
| Lista/detalle:loading | Petición retenida, spinner existente;3 roles×2 temas×2 pantallas. [Estudiante detalle](evidence/phase5b/communications-states/flutter-student-dark-detail-loading-390.png) | Chrome controlado [detalle oscuro](evidence/phase5b/communications-recovery/after-next-student-detail-hold-dark-390.png). Misma ausencia de contenido todavía no recibido; no backend falso declarado real. |
| Lista vacía | No hay conversaciones, sin convertir error en vacío. [Claro](evidence/phase5b/communications-states/flutter-student-light-list-empty-390.png) | [Claro](evidence/phase5b/communications-recovery/after-next-student-list-empty-light-390.png). FAB/crear y permisos existentes conservados. |
| Detalle vacío | Nuevo No hay mensajes con compositor vigente. [Claro](evidence/phase5b/communications-states/flutter-admin-light-detail-empty-390.png) | [Claro](evidence/phase5b/communications-recovery/after-next-admin-detail-empty-light-390.png). messages=[] no inventa estado clínico. |
| Errores HTTP |401/403/404/429/500/503 con texto seguro y reintento; body diagnóstico nunca visible. [Oscuro](evidence/phase5b/communications-states/flutter-student-dark-detail-error-390.png) | Mismos textos de QueryError. [Oscuro503](evidence/phase5b/communications-recovery/after-next-student-detail-503-dark-390.png). Flutter usa controles/material y superficie del tema; no copiar decoración web. |
| Refresh denegado | Tras403 retira mensajes/compositor/acción de estado; retry recupera el borrador sin enviar ni cambiar estado. Widget específico PASS | El componente y Chrome previos ya retiran datos ante error. Backend sigue decidiendo permisos; el widget con Dio controlado no sustituye RBAC real. |
| Retry de consulta | Una solicitud ante doble invocación antes del frame; spinner durante GET. TTL no bloquea recuperación tras refresh ni creación fallida. [Pendiente](evidence/phase5b/communications-states/flutter-student-light-detail-retrying-390.png) | Componentes verifican loading sin cache/control ocupado con cache. No nueva captura de cada query-retry web; diferenciarla del retry de lectura. |
| Retry de lectura | Fallo separado de GET, conserva hilo/borrador; botón ocupado, doble clic=una escritura. Polling del mismo marcador no descarta éxito; sin enviar/cerrar/revisar | C04 existente conserva la misma categoría communication. Tres roles por componente y dos recorridos web con respuesta final FastAPI/PostgreSQL. No exclusión entre distintas vistas/pestañas. |
| Success y roles |60 referencias390×844 AppTheme/Inter offline:student/admin/app_admin,2 temas,2 pantallas,5 estados. [App_admin lista oscura](evidence/phase5b/communications-states/flutter-app_admin-dark-list-success-390.png) | [App_admin lista oscura](evidence/phase5b/communications-layers/after-app_admin-list-dark-390.png). Fixture app_admin conversa con admin; no elegir destinatario fuera de permisos. Estados web app_admin sin captura propia quedan explícitos en manifest. |
| Respuestas tardías | GET fallido anterior no sustituye envío confirmado; lectura comprueba usuario/hilo/marcador/mounted, separado de la secuencia de GET | Sin cambios de auth/API/Next; conserva los controles de C04 y Fase2. Capturas no demuestran por sí mismas logout nativo ni respuestas entre cuentas. |

[60 casos anotados, con null cuando falta captura web correspondiente](evidence/phase5b/communications-states/parity-cases.json),[índice y hashes](evidence/phase5b/communications-states/evidence-index.json),[causas,30 tests nuevos,gates y rollback](../audits/phase5b-implementation.md#continuación--b5-c06-estados-y-recuperación-de-comunicaciones-flutter). Flutter213 PASS/analyze/formato PASS;Next350 PASS/lint/typecheck/webpack PASS;backend/PostgreSQL399 PASS,0 SKIP,51 warnings,360,26 s,once E2E y tres migraciones existentes. Resultados y límites en el informe enlazado. No regenerar referencias Flutter anteriores.

UNKNOWN:lectores/zoom/teclado virtual/dispositivos y contraste/composición global. Otras pantallas PARTIAL;C02/A07 UNKNOWN;UI-16/UI-17 BLOCKED;T-02/T-03 PARTIAL. Sin cambios de backend,contratos,clínica,migraciones,PDF/QR,Maps,Azure ni commit.

## Continuación — S08 perfil estudiante P01/P02

| Estado / dimensión | Flutter / referencia | Next / evidencia y límite |
|---|---|---|
| Primera carga | Antes,ProfileState vacío llegaba a profile! antes de microtask;10 tests reprodujeron null check. Ahora [loading claro](evidence/phase5b/student-profile/flutter-light-loading-390.png) y [oscuro](evidence/phase5b/student-profile/flutter-dark-loading-390.png) hasta recibir GET. **P01 DONE** | [Loading claro](evidence/phase5b/student-profile/after-next-loading-light-390.png). Estado existente,QueryClient real y CDP controlado;sin inventar datos. |
| Campos ausentes | [Ausencias](evidence/phase5b/student-profile/flutter-light-absent-390.png):profile:null,No registrado,sin datos inferidos | [Ausencias](evidence/phase5b/student-profile/after-next-absent-light-390.png):mismos grupos/placeholder,correo sintético;no confundir error con ausencia. |
| Error/retry inicial | [Error](evidence/phase5b/student-profile/flutter-dark-error-390.png),[reintento](evidence/phase5b/student-profile/flutter-dark-retrying-390.png). ProfileNotifier real,Dio controlado;sin nuevos contratos de error | [Error503](evidence/phase5b/student-profile/after-next-503-dark-390.png). Componentes401/403/404/429/500/503 seguros;con cache,error ocupado y doble retry comparte un GET. CDP403/404/429/503 libera recuperación real. |
| Identidad/textos largos | [Claro320](evidence/phase5b/student-profile/flutter-light-data-320-text1.png):nombre/correo completos,wrap Material existente | [Antes320](evidence/phase5b/student-profile/before-next-data-light-320-csszoom1.png):viewport672,scroll672,recortes. [Después320](evidence/phase5b/student-profile/after-next-data-light-320-csszoom1.png):viewport/scroll320,cero recortes. Nombre/correo/valores no truncados;sin cambiar paleta o tipografía. **P02 DONE en escenas probadas**. |
| Datos completos y scroll | [Detalle390,texto2](evidence/phase5b/student-profile/flutter-dark-details-390-text2.png). Programa/campus y resto de datos accesibles por scroll | [Lectura390,zoom2](evidence/phase5b/student-profile/after-next-data-dark-390-csszoom2.png). CSS local refluye por contenedor;no ocultar horizontalmente ni reducir fuente. |
| Edición/locked fields | Campos contacto/EPS/emergencia editables;la condición de carga es el único cambio de fuente Flutter. Edición nativa/guardado fallido no se cierran aquí | [Edición768,zoom2](evidence/phase5b/student-profile/after-next-editing-light-768-csszoom2.png). Cuatro inputs/labels,payload original sin sexo/programa/campus. Cancelar/fracaso PUT con GET exitoso conserva borrador y restaura valores en siguiente edición por componente. |
| Shell por espacio disponible | Navegación nativa no modificada | Container queries solo pathname=/student/profile;nav móvil/cabecera compacta cuando faltan48rem,contenido sobre decoración. El primer fix local todavía falló768/zoom2;se mantuvo el escenario y se corrigió la ruta acotada. Otras rutas/prefijos conservan clases;test de capas actualizado para nuevo alcance explícito. |
| Permisos,éxito y sesión | Interceptor/roles originales;widgets no demuestran backend nativo | FastAPI/PostgreSQL reales:GET administrativo403;doble submit=un PUT de contacto y GET confirma nuevo teléfono sintético.401 controlado usa logout/redirección existentes y retira contenido;sin modificar autenticación. |
| Datos anteriores/borrador en refresh | Error de recarga con profile previo y PUT→GET fallido requieren regresiones separadas;no afirmar que quedan cubiertos por el cold-load | **P03 PARTIAL**:al devolver QueryError se desmonta ProfileView;probar edición/refresh fallido y conservación de borrador en bloque propio. No afirmar fuga entre cuentas ni cambiar clínica/autenticación por esta observación. |

[14 pares anotados](evidence/phase5b/student-profile/comparison-cases.json),[46 registros CDP](evidence/phase5b/student-profile/after-next-measurements.json),[índice/hash](evidence/phase5b/student-profile/evidence-index.json),[causas/gates/rollback](../audits/phase5b-implementation.md#continuación--perfil-estudiante-s08-p01p02).24 referencias Flutter nuevas,44 capturas Next posteriores y1 anterior;datos compartidos explícitamente sintéticos example.invalid.32 escenas web de datos/edición sin recorte ni overflow a320/390/768/1440,CSSzoom1/2,temas opuestos al SO. Flutter320/390,TextScaler1/2,temas claros/oscuros;no igualdad de píxeles ni zoom nativo.

Next368 PASS/lint/typecheck/webpack PASS;Flutter223 PASS/analyze/formato PASS;backend/PostgreSQL400 PASS,0 SKIP,51 warnings,370,59s,doce E2E y tres migraciones existentes. E2E específico1 PASS,19,99s. **S08 y FASE5B PARTIAL**,P01/P02 DONE en lo demostrado,P03 pendiente. S22/firma administrativa no cambia. UI-16/UI-17 BLOCKED;C02/A07 UNKNOWN;T-02/T-03 PARTIAL. Sin migraciones,backend funcional,clínica,PDF/QR,Maps,Azure ni commit. Contraste global de gradient/iconos,lectores,teclado virtual y dispositivos UNKNOWN.

## Continuación — P03 refresco de perfil y conservación de borrador

Estado vigente:**P03 DONE en recorridos probados;S08/FASE5B PARTIAL.** Sustituye la etiqueta histórica P03 PARTIAL del bloque previo. No cerrar S22/firma ni UI-16/UI-17.

| Recorrido / dimensión | Flutter | Next / comparación |
|---|---|---|
| GET fallido con perfil previo | Retirar cuerpo/formulario/editar,mostrar error seguro y retry;controllers permanecen en la vista. GET401/403/503×lectura/edición verificados | ProfileView mantiene hooks/draft,pero devuelve solo feedback/QueryError;no valores ni acciones visibles ante fallo. Retry devuelve al mismo modo de edición y valor del borrador. No PUT por recuperar GET. |
| PUT confirmado+GET403 | Guardar response PUT y conservar error,saveConfirmed explícito. [Oscuro](evidence/phase5b/profile-recovery/flutter-saved-get403-dark-390.png) | [Oscuro](evidence/phase5b/profile-recovery/next-saved-get403-dark-390.png). Aviso Los cambios se guardaron,pero no se pudo actualizar el perfil;no toast de éxito simple ni cache visible ante403. E2E PUT real+GET controlado y retry real confirma valor,sin nuevo PUT. |
| PUT confirmado+GET503 | [Claro](evidence/phase5b/profile-recovery/flutter-saved-get503-light-390.png). No borrar error al terminar isSaving,ni quedarse en loading | [Claro](evidence/phase5b/profile-recovery/next-saved-get503-light-390.png). Retirar invalidación local duplicada del perfil;helper safe-mutation global intacto. Aviso se retira tras GET exitoso,incluso con datos idénticos. |
| PUT fallido+GET denegado | [Oscuro](evidence/phase5b/profile-recovery/flutter-failed-put-get403-dark-390.png). Separar saveError/error,conservar controllers y declarar que no se pudo guardar | [Oscuro](evidence/phase5b/profile-recovery/next-failed-put-get403-dark-390.png). GET retry recupera formulario/borrador,sin nuevo PUT;solo Guardar explícito escribe. PUT503 controlado y guardado posterior real en E2E. |
| Respuestas antiguas / doble acción | GET anterior no ocupa ranura de retry ni sobrescribe estado de PUT/GET posterior;dispose ignora resultados. Cancelar y campos bloqueados durante PUT;guardia contra doble save | Helper existente descarta GET anterior y callbacks de otro owner;12 pruebas nuevas de componente,QueryClient real. Un error posterior no reutiliza aviso viejo después de un GET exitoso;sin efecto setState redundante. |
| Ausencias tras cancelar | Recibir después profile:null y empezar nueva edición limpia todos los controllers según respuesta actual;no reintroducir borrador abandonado. Regresión FAILED→PASS | startEdit ya rellena de datos actuales/valores vacíos;contrato null existente sin cambios. No rellenar en background sobre un borrador activo. |
| Permisos / expiración | Unit401 usa Dio controlado para aislar UI;no demuestra restauración de borrador después de expirar. Provider por identidad/interceptores existentes no se modifican | E2E demuestra403 administrativo real y401 controlado con retirada de contenido/redirección existentes. Borrador solo en memoria de la vista/sesión;no restaurar a otra cuenta,tras logout,cierre o recarga. |

[Seis pares anotados](evidence/phase5b/profile-recovery/comparison-cases.json),[11 registros E2E P03](evidence/phase5b/profile-recovery/next-measurements.json),[índice/hash](evidence/phase5b/profile-recovery/evidence-index.json),[causas,archivos,pruebas y rollback](../audits/phase5b-implementation.md#continuación--p03-recuperación-de-perfil-y-borrador).6 nuevas goldens Flutter y10 capturas Next390,temas claros/oscuros,datasets sintéticos;sin igualdad de píxeles ni accesibilidad nativa integral. Ninguna referencia Flutter anterior regenerada.

18 nuevas pruebas Flutter y12 Next. Gates:Flutter240 PASS/analyze/formato PASS;Next380 PASS/lint/typecheck/webpack PASS;backend/PostgreSQL401 PASS,0 SKIP,51 warnings,396,91s,trece E2E y tres migraciones existentes. Tras build final se repiten P03 y P01/P02:2 E2E PASS/37,52s. Sin backend funcional,contratos,clínica,auth,migraciones,CSS o capacidades de firma/certificado nuevas.

Pendientes:otras pantallas y comparación integral S08/S22;lectores,zoom real,teclado/dispositivos y contraste global UNKNOWN. C02/A07 UNKNOWN;UI-16/UI-17 BLOCKED;T-02/T-03 PARTIAL,almacenamiento real pendiente. **FASE5B PARTIAL**,sin producción lista ni commit.

Revalidación S08 (2026-10-26): Next `phase5b-student-profile.test.tsx` + `phase5b-profile-recovery.test.tsx` **23 PASS**; Flutter `phase5b_profile_recovery_test.dart` **17 PASS**. Los gates son focales; no reejecutan P01/P02 goldens ni E2E/PostgreSQL. P01/P02/P03 permanecen DONE en los recorridos previamente documentados; pantalla S08/Fase5B siguen PARTIAL por paridad integral y validación física UNKNOWN.

## Continuación — E01 selección y envío de evidencias

Referencia S06:EvidenceUploadScreen Flutter;negocio,permisos y validación real en FastAPI. **E01 DONE en recorridos probados;S06/FASE5B PARTIAL.** No cambios de estados clínicos,API,PDF/QR ni UI-16/UI-17.

| Estado/acción | Flutter | Next | Evidencia / límite |
|---|---|---|---|
| Archivos seleccionados | Mantiene retirada individual;tooltip por archivo | Nueva acción Quitar por ocurrencia,sin POST ni DELETE;permite volver a seleccionar el mismo archivo | Componentes prueban duplicados del mismo nombre/tamaño y contenido diferente. No deduplicación inventada. |
| POST en curso | Selector,quitar,asociación,notas,enviar bloqueados;lista copiada al envío | Mismos controles bloqueados;variables de mutación capturan archivos/notas/dose | Widget/componentes y Chrome con petición retenida;doble submit produce un solo POST. |
| Error POST | Conserva selección/notas y libera controles | Conserva selección/notas/asociación y libera controles | DioException controlada;Chrome503 controlado seguido de carga real explícita. No prueba de fallo de infraestructura institucional. |
| Selector tardío/cancelado/fallido | Una instancia;epoch descarta resultados durante/después de envío;mounted protege dispose;error fijo seguro | Drop/change durante envío no reemplazan borrador | Flutter con plugin controlado;drop en Chrome. No se afirma prueba de diálogo nativo del sistema operativo. |
| Selección/envío,claro/oscuro,390 | Cuatro nuevas referencias con AppTheme/Inter locales | Cuatro capturas de tarjeta completa con build webpack real | [Cuatro pares anotados](evidence/phase5b/evidence-selection/comparison-cases.json),[índice](evidence/phase5b/evidence-selection/evidence-index.json). Diferencias declaradas:carga general Flutter,dosis sintética Next;6 vs33 bytes;no igualdad de píxeles. |
| POST confirmado+GET fallido | Evidencia de código:éxito puede limpiar fallo de refresco | No se cubre por éxito de carga con lectura posterior disponible | **B5-E02 PARTIAL**,recuperación independiente solo GET pendiente;no cerrar S06 ni atribuirla a E01. |
| Lector/zoom/teclado/dispositivo nativo | UNKNOWN | Sin declaración global por pruebas de Enter/labels | **UNKNOWN**. Tampoco cierre de contraste global,reflow o resto de listados/estados. |

Gates de selección:Next386 PASS/lint/typecheck/webpack PASS;Flutter253 PASS/analyze/formato PASS;E2E inicial1 PASS con PostgreSQL real. Backend/PostgreSQL402 PASS/0 SKIP,51 warnings,394,93s;14 E2E,concurrencia y tres migraciones existentes,sobre el build final y runner con tarjeta completa. Sin backend funcional,migraciones nuevas,cambios clínicos o commit. [Detalle/rollback](../audits/phase5b-implementation.md#continuación--e01-selección-y-envío-de-evidencias).

## Continuación — E02 carga confirmada y recuperación de consulta

**E02 DONE en recorridos probados; S06/FASE5B PARTIAL.** Referencia funcional: EvidenceUploadScreen y contrato actual de FastAPI. Sin cambios clínicos o de API.

| Estado/acción | Flutter | Next | Evidencia / límite |
|---|---|---|---|
| POST confirmado + GET fallido | loadError permanece; aviso de carga recibida; retira formulario/lista/acciones antiguas; limpia archivos ya enviados | Aviso persistente y toast warning; QueryError retira datos/acciones; limpia selección confirmada |6 códigos GET en tests de cada cliente. [Pares claro/oscuro503](evidence/phase5b/evidence-recovery/comparison-cases.json). |
| Reintentar lectura | GET compartido para misma página; target fallido conservado | refetch cancelRefetch:false; busy según isFetching | Doble click produce1 GET,0 POST. Componente/widget; Chrome real mantiene page2/tamaño20. |
| POST sin confirmar + GET fallido | Conserva selección/notas y error de escritura; lectura posterior explícita | Conserva archivos/notas/dosis y resultado no confirmado; refresh existente del helper |Pruebas y E2E503/403. Reintentar GET no envía; otro POST requiere acción explícita. No prueba de que un timeout no escribiera. |
| Lectura exitosa después del fallo | Retira uploadConfirmed, aun con mismos datos | Aviso asociado a página y dataUpdateCount | Test de fallo posterior no resucita aviso previo. No persistencia de borrador entre sesiones. |
| Respuesta anterior / dispose | Secuencia descarta GET anterior; slot de retry se libera al escribir; mounted protege finalización | Helper existente cancela GET antiguo antes/después de escribir |Tests con notifier/QueryClient reales y transporte controlado. Sin modificar auth de Fase2. |
| Permisos / expiración |401 aislado verifica mensaje; interceptores/hardware no probados por widget |403 administrativo real; GET401 controlado activa cierre de sesión existente |E2E Chrome/FastAPI/PostgreSQL. No ampliar permisos. |
| Representación de fallo, claro/oscuro390 |2 nuevas goldens con AppTheme/Inter |6 screenshots web y7 casos |[Índice](evidence/phase5b/evidence-recovery/evidence-index.json). Dos pares503, sin afirmar igualdad de píxeles o cobertura de todos los estados. |

Gates observados:Next395 PASS/lint/typecheck/webpack PASS;Flutter268 PASS/analyze/formato PASS;E2E específico1 PASS. Backend/PostgreSQL403 PASS/0 SKIP,51 warnings,433,61s;15 E2E,concurrencia y3 migraciones existentes sobre el artefacto final. [Causa raíz, comandos y rollback](../audits/phase5b-implementation.md#continuación--e02-resultado-de-carga-y-recuperación-de-evidencias). UI-16/UI-17 BLOCKED por alcance;T-02/T-03 PARTIAL;sin commit.

## Continuación — H01 recuperación del historial / H02 acceso app_admin

**H01 DONE en recuperación probada; S11/FASE5B PARTIAL.** Flutter referencia funcional inicial, FastAPI autoridad de visibilidad y permisos. No API ni dominio modificados.

| Estado/acción | Flutter | Next | Evidencia y límite |
|---|---|---|---|
| GET fallido con datos previos | Mensajes seguros por código; retira datos y metadata/paginador anteriores | QueryError ya retiraba lista/paginador; ahora busy visible al retry |6 códigos×3 roles en widget;6 códigos×2 ámbitos de página en componente. Sin diagnóstico crudo/empty falso. |
| Retry repetido | Future compartido y botón deshabilitado; página solicitada conservada | refetch cancelRefetch:false + isFetching |1 GET por doble click en widget/componente/Chrome; página2/tamaño20 se mantienen. |
| Refresco/paginación en curso | Guardia sincrónica impide doble salto de página en mismo frame; controles deshabilitados | isFetching bloquea botones de paginación y actualizar |No mutación de eventos, ni descarga de todas las páginas. |
| Loading y empty válidos |3 casos por rol; spinner y respuesta vacía distintos |2 casos por ámbito; Cargando y vacío distintos |Pruebas funcionales, sin capturas pareadas de cada combinación. |
| Error503,claro/oscuro390 |6 nuevas goldens:student/admin/app_admin |8 capturas:student/admin×403/503×temas |[Cuatro pares503](evidence/phase5b/history-recovery/comparison-cases.json);[índice](evidence/phase5b/history-recovery/evidence-index.json). Flutter fallo inicial vs Next refresco con datos previos;no igualdad de píxeles. |
| Permisos/ámbito |Widget verifica ruta /me o /admin según rol;no prueba del router ni permisos servidor |API real:student403 administrativo,admin sin evento fuera de ámbito,app_admin200 con evento según permiso vigente |FastAPI intacto;fixtures sintéticos. No nuevos derechos. |
| B5-H02:app_admin web |Router acepta deep link administrativo;capturas del widget aislado |RoleGuard plain_admin redirige a /admin;no nav de historial |**PARTIAL** divergencia funcional separada. E2E prueba bloqueo existente;sin par web para las2 imágenes nativas de app_admin. |
| Sesión expirada |401 aislado prueba mensaje, no interceptor móvil real |401 controlado usa expiración existente y retira contenido |Sin modificar autenticación de Fase2. Validación nativa UNKNOWN. |

Gates observados:Next411 PASS/lint/typecheck/webpack PASS;Flutter297 PASS/analyze/formato PASS;E2E final1 PASS/17,59s. Backend/PostgreSQL404 PASS/0 SKIP,51 warnings,452,11s;16 E2E,concurrencia y3 migraciones existentes. E2E final reforzado1 PASS/17,43s;observa documento de historial y redirección posterior de app_admin. [Causa raíz, entorno restaurado,comandos y rollback](../audits/phase5b-implementation.md#continuación--h01-recuperación-del-historial). H02/S11/Fase5B permanecen PARTIAL;UI-16/UI-17 BLOCKED;T-02/T-03 PARTIAL. Sin commit.


### Revalidación documental S11 — 2026-10-26

La matriz principal tenía afirmaciones obsoletas: ambos clientes ya usan endpoints paginados de20; Next ya representa error separado de lista vacía; la metadata/refresh funciona; y el detalle Next consume `tab`. Se repitieron las suites H01 existentes: **29 PASS Flutter**, **16 PASS Next**. No se repitió PostgreSQL/E2E en esta revalidación. Diferencias activas: la página es estado local Flutter y query param Next; app_admin web sigue bloqueado por guard según H02/decisión UNKNOWN. S11/R04 siguen PARTIAL por la comparación integral y validación física UNKNOWN.


## Continuación — S20/M01, creación de administradores

**M01 DONE en alta verificada;S20/FASE5B PARTIAL.** Solo formulario Next; sin backend/Flutter funcional, dominio, auth ni cambios institucionales.

| Estado/acción | Referencia Flutter actual | Next verificado | Evidencia/límite |
|---|---|---|---|
| Formulario vacío390,claro/oscuro |2 goldens nuevas con AppTheme/Inter local;nombre/apellido requeridos,ámbito por dropdown |2 capturas reales;form nombrado y labels conservadas;composición/altura distintas |[Dos pares anotados](evidence/phase5b/admin-create/comparison-cases.json). Sin igualdad de píxeles ni cierre visual. |
| Datos requeridos/correo |Valida antes de _create;tests sin POST ante campos faltantes |HTML form/required/email;click y Enter con validación nativa |E2E real sin POST inválido;Next nombres opcionales como FastAPI,no se copia obligatoriedad Flutter. |
| Contraseña corta |Valida longitud8 |minLength8 del contrato backend;browser usa Input.insertText para probar tooShort real |Widget sin POST;E2E sin POST.No cambio de política de autenticación. |
| Escritura pendiente |Referencia Flutter tiene botón deshabilitado;campos/cancelación y carreras no corregidos aquí |fieldset+cancelar/eliminar bloqueados;payload fijo;doble submit una petición |[Captura pendiente oscuro](evidence/phase5b/admin-create/next-pending-dark-390.png). No par nativo de escritura ni cierre de carreras Flutter. |
| Éxito |Backend autoritativo;sin integración nueva Flutter |Cuenta creada en PostgreSQL;un GET de refresco;limpia password y cierra form |[Captura éxito](evidence/phase5b/admin-create/next-success-dark-390.png). Caso confirmado+GET fallido pendiente M02. |
| Permisos |Referencia funcional app_admin;goldens no validan router |POST real:app_admin permitido;student/admin403 |Sin cambiar RoleGuard/endpoints/permisos. |
| Opcionales borrados |Nombres siguen requeridos por Flutter actual |Omite nombres/cargo vacíos,contrato acepta;conserva password exacta |11 tests Next;no hace obligatorios nombres permitidos como opcionales por API. |

Gates ejecutados:Next422 PASS/lint/typecheck/webpack PASS;Flutter301 PASS/analyze/formato PASS;E2E específico1 PASS/6,43s. Backend/PostgreSQL405 PASS/0 SKIP,51 warnings,456,40s;17 E2E,migraciones y concurrencia;incluye runner final con medición390.794 referencias SHA-256 válidas,0 desajustes. [Causas,pruebas,rollback y límites](../audits/phase5b-implementation.md#continuación--m01-alta-de-administradores-2026-10-21). [Índice](evidence/phase5b/admin-create/evidence-index.json);sin commit. Programa/campus por texto vsdropdown,empty/loading/error del listado,recuperación de escritura/lectura y accesibilidad nativa permanecen separados.


## Continuación — S20/M02, recuperación del listado Next

**M02 DONE en Next verificado;S20/M03/Fase5B PARTIAL.** Sin backend/Flutter funcional,clínica,auth o contratos modificados.

| Estado/acción | Flutter referencia actual | Next verificado | Límite |
|---|---|---|---|
| Vacío exitoso claro/oscuro390 |Goldens M01 existentes:vacío bajo formulario siempre visible |Mensaje explícito y acción crear;no tabla vacía sin explicación |[Dos pares](evidence/phase5b/admin-recovery/comparison-cases.json). Shell/exposición del formulario distintos,no igualdad de píxeles. |
| Carga inicial |Spinner existente |role=status;sin vacío ni alta antes de carga |Tests iniciales GET403/503 y vacío/carga.Sin captura nueva nativa. |
| Refresco pendiente |RefreshIndicator;coordinación de escrituras aún pendiente M03 |Actualizar lista deshabilita formulario/cancelar/crear/eliminar hasta GET final |Widget Next y E2E GET retenido.Sin coordinación entre pestañas. |
| GET fallido con datos |Código Flutter mezcla _error y lista/formulario,puede mostrar vacío/datos previos |Retira lista/formulario/acciones;error seguro401/403/404/429/500/503;retry comparte GET |M03 no corregido.No afirmar paridad del error nativo. |
| POST/DELETE confirmado + GET fallido |No separa confirmación de recarga en fuente inspeccionada |Aviso persistente de creado/eliminado;GET-only retry,sin repetir escritura |Backend real crea/elimina cuenta sintética en ambos temas;errores GET controlados. |
| Escritura fallida |M03 pendiente,error de transporte sin control en algunas ramas |Mensaje estático;no confirmación;recuperar GET conserva borrador y no reenvía |Cliente autoriza explícitamente otro submit.No idempotencia para timeout incierto. |
| Aviso y error posteriores |No verificado nativo |Aviso ligado a dataUpdateCount,no reaparece tras GET exitoso y posterior fallo ajeno |27 tests Next nuevos más regresiones del alta.Solo estado local. |
| Permisos/sesión |Router/interceptores sin cambios |app_admin opera;student/admin GET403;GET401 usa expiración existente |No amplía roles ni toca protocolo Fase2. |

Next449 PASS/lint/typecheck/webpack PASS;Flutter301 PASS/analyze PASS;E2E específico1 PASS/17,39s.Backend/PostgreSQL406 PASS/0 SKIP,51 warnings,474,91s;18 E2E,concurrencia y tres migraciones existentes.808 referencias SHA-256 válidas,0 desajustes. [Casos/índice](evidence/phase5b/admin-recovery/evidence-index.json),[causas y rollback](../audits/phase5b-implementation.md#continuación--m02-recuperación-de-administradores-next-2026-10-21). Sin nuevas goldens Flutter,migraciones o commit. M03 nativo,opciones/composición de S20 y accesibilidad integral siguen pendientes.


## Continuación — S20/M03, recuperación Flutter

**M03 DONE en recuperación probada;R01 DONE;S20/Fase5B PARTIAL.** Solo una fuente funcional Flutter.M02 Next se conserva como referencia.

| Estado/acción | Flutter M03 ejecutado | Next referencia M02 | Límite |
|---|---|---|---|
| GET fallido inicial/refresco |HTTP seguros;sin lista/formulario/vacío falso;retry comparte GET y deshabilita control |Mismo resultado seguro en componente y Chrome/PostgreSQL |[Cuatro pares](evidence/phase5b/admin-native/comparison-cases.json):Flutter inicial,Next refresco,no igualdad de píxeles. |
| Borrador tras lectura fallida |Controladores/programa/campus conservados en la instancia;se reconstruye formulario al recuperar |Mantiene borrador oculto hasta GET exitoso |Sin persistencia de contraseña ni nuevo protocolo de sesión. |
| POST/DELETE confirmado + GET fallido |Aviso específico;retry solo GET;aviso se invalida con lectura exitosa |Aviso ligado a versión de lectura y GET-only retry |Widgets nativos con Dio controlado;integración real de backend/Next ya existente,no E2E móvil. |
| Escritura fallida |Mensaje estático,sin diagnóstico;borrador conservado;nueva acción explícita |M02 muestra fallo seguro y conserva borrador |No idempotencia de red ante timeout incierto. |
| Petición pendiente/doble acción |Bloqueo de formulario/dropdowns/crear/eliminar/mensaje/refresh;doble POST/diálogo no duplica;cancelar no elimina |Controles bloqueados y confirmación existente |Coordinación local,no bloqueos distribuidos nuevos. |
| Respuesta después de dispose |Éxito y fallo GET/POST/DELETE sin acceso a state/controladores desmontados ni recarga nueva |M02 conserva helper de dueño de sesión |Interceptor de generación Flutter intacto;no se declara validación física de cambio de cuenta. |
| Formulario exitoso |Goldens M01 anteriores pasan sin regeneración;selecciones limpias después de creación confirmada |M01/M02 conservados |Nombres requeridos Flutter vs opcionales backend/Next y composición global siguen fuera del cierre M03. |

26 tests Flutter nuevos;327 PASS completo/analyze PASS;Next449 PASS/lint/typecheck/webpack PASS.Backend/PostgreSQL406 PASS/0 SKIP,51 warnings,491,20s;18 E2E web,migraciones y concurrencia.Repetición final Flutter327 PASS/18s,analyze4,2s;817 referencias SHA-256 válidas,0 desajustes. [Índice](evidence/phase5b/admin-native/evidence-index.json),[causas/rollback](../audits/phase5b-implementation.md#continuación--m03-recuperación-de-administradores-flutter-2026-10-21),[lista finita de cierre](../audits/phase5b-remaining-work.md). Sin migraciones nuevas ni commit.


## Continuación — R02A, recuperación/reset/cambio de contraseña

**R02A DONE en controles probados;R02/Fase5B PARTIAL.** [Cobertura explícita de sus siete pantallas y dimensiones](phase5b-r02-coverage.md).Autenticación/backend/contratos/validadores intactos.

| Estado/capacidad S02/S03/S09 | Flutter ejecutado | Next ejecutado | Evidencia/límite |
|---|---|---|---|
| Busy/doble submit |Guarda sincrónica,campos/toggles bloqueados,una petición |Ref de envío+fieldset,un POST por doble submit real de navegador |Widgets/32 tests Next yCDP;sin idempotencia de red nueva. |
| HTTP/red/timeout |Mensajes estáticos seguros;sin diagnóstico de API;draft conserva valores |400/401/403/422/429/500/503 y timeout diferenciados,sin CORS/Render/detail |400 reset inválido vs503 servicio;401 sesión distinta de400 contraseña actual.No envío de correo o cambio real en E2E nuevo. |
| Campos inválidos/éxito |Validadores existentes;success con transporte controlado;logout una vez en mismo orden |Aria-describedby de errores,token ausente sin petición,success condicional y logout→login |Conserva validadores/normalización/payloads;no prueba end-to-end real de recuperación de correo. |
| Dispose/respuesta tardía |Éxito/fallo sin setState/ref inválida;notifier de logout capturado antes de await |Mounted protege representación;se conserva logout y redirección |Generaciones/interceptores Fase2 intactos;no se inventa validación física de cambio de usuario. |
| Poco alto/ampliación |Scroll en forgot/change;390×568/TextScaler2 sin overflow y controles alcanzables |390 sin overflow horizontal;fieldset conserva composición |Requisitos nativos aún truncados en algunas capturas;R05 pendiente,no igualdad de píxeles. |
| Error503 claro/oscuro390 |6 nuevas goldens;error oscuro>=4,5 tras contraste previo3,87 |6 capturas finales;capas solo en dos rutas de cambio,controles ya no tapados |[Seis pares](evidence/phase5b/account-forms/comparison-cases.json),[índice](evidence/phase5b/account-forms/evidence-index.json).Resto de contraste/roles/estados físicos UNKNOWN. |
| Copy de cambio obligatorio |Indica contraseña temporal recibida por correo |Next ya tenía texto correcto,se conserva |No criterio nuevo de emisión de credenciales. |

Gates finales:Next485 PASS/lint/typecheck/webpack PASS;Flutter364 PASS/analyze/formato PASS.Backend/PostgreSQL407 PASS/0 SKIP,51 warnings,454,24s;19 E2E/migraciones/concurrencia sobre build previo a corrección de capas.E2E final específico sobre nuevo build1 PASS/5,67s más Next completo485 PASS;no atribuir407 al build posterior.831 referencias SHA-256 válidas,0 desajustes.[Causas,archivos,proveniencia y rollback](../audits/phase5b-implementation.md#continuación--r02a-formularios-de-cuenta-2026-10-21).Sin migraciones nuevas ni commit.S18/S22 yS00/S01 restantes dentro de R02;UI-16/UI-17 BLOCKED,T-02/T-03 PARTIAL.


## R02B — S18 alta/importación de estudiantes,2026-10-21

| Estado / dimensión | Flutter | Next | Verificación y límite |
|---|---|---|---|
| Vacío/validación | Conserva validadores actuales | Form/required/email nativos;botón asociado y Enter real | Widget/componente y Chrome;no nueva política clínica. |
| Envío/borrador | _busy desde antes de picker;campos bloqueados | Lock sincrónico común para3 operaciones y fieldset | Doble creación/preview/import bloqueada;sin idempotencia entre pestañas. |
| Preview | Diálogo existente y confirmación explícita | Panel inline existente;preview consumida por intento y retirada antes de releer | Archivo/bytes capturados,cuenta backend0 no confirma. Fallo de re-preview no conserva confirmación vieja. |
| Resultado/paginación | Resultado y LocalPagedList existentes | Resultado e invalidación useSafeMutation;panel nuevo a página1 | Sin nueva descarga/listado;API de archivo conserva su forma. |
| Error/lifecycle | HTTP seguro,borrador y mounted tras await | Mensaje seguro persistente,mounted y guard de propietario existente |18 tests Flutter y11 Next;transporte de widget controlado,no dispositivo real. |
| Datos/éxito | Datasource/payload existentes | Calendario YYYY-MM-DD intacto;create→detalle,import→resultado | E2E específico real PostgreSQL PASS;wrapper comprueba perfiles/ámbito. Correo/FCM deshabilitados. |
| Tema390 | Modal claro/oscuro | Inline claro/oscuro;contenido sobre decoración scoped |[Dos pares](evidence/phase5b/student-create/comparison-cases.json).No igualdad de píxeles;geometría integral y accesibilidad nativa UNKNOWN. |
| Permisos/sesión | Interceptores/rol conservados;widget401 | BFF/CSRF/guardas intactos | Backend408 PASS/0 SKIP con20 E2E;no ampliación de permisos. |

Controles B5-R02B01–R02B05 DONE en estados probados;Next499/Flutter382/backend408 PASS y gates.S18/R02/Fase5B PARTIAL. [Implementación y rollback](../audits/phase5b-implementation.md#continuación--r02b-altaimportación-de-estudiantes-2026-10-21). Firma/certificado excluidos;UI-16/UI-17 BLOCKED por alcance,T-02/T-03 PARTIAL.


### Revalidación S18 — alta/importación de estudiantes, 2026-10-26

Next `phase5b-student-create.test.tsx`: **11 PASS**; Flutter `phase5b_student_create_test.dart`: **18 PASS**. El runner Flutter requirió repetición autorizada fuera del sandbox por socket local. Se confirmó form submit/Enter y required, labels enlazados, bloqueo/doble submit, preview capturada con confirmación, errores seguros y lifecycle. Los dos clientes paginan localmente a20; Flutter lista solo filas por revisar en resultado, Next presenta todas. Next permite programa/campus como texto libre frente a opciones Flutter; no se inventa catálogo ni se altera el backend. E2E PostgreSQL previo queda como evidencia histórica y no se repitió; sin gates completos/cambio funcional. S18/R02/Fase5B PARTIAL por equivalencia de vocabulario, representación de filas, estados completos y accesibilidad física UNKNOWN.


### Revalidación S22 — perfil administrativo base, 2026-10-26

Next `phase5b-admin-profile.test.tsx`: **27 PASS**; Flutter `phase5b_admin_profile_test.dart`: **20 PASS**. El runner Flutter requirió repetición autorizada por socket local. Se comprobaron roles admin/app_admin, errores 401/403/503, retry, ocultación de datos obsoletos, borrador, PUT confirmado + GET fallido, retry solo de lectura, doble submit/lifecycle y temas390. Se actualizaron solo afirmaciones del perfil base; firma e imagen blob explícitamente excluidas y no verificadas aquí. Visual integral, lectores/hardware y validación institucional permanecen UNKNOWN; S22/R02/Fase5B PARTIAL.

### Revalidación S22 — reflow de valores extensos, 2026-11-05

Next conserva completos los valores del perfil y permite envolver nombre, correo, cargo, programa y sede. El runner standalone de Chromium inicia el build Next y sustituye únicamente las respuestas API con un perfil sintético; no usa login, BFF, base de datos ni cuentas. Viewports medidos: **320, 768, 1440 y 720 CSS px** (aproximación de reflow equivalente a 200% sobre 1440 px). En todos: `white-space: normal`, `overflow-wrap: break-word`, sin ellipsis, cada nodo sin scroll horizontal interno y ancho del documento dentro del viewport. [Mediciones sintéticas](evidence/phase5b/admin-profile-reflow/measurements.json). Flutter conserva wrap según su implementación y el test widget a 320 px/texto 2× pasa.

Next `phase5b-admin-profile.test.tsx`: **28 PASS**; Flutter `phase5b_admin_profile_test.dart`: **21 PASS**; Next lint/typecheck/build webpack y E2E Chromium: **PASS**. Estos resultados cierran solo el control de reflow de texto base. 720 CSS px es una equivalencia de ancho, no una prueba de zoom nativo. Firma/blob, lector real, teclado/dispositivo físico, contraste integral y comparación visual completa siguen UNKNOWN/excluidos; **S22/R02/Fase5B continúan PARTIAL**.


## R02C — S22 perfil administrativo base,2026-10-21

| Estado | Flutter de referencia | Next | Evidencia / límite |
|---|---|---|---|
| Lectura fallida con borrador | ProfileScreen/ProfileNotifier ya conservaban estado en P03;20 nuevas pruebas por rol | ProfileEditor conserva estado base y oculta ProfileView mientras hay error |401/403/503 con/sin edición;retry conserva borrador y hace solo GET.No persistencia entre páginas/sesiones. |
| Guardado confirmado/GET fallido | Aviso distinto y retry de lectura | Una recarga,confirmación ligada a versión de lectura |PUT real en E2E,cuatro pares503390;no falso fallo/replay de escritura. |
| PUT fallido/GET fallido | Borrador/error persistente,retry lectura y guardado explícito | Misma capacidad,copy estática segura |Dio controlado/componentes y E2E;sin diagnóstico/PII en error. |
| Form/busy/lifecycle | Campos bloqueados y guardas existentes,por ambos roles | Form nativo,lock sincrónico,payload fijo,Cancelar bloqueado,mounted/propietario |Normalización/campos existentes conservados;no nuevo criterio de validación clínica. |
| Permisos/sesión | Rol y proveedor existentes intactos | Ámbito bloqueado y no enviado;BFF/CSRF/interceptores intactos |403 real de FastAPI por autoservicio fuera de ámbito;401 controlado redirige login. |
| Capas/temas390 | Referencias claro/oscuro de error confirmado | Decoración detrás de navegación solo en /admin/profile |Expectativa de ruta actualizada y2 límites negativos;capturas finales tras build corregido. |
| Firma | Sin código Flutter modificado | Hook/JSX byte idénticos;ProfileView desmonta igual ante error |Capacidad excluida;sin validar almacenamiento ni imagen real. |

[Comparación](evidence/phase5b/admin-profile/comparison-cases.json),[implementación](../audits/phase5b-implementation.md#continuación--r02c-perfil-administrativo-base-2026-10-21).Controles B5-R02C01–R02C05 DONE en estados probados:Next528/Flutter402/backend409 PASS y gates;21 E2E.S22/R02/Fase5B PARTIAL.Composición,validación de nombres vacíos existente,contraste integral,truncamientos y accesibilidad física pendientes.No Maps,Azure,PDF/QR o clínica nueva.


## R02D — S00 inicio y S01 login

| Estado | Flutter | Next | Evidencia / límite |
|---|---|---|---|
| Restauración y rutas | Splash espera `checkSession` hasta5s y luego enruta por rol/cambio obligatorio;error/timeout conduce a login. | Home espera hidratación y enruta por sesión,rol/cambio obligatorio. | Intención compatible;sin prueba pareada de respuesta tardía/error ni captura Flutter/Next pareada. UNKNOWN;protocolos intactos. |
| Validación de login | `TextFormField.validator` representa errores del campo; pruebas Flutter focales actuales verifican formulario/loading, no toda la matriz de validación. | Mensajes enlazados con `aria-describedby`; `aria-invalid` y `role=alert`. | Prueba de accesibilidad Next pasa; Flutter toolchain disponible y login/provider: 10 PASS. Sin E2E autenticado nuevo ni captura pareada. |
| Apariencia/loading/submit | Login responsivo y loading existentes,referencia sin captura nueva. | Sin cambios de layout,tema,validadores,copy,submit,API o store. | No se afirma paridad visual integral,lector real,autofoco ni servidor-error en esta corrección. |

La prueba semántica es DOM/JSDOM,no lector de pantalla real. S00 sigue UNKNOWN para fallo/timeout/respuesta tardía; visual pareado, autofoco y teclado físico de S01 no se validan con estos tests.


### Revalidación S01 — login, 2026-10-26

La fila anterior aún decía que los errores Next carecían de asociación con sus campos y que Flutter no podía ejecutarse. Next tiene `aria-describedby`, `aria-invalid` y `role=alert`; su prueba focal de accesibilidad, auth API y regresiones de Fase 1 pasó (**8 PASS**). Flutter/Dart está disponible: pruebas existentes de pantalla y provider pasaron (**10 PASS**). Solo verifican presencia/loading y provider; no toda validación UI ni login real. No se cambió auth, se usaron credenciales, ni se probó sesión expirada real. S01/R02/Fase5B permanecen PARTIAL por estados/red, E2E real, comparación pareada y lector/hardware UNKNOWN.


## R03A — Estado de vacunación en listado administrativo S17

FastAPI `student_vaccination_status` devuelve `approved`, `denied` o `pending`. Flutter conserva el string y muestra conteos separados para esos tres valores. El DTO Next había tipado únicamente `approved | pending`; tanto las filas desktop/mobile como el conteo grupal etiquetaban todo valor no aprobado como Pendiente.

Se actualizó el tipo de respuesta Next a `ReportVaccinationStatus` y su vista representa los tres valores que envía el backend: Aprobado, Pendiente y Denegado. No se modificó el filtro API (`approved|pending`), la decisión/agregación backend, permisos, clínica ni otras pantallas.

Prueba sintética del componente comprueba la respuesta mezclada y las dos representaciones responsivas presentes en DOM:1 PASS. Next suite completa527 PASS/3 SKIP;lint,typecheck y build webpack PASS. Flutter no se modificó y el toolchain no está disponible para ejecutar golden/Flutter tests en esta sesión;el resto de la pantalla S17 y R03 siguen PARTIAL.


## R03B — Error inicial del esquema estudiante S05

La auditoría de paridad encontró una diferencia:Flutter mostraba el error de la primera lectura sin acción de recuperación;Next presenta un retry. El provider Flutter ya tenía `loadScheme(forceRefresh: true)`,pero la pantalla no lo exponía en esa rama de render.

Se añadió un botón “Reintentar” junto al mensaje de error inicial. Llama al método existente con lectura forzada;no cambia cache offline,contratos,estados o reglas clínicas. Un test widget nuevo comprueba la presencia del control y que la interacción pasa `forceRefresh: true`.

**Estado vigente 2026-10-26: R03B DONE en el retry probado; S05/R03 siguen PARTIAL como paridad integral.** El bloqueo histórico de toolchain se resolvió instalando Flutter 3.41.6/Dart 3.11.4 en `/tmp` y recuperando dependencias exclusivamente según `pubspec.lock`, con `--enforce-lockfile`. El test nuevo pasó (1/1);la suite Flutter pasó (403/403);`flutter analyze --no-pub` no encontró issues y `dart format --set-exit-if-changed` reportó cero archivos modificados. El runner necesitó permiso para socket local y se ejecutó fuera del sandbox. No se ejecutó build Android. Sigue pendiente comparación integral de S05 y otros estados/viewport/accesibilidad de R03;S19 conserva el error conjunto Flutter sin presentación de error/retry.


## R03C — Revalidación documental de detalle administrativo S19

No hubo cambio de código en este bloque. La tabla histórica de S19 contenía observaciones que ya no corresponden al código actual de Next:tabs enlazadas con ARIA,acciones confirmar activar/desactivar/eliminar en detalle,comunicación contextual y error/retry por consulta. La matriz se corrigió para reflejar también que Flutter ofrece las acciones de ciclo de vida en el listado mientras Next las ofrece en detalle.

Dos suites existentes de Next para detalle/esquema pasaron:14 tests. La limitación actual de Flutter está en `_load`:captura el fallo conjunto de perfil/esquema/evidencia y solo pone `_loading=false`;la vista puede parecer vacía y no ofrece reintento de lectura. No se modificó Flutter mientras el toolchain siga ausente. S19 permanece PARTIAL.


## R03D — Revalidación del editor de catálogo S21

La inspección no encontró un cambio de contrato, regla o presentación claramente necesario en esta revisión. Los editores conservan `is_annual` y las opciones `applies_to`/tipos de dosis;no se añade ni transforma semántica clínica. El bloque previo de modal,teclado,labels,filas dinámicas y errores permanece como evidencia acotada;no implica paridad integral de catálogo.

Se ejecutó la suite existente `phase5b-catalog-dialog.test.tsx`:13 PASS. No hubo cambios de código. Flutter no se ejecutó por falta de toolchain;comparación pareada de pantalla/viewport,interacción nativa y lector real siguen pendientes. S21/R03 permanecen PARTIAL.


## R03E — Recuperación de error del detalle administrativo S19 Flutter

| Dimensión | Flutter / causa y cambio | Next / paridad y evidencia |
|---|---|---|
| Carga conjunta | `_load` usa `Future.wait` para perfil/esquema/evidencia; antes el `catch` solo apagaba el spinner. Ahora un fallo muestra error genérico y retry GET-only de las tres fuentes, y oculta acciones del detalle. | Las consultas se representan separadamente con sus errores/retry. No cambia su implementación ni contratos. |
| Error frente a vacío | No presenta “Sin perfil”/“Sin evidencia subida” como resultado exitoso ante la primera falla. No interpola la excepción. | La comprobación de componente de Next mantiene la separación por consulta;14 tests Next de detalle/esquema continúan siendo la evidencia previa. |
| Retry / success | Dos widget tests cubren falla inicial/retry y carga exitosa seguida de fallo de refresco que retira datos/acciones obsoletos. 2 PASS. Suite Flutter final 405 PASS; analyze/format PASS. | Sin cambios ni pruebas nuevas en este bloque. |
| Límite | Se conserva `Future.wait`: un endpoint fallido impide mostrar las otras dos secciones; no se altera a cargas independientes. Sesión expirada real/lector/hardware UNKNOWN. | Estados individuales tienen representación, pero no se declaran equivalencia visual completa ni lector real. |

**R03E DONE** para la recuperación probada;S19/R03/FASE5B permanecen PARTIAL por paridad integral y validación nativa/visual restante. Causa, rollback, entorno y test: [implementación R03E](../audits/phase5b-implementation.md#continuación--r03e-recuperación-de-lectura-del-detalle-s19-flutter-2026-10-26). Sin migraciones ni commit.


## R02E — Estado de restauración accesible S00 Next

La causa era el `<p>` de carga sin semántica de estado. Ahora “Cargando…” expone `role=status` y `aria-live=polite`; una regresión primero falló al no hallar rol status y pasó después del cambio. Comprueba también que Next no redirija antes de hidratar el store. Next suite **528 PASS/3 SKIP**, lint/typecheck/build webpack PASS. Las pruebas BFF con PostgreSQL se omiten sin URL; al intentarlas, el PostgreSQL local en `127.0.0.1:55544` rechazó conexión. Esta corrección es solo accesibilidad semántica; timeout, respuesta tardía, lector real y paridad visual de S00 siguen UNKNOWN. **R02E DONE;S00/R02/Fase5B PARTIAL.**


## R03F — Revalidación del acordeón de esquema estudiante S05 Next

La tabla histórica S05 decía que el acordeón carecía de `aria-expanded`; el código actual contradice esa nota. El botón de vacuna ya expone `aria-expanded`, `aria-controls`, foco visible y controla un `role=region` enlazado. El test existente `phase5b-detail-scheme.test.tsx` comprueba para el estudiante el estado inicialmente cerrado, la activación con Enter/Espacio, la región y la ausencia de acciones administrativas: **7 tests focalizados PASS**. No se modificó código. `aria-expanded` no necesita patch.

**Estado:** R03F DONE en la verificación del acordeón; S05/R03 siguen PARTIAL por comparación visual/viewport y accesibilidad física UNKNOWN. La fila histórica de S05 se actualizó. Sin cambios de contrato, clínica, backend o migraciones; sin commit.


## R03G — Estado vacío del catálogo S21 Flutter

| Estado | Flutter / causa y cambio | Next / evidencia |
|---|---|---|
| Catálogo vacío | Antes, respuesta correcta `[]` producía `ListView` sin filas ni mensaje. Ahora presenta “Aún no hay vacunas en el catálogo.” y conserva el FAB; `AlwaysScrollableScrollPhysics` permite actualizar por gesto. | Next muestra tarjeta vacía y ahora también una acción accesible de actualización manual; regresa a la lista poblada al actualizar. R03AC cubre vacío y poblado. |
| Carga inicial | `CircularProgressIndicator` se representa como `SemanticsRole.loadingSpinner` en Flutter Material. | “Cargando…” ahora tiene `role="status"` y `aria-live="polite"`; regresión focal prueba el anuncio mientras la consulta está pendiente. No equivale a validación TalkBack/VoiceOver. |
| Error de lectura | El `Scaffold` conserva el FAB de creación mientras el body muestra `_ErrorState` y retry. | Next conserva encabezado, botón y `QueryError` con retry ante errores distintos de401/403; no muestra acciones en esos estados auth. Regresión cubre503,401,403; otros errores no-auth siguen la misma rama pero no se probaron individualmente. No cambia permisos del servidor. |
| Verificación | Widget test prueba mensaje, acción Nueva vacuna y gesto de refresh que genera un segundo GET. Falló antes del cambio; después 1 PASS. Flutter analyze PASS, suite final406 PASS, format PASS. | `phase5b-catalog-dialog.test.tsx`:18 PASS incluye estado accesible de carga, refresco vacío/poblado y bloqueo durante petición. Lint/typecheck/build webpack PASS; E2E sintético verifica el control disponible y reflow a320/640/720 CSS px. |

**R03G DONE** para estado vacío/refresh probado. S21/R03/FASE5B siguen PARTIAL por comparaciones visuales integrales, estados restantes y evidencia física UNKNOWN. Sin reglas clínicas, backend ni migraciones.

## R03AC — Actualización manual del catálogo S21 en Next, 2026-11-05

Flutter permite refrescar el catálogo por gesto cuando hay vacunas y cuando el resultado está vacío. Next mostraba el estado vacío y soportaba retry si el GET fallaba, pero no ofrecía actualización manual después de una carga exitosa. Se añadió el botón accesible “Actualizar catálogo”, deshabilitado durante la lectura, con disposición responsive que mantiene visible la acción sin overflow.

Next `phase5b-catalog-dialog.test.tsx`: **17 PASS**, incluye lista poblada, lista vacía y petición en curso. `npm run lint`, typecheck y build webpack: **PASS**. El E2E `phase5b-admin-catalog-name-reflow-browser.mjs`, con fixture sintético, confirma botón visible/habilitado y `documentWidth == viewport` a320/640/720 CSS px; [mediciones](evidence/phase5b/admin-catalog-name-reflow/measurements.json). Sin llamadas reales ni datos institucionales.

**R03AC DONE** para actualización manual y estados probados. Riesgo: la lectura manual depende de la query existente y conserva los errores seguros/retry actuales. Rollback: retirar el control y las pruebas asociadas, dejando la lista Next en su estado anterior. Sin migraciones, reglas clínicas o cambios backend/Flutter. S21/R03/Fase5B siguen **PARTIAL** por cobertura integral, otros viewports/estados y accesibilidad física UNKNOWN; sin commit.

## R05A — Semántica de carga del catálogo S21 Next, 2026-11-05

Flutter Material expone el spinner indeterminado como `SemanticsRole.loadingSpinner`. Next mostraba un párrafo “Cargando…” que no anunciaba estado. Ahora el mismo texto presenta `role="status"` y `aria-live="polite"`; no cambia la apariencia.

`phase5b-catalog-dialog.test.tsx`: **18 PASS**, incluye una consulta inicial pendiente y verifica el estado accesible. Lint/typecheck/build webpack PASS. Es semántica DOM automatizada; no se usó TalkBack, VoiceOver ni hardware real. **R05A DONE** para el anuncio automatizado de carga; validación física transversal de R05 sigue UNKNOWN y S21/R03/Fase5B permanecen PARTIAL.

## R03AE — Crear desde catálogo ante error de lectura no-auth S21 Next, 2026-11-05

Flutter mantiene el botón flotante “Nueva vacuna” fuera del body que pasa a `_ErrorState`. Next retornaba `QueryError` antes del encabezado y del editor, impidiendo crear cuando fallaba solo la lectura. Se conserva el encabezado y la acción con retry en errores distintos de401/403; el caso503 se prueba y otros errores no-auth siguen la misma condición de código sin cobertura individual. 401/403 continúan sin acciones, conforme al control existente para sesión/permisos denegados.

La regresión cubre503 (alerta, abrir modal y ninguna mutación antes de confirmar),401 y403 (mensaje correcto, sin CTA): suite Next catálogo **20 PASS**. Lint/typecheck/build webpack y E2E sintético de viewport a320/640/720 CSS px: PASS. El E2E verifica que el layout exitoso conserva el control y no desborda; el error y apertura modal son de componente. No se modificó Flutter/API/FastAPI. **R03AE DONE** para estados automatizados; S21/R03/Fase5B continúan PARTIAL por paridad integral/lectores físicos UNKNOWN.


### Revalidación S21 — catálogo de vacunas, 2026-10-26

Next `phase5b-catalog-dialog.test.tsx`: **13 PASS**; Flutter `vaccine_catalog_screen_test.dart`: **1 PASS**. Primer intento Flutter en sandbox bloqueó socket local; la repetición autorizada pasó. Next comprueba editor/modal, errores con borrador, confirmación antes de activar/desactivar, bloqueo de cierre pendiente y 403 sin acciones; Flutter test cubre respuesta vacía y refresh. Sin cambios de catálogo/reglas. El copy Next de desactivación habla de quitar vacuna del esquema de estudiantes activos; su efecto sobre snapshots históricos no se infiere ni se cambió en este bloque. Comparación visual integral, edición/error Flutter, lector/hardware y efectos institucionales/versionado siguen UNKNOWN; S21/R03/Fase5B PARTIAL.


## R03H — Estado vacío del esquema S05 Flutter

| Estado | Flutter / causa y cambio | Next / evidencia |
|---|---|---|
| Esquema exitoso sin vacunas | Antes solo aparecía el resumen y quedaba una lista vacía. Ahora explica “Sin vacunas asignadas” con descripción y permite refrescar con gesto aun con poco contenido. | Ya presenta título y descripción equivalentes mediante `EmptyState`; no se cambió. |
| Verificación | Widget test prueba textos y segundo GET tras el gesto; focal2 PASS (incluye retry/error existente), suite Flutter407 PASS, analyze PASS, format aplicado. | Sin cambio Next/backend. |

**R03H DONE** para vacío/refresh. S05/R03/Fase5B siguen PARTIAL por paridad visual integral, otros estados, viewports y lector/dispositivo físico UNKNOWN. No se modifican señales clínicas ni API.


### Revalidación S05 — esquema estudiante, 2026-10-26

Se volvieron a ejecutar las suites focales del estado ya implementado: Flutter `scheme_detail_screen_test.dart` **2 PASS** (fallo inicial/retry y vacío/refresh); Next `phase5b-detail-scheme.test.tsx` **7 PASS** (acordeón, teclado DOM y ausencia de acciones administrativas). Las matrices existentes reflejan DTO/señales del backend; se afina el conteo de evidencia actual, sin cambios funcionales ni reglas clínicas. No se repitieron suites completas, backend, E2E ni goldens. Fechas máximas distintas del selector, viewport/tema completo, lector/hardware y expiración real siguen UNKNOWN; S05/R03/Fase5B PARTIAL.


## R03I — Revalidación de paginación S17

| Dimensión | Flutter | Next / FastAPI |
|---|---|---|
| Lectura y contrato | La pantalla usa `/admin/students/search`, `page` y tamaño20; el provider mantiene página/filtros al paginar/refrescar. | La página usa el mismo endpoint/body, `page_size=20`; el componente consume `has_next/has_previous` y `total_pages`. FastAPI mantiene orden `created_at DESC, id DESC`. |
| Navegación/retorno | Paginador anterior/siguiente; volver del detalle refresca el listado en la misma instancia. | Page/filter en query params; búsqueda en contexto privado; detalle preserva `returnTo`. Exportar puede leer todos los registros; listar no. |
| Evidencia | `admin_provider_test.dart`:4 PASS. | `phase5a-list-sync.test.tsx` + `phase5b-admin-student-list-status.test.tsx`:8 PASS. E2E Fase5A existente prueba varias páginas, filtros, detalle/retorno y reload; no se repitió en este bloque. |

La fila antigua de S17 que afirmaba descarga completa y pager no funcional estaba desactualizada. R03I actualiza el registro; no hubo cambio de código. El estado de paridad integral de S17/R03 sigue PARTIAL.


### Revalidación S17 — listado administrativo, 2026-10-26

Next `phase5a-list-sync.test.tsx` + `phase5b-admin-student-list-status.test.tsx`: **8 PASS**; Flutter `admin_provider_test.dart`: **4 PASS**. Confirmados `page_size=20`, metadata paginada, status aprobado/pendiente/denegado separado, retorno/contexto en las pruebas Next y paginación/refresh del provider Flutter. La inspección comprobó labels de filtros enlazados en Next; se corrige la fila principal que los marcaba sin `htmlFor/id`. No se repitió E2E navegador/PostgreSQL, exportación completa, pantalla Flutter entera ni gates. Las acciones de ciclo de vida están en el listado Flutter y el detalle Next (S19): diferencia de ubicación ya descrita, no ausencia funcional; S17/R03/Fase5B siguen PARTIAL.


### Revalidación S19 — detalle administrativo, 2026-10-26

Next `phase5a-student-detail.test.tsx` + `phase5b-detail-scheme.test.tsx`: **14 PASS**; Flutter `admin_student_detail_screen_test.dart`: **2 PASS**. Se confirma que Next tiene acciones de ciclo de vida con confirmación en detalle, tres consultas con estados/retry por consulta y contexto; Flutter presenta fallo genérico atómico de las tres consultas, oculta datos/acciones previos y reintenta el conjunto. La relectura actualiza evidencia focal R03E; no se repitieron E2E, backend ni suite completa/goldens. Historial/revocación pública y certificado no forman parte de este bloque; paridad integral/lector/hardware UNKNOWN. S19/R03/Fase5B PARTIAL.


## B5-C07 — Búsqueda de destinatarios en comunicaciones S12/S13

| Estado | Flutter | Next |
|---|---|---|
| Búsqueda activa | Spinner al iniciar debounce/request; al editar se quitan resultados viejos y se invalida respuesta anterior. | `useQuery` depende del rol/destino/texto; loading representa el request del query actual. |
| Empty | “No hay destinatarios disponibles.” tras respuesta exitosa sin matches. | Empty explícito del buscador. |
| Error/retry | Mensaje seguro live + “Reintentar búsqueda”; retry repite texto vigente. | `QueryError` con retry. |
| Respuesta tardía | Ignorada al cambiar input por debajo del mínimo; no deja spinner. | Asociada a clave/query en TanStack Query. |

Pruebas Flutter nuevas: **2 PASS**; suite de estados comunicaciones **32 PASS**, suite Flutter **411 PASS**, analyze PASS, formato0 cambios. Next suites peer/layers/recovery **74 PASS**. No E2E backend repetido, no cambios API/permiso. B5-C07 DONE en estados de búsqueda probados; S12/S13 y R04/Fase5B siguen PARTIAL por paridad integral, roles/tema/viewport y accesibilidad física UNKNOWN.


### Revalidación S12 — comunicaciones de estudiante, 2026-10-26

Next `phase5a-communications.test.tsx`, `phase5b-communications-peer.test.tsx` y `phase5b-communications-recovery.test.tsx`: **54 PASS**. Flutter `phase5b_communications_peer_test.dart` + `phase5b_communications_states_test.dart`: **52 PASS**. Se verifican pares/interlocutores sintéticos, estados de lista/detalle, búsqueda vacía vs error/retry, respuesta tardía, borrador y lectura no confirmada sin navegar. El primer Flutter intento fue bloqueado por socket local; repetición autorizada pasó. Se mantiene explícita la diferencia de destinatario opcional por ámbito en Next vs selección obligatoria en Flutter; no se cambia contrato/permisos. No se repitió E2E, backend, full suite o accesibilidad física. S12/R04/Fase5B PARTIAL.


### Revalidación S13 — comunicaciones admin/app_admin, 2026-10-26

Se repitieron las mismas suites compartidas por rol: Next **54 PASS**, Flutter **52 PASS**. Los fixtures cubren admin→estudiante/admin/app_admin, admin recibe de estudiante, app_admin recibe de admin; el buscador/formulario restringido del app_admin a admin y administración exige destino explícito; errores, empty/retry y recuperación quedan cubiertos. Es evidencia de UI con fixtures/control de transporte, no ampliación de los permisos ni E2E nuevo. Flutter necesitó repetición autorizada por socket local. Rutas, polling y diferencias de selector se conservan. No se validó lector/dispositivo, inbox institucional, E2E/DB ni paridad visual integral; S13/R04/Fase5B PARTIAL.


## B5-N10 — Fallo al marcar notificación como leída

| Caso | Flutter | Next student/admin |
|---|---|---|
| GET transitorio (red/429/5xx) | Conserva avisos previos con error/retry. | Conserva avisos previos con QueryError/retry y aviso de últimos datos cargados. |
| GET no transitorio (4xx/cancelación) | Limpia lista/contador retenidos y muestra error/retry. Test 403 añadido. | Oculta lista/acciones retenidas; cubierto por tests 400/401/403/404/422 y cancelación. |
| Mutación marcar leída falla | Snackbar seguro; conserva estado no leído; no navega al fallar desde el tap de abrir. Widget test nuevo. | Toast seguro; conserva lista no leída; no navega al fallar desde el tap de abrir. Tests por student/admin. |

N10 previo: Flutter focal13 PASS, suite409 PASS, analyze/format PASS; Next focal36 PASS, suite530 PASS/3 SKIP, lint/typecheck/webpack PASS. **Continuación N10:** Next espera el resultado de marcado antes de navegar. Tests componente de éxito/fallo y tests de página student/admin ante rechazo: cubiertos en `phase5b-notifications.test.tsx` y `phase5b-notification-refresh.test.tsx`. La diferencia de secuencia queda resuelta; lector/dispositivo físico permanece UNKNOWN. S10/R04/Fase5B siguen PARTIAL.


### Revalidación S10 — notificaciones, 2026-10-26

Next `phase5b-notifications.test.tsx` + `phase5b-notification-refresh.test.tsx`: **47 PASS**. Flutter `phase5b_notification_errors_test.dart` + `phase5b_notifications_reference_test.dart`: **42 PASS**. Verifican fallos transitorios/no transitorios, retry, retención/ocultación de datos, errores al marcar leído, no navegar si falla, éxito y referencias de estados/tema/text scaler. Flutter requirió repetición autorizada por socket local. No se modificó código, backend, permisos ni payloads push; E2E/PostgreSQL/build/full suites no se repitieron. Semántica de lector real y dispositivo físico siguen UNKNOWN; S10/R04/Fase5B PARTIAL.


## Revalidación S02 — recuperación de contraseña, 2026-10-26

La fila original de S02 conservaba dos afirmaciones vencidas: que Flutter no tenía scroll en viewport bajo y que Next exponía diagnósticos CORS/Render. El código actual usa scroll en Flutter y `accountFormError` en Next, con mensajes seguros por estado/red/timeout; las pruebas R02A ya cubren la recuperación acotada. Se ejecutaron de nuevo `phase5b-account-forms.test.tsx` (**32 PASS**) y `phase5b_account_forms_test.dart` (**37 PASS**). El primer intento Flutter en sandbox falló al abrir el socket local; repetición con permiso de ejecución pasó. No se enviaron correos reales. S02/R02/Fase5B siguen PARTIAL por cobertura integral y validación real de transporte/correo; sin cambio funcional ni migración.


## Revalidación S03 — restablecimiento de contraseña, 2026-10-26

La inspección encontró que la fila inicial decía que Next etiquetaba cualquier fallo como token inválido y omitía `aria-describedby`; el código actual distingue HTTP 400 de timeout/red/5xx y asocia los errores de ambos campos. Flutter mantiene sus dos alias y el deep link; Next usa `/reset-password` y, ante token ausente, ofrece recuperar sin hacer POST ni mostrarlo. Las mismas suites recién ejecutadas de formularios cubren reset dentro de 32 tests Next y 37 Flutter. No hubo E2E real del enlace ni cambio funcional. Compatibilidad de enlaces ya distribuidos y lectores reales siguen UNKNOWN; S03/R02/Fase5B PARTIAL.


## Revalidación S09 — cambio de contraseña, 2026-10-26

La fila inicial conservaba el copy obsoleto de contraseña=cédula y afirmaba que Next no enlazaba errores. Código y prueba actual confirman que Flutter y Next indican contraseña temporal recibida por correo; la suite Next también impide una regresión de texto derivado del documento. Campos de error Next tienen asociación ARIA. Se repitieron las suites compartidas: Next **32 PASS** y Flutter **37 PASS**, incluyendo cambio, error HTTP seguro, sesión 401 distinguida de contraseña incorrecta 400, doble submit, bloqueo y logout. La prueba Next verifica logout→login; no se afirma que su pantalla de éxito sea visible después del replace. Sin cambio funcional/contrato. Lectores/hardware y navegación física siguen UNKNOWN; S09/R02/Fase5B PARTIAL.


## Revalidación S00 — inicio y restauración, 2026-10-26

Next `home-loading-accessibility.test.tsx` + `phase1-auth.test.ts`: **7 PASS**, incluyendo carga con anuncio `role=status`, validación de sesión y carrera de restauración contra logout. Flutter `session_redirect_test.dart` + `auth_provider_test.dart`: **9 PASS**, incluyendo redirección de ruta protegida tras expiración y restauración de sesión válida. Primer Flutter intento sandbox bloqueó el socket local; la repetición autorizada pasó. No se modificó autenticación. Sigue sin prueba controlada del timeout/transición del Splash o respuesta tardía en esa pantalla, comparación temporal pareada y lector real; S00/R02/Fase5B PARTIAL.

## Revalidación S14/S15 — conversación y dashboard admin, 2026-10-26

Detalle de conversación Next **47 PASS** y Flutter **32 PASS**; dashboard admin Next **31 PASS** y Flutter **48 PASS**. Se confirman recuperación de conversación y filtros/contexto de semestre en los casos probados. No se ejecutaron E2E/backend ni gates completos; equivalencia de estadísticas con datos institucionales, lector/dispositivo y comparación integral de viewport/tema siguen UNKNOWN. S14/S15/R04 continúan PARTIAL.

## Revalidación S16 — dashboard app_admin, 2026-10-26

Las suites del dashboard ejecutadas para S15 cubren ambos roles: Next **31 PASS** (incluye app_admin global sin filtro de semestre) y Flutter **48 PASS** (referencia admin/app_admin). Se verificaron loading, vacío, error/retry, refresh y navegación en los casos cubiertos. Equivalencia de estadísticas institucionales, E2E/backend, lector físico y accesibilidad integral UNKNOWN. S16/R04/Fase5B permanecen PARTIAL; no hubo cambio de código o permisos.

## Revalidación S17 — listado administrativo, 2026-10-26

Next sincronización/estado **8 PASS**; Flutter provider/modelo paginado **6 PASS**. Las acciones equivalentes están en ubicaciones distintas (lista Flutter, detalle Next). Esta corrida no incluyó widget test Flutter de la pantalla de lista ni E2E navegador; integración completa de filtros/paginación, navegación, lectores/teclado y viewport siguen UNKNOWN. S17/R03/Fase5B PARTIAL; sin cambio de código/contratos/permisos.

## Revalidación S18 — alta e importación, 2026-10-26

Next **22 PASS** y Flutter **22 PASS** en creación/importación focal. Dobles envíos, validación y operaciones asincrónicas tardías se cubren en fixtures sintéticos. Diferencia vigente: texto libre de programa/campus en Next frente a AcademicOptions Flutter; resultados de importación no son idénticos. No se infiere equivalencia institucional. Sin API/E2E ni correo real; S18/R03/Fase5B PARTIAL.

## Revalidación S20 — administración de usuarios, 2026-10-26

Next **38 PASS** (alta/recuperación) y Flutter **26 PASS** (gestión/estados). Confirman recuperación de consulta posterior a alta/baja sin repetir la mutación, confirmación y bloqueo de doble envío en los casos probados. No equivalen a prueba de RBAC con PostgreSQL ni a recorrido institucional. S20/R03/Fase5B PARTIAL; sin cambio funcional.

## Revalidación S23 — verificador público, 2026-10-26

Next BFF `route.test.ts`: **6 PASS**, incluido GET público sin cookie/Authorization y respuesta no-cache; Flutter no tiene pantalla interna equivalente. Sigue observado UI-16: la página no diferencia de forma específica errores 429/503 y no inspecciona `response.ok`; no hubo test focal de componente. No se tocó la página ni el PDF/QR. UI-16 sigue BLOCKED por alcance, S23/R04 UNKNOWN en accesibilidad/error de pantalla.

## Revalidación S21/S22 — catálogo y perfil, 2026-10-26

Catálogo/perfil Next **40 PASS**; Flutter **21 PASS** (catálogo empty + perfil admin/app_admin). Revalidan editor web, recuperación de perfil y estado vacío Flutter; no validan firma real ni editor/error Flutter del catálogo. La semántica de desactivación sobre snapshots sigue sin inferirse. S21/S22 continúan PARTIAL, sin cambios de código.

## Revalidación S24 — sin pantalla de asignación, 2026-10-26

Se mantiene la observación de auditoría: no existe consumidor/pantalla Flutter o Next para asignar responsable por programa/campus; solo existe interfaz backend. No hay equivalencia visual o pruebas cliente que declarar. No se implementa UI ni se amplían permisos. La decisión institucional de UX queda UNKNOWN.

## Revalidación S19 — detalle, esquema y evidencias, 2026-10-26

Next **18 PASS** y Flutter **30 PASS**. Cubren lectura/esquema, carga atómica Flutter con retry, selección y recuperación evidencia POST-confirmado/GET-fallido sin duplicar escritura. Certificados/historial/revocación/PDF y E2E backend no se ejecutaron; no se infiere paridad de esos subflujos. S19/R03 continúa PARTIAL.

### Actualización S20 — envío contextual de mensajes, 2026-10-26

Next ahora dispone de acción contextual equivalente a Flutter: modal accesible, validación, POST al contrato existente con `category=admin` + `admin_id` y navegación al hilo con retorno a lista. Next suites **42 PASS**, lint/typecheck/build webpack PASS. Backend `test_phase5a_communications.py` **4 PASS** en SQLite sintético/Python 3.12.15, incluidos roles; PostgreSQL no se pudo arrancar por bloque compartido preexistente y queda BLOCKED. El contrato/endpoint no cambió. S20 mejora funcionalmente, pero sigue PARTIAL.

### Actualización S18/S20 — opciones académicas, 2026-10-26

Next alta de estudiante y administración de usuarios, y Flutter alta de estudiante/administrador y edición de ámbito administrativo, consumen `GET /admin/academic-options`. Se reemplazó texto libre/listas duplicadas por opciones no personales servidas por FastAPI. Backend 4, Next 57 y Flutter 52 pruebas focales reportadas PASS; Next lint/typecheck/build webpack y Flutter analyze PASS. PostgreSQL no se ejecutó para este bloque. S18/S20 siguen PARTIAL por alcance de paridad integral.

## R03J — actualizar lista paginada Flutter S17, 2026-10-26

**Causa raíz.** Next expone un botón “Actualizar lista” junto a su paginación. Flutter ya podía recargar automáticamente al volver del detalle y tenía `refresh()` que conserva página y filtros, pero no ofrecía una acción visible durante el uso normal.

**Cambio.** Se agregó un icono de actualización en la AppBar Flutter con tooltip “Actualizar lista”. Los iconos de paginación también tienen tooltips “Página anterior” y “Página siguiente”. El refresco se deshabilita durante una consulta en curso y llama al `refresh()` existente; no se cambió el contrato ni la lógica de paginación.

**Pruebas/resultados.** `admin_student_list_pagination_test.dart` y `admin_provider_test.dart`: **5 PASS** combinados. Recorre página 1→2 y confirma que la acción vuelve a solicitar página 2 conservando activo, semestre y estado de vacunación. `flutter analyze --no-pub`: **PASS**. Next/backend no se modificaron y no requerían repetición por este cambio local.

**Límites/rollback.** El test verifica la acción y parámetros con datasource mock; no es E2E navegador/backend ni validación en dispositivo/lector físico. R03J DONE para refresco probado; S17/R03/Fase5B continúan PARTIAL por cobertura visual, viewport, navegación y accesibilidad integral pendientes. Sin migración. Rollback: retirar el `IconButton` de la AppBar y el widget test nuevo.

## R03K — errores y editor responsivo del catálogo Flutter S21, 2026-10-26

**Causa raíz.** `VaccineCatalogNotifier` capturaba solo `DioException`: errores de parseo/ejecución podían dejar `isLoading=true`. Además, los errores de escritura usaban `state.error`, que la pantalla interpreta como fallo de lectura y reemplazaba la lista. Un guardado confirmado seguido de fallo GET no comunicaba claramente el resultado mixto. El editor tenía anchura fija de 600px, altura sin límite y selectores de dosis no expandidos, con overflow en pantallas angostas/bajas.

**Cambio.** Se añadieron fallbacks seguros para excepciones genéricas y se separaron `error` de lectura, `writeError` y `confirmedChange`. La escritura fallida conserva el formulario/lista; una escritura confirmada con recarga fallida muestra ese hecho junto al error y permite retry GET-only. El diálogo limita ancho/alto al viewport y los dropdowns de tipo/aplicabilidad se expanden dentro de sus columnas.

**Pruebas/resultados.** `vaccine_catalog_screen_test.dart`: **4 PASS**, cubre vacío/refresh existente, fallo genérico de lectura y retry, fallo de edición conservando borrador/lista y escritura confirmada con recarga fallida y recuperación. Los dos casos de edición corren a 390×844 y confirman accesibilidad del botón Guardar sin overflow. `flutter analyze --no-pub`: **PASS**; `dart format`: **sin cambios**; `git diff --check`: **PASS**.

**Límites/rollback.** Transporte mock, sin integración backend/PostgreSQL ni dispositivos/lector. No se cambió el contrato ni la lógica del catálogo. Rollback: revertir `VaccineCatalogState`/notifier y la representación de errores, restablecer dimensiones del `Dialog`, retirar `isExpanded` en ambos dropdowns y las pruebas R03K. R03K DONE para estos estados; S21/R03/Fase5B siguen PARTIAL por accesibilidad física, otros viewports y semántica institucional de snapshots UNKNOWN.
## R02F — timeout de restauración de sesión S00 (2026-11-02)

**Causa raíz:** Next reutilizaba el timeout general de 30 s de `apiClient` para `GET /users/me` al hidratar la sesión; Flutter limita el perfil de restauración a 4 s y el Splash espera como máximo 5 s. Una API lenta podía dejar la pantalla inicial de Next en carga hasta 30 s.

**Cambio y evidencia:** `getMe` admite timeout por llamada y `checkSession` lo fija en 5 s. Login y las demás lecturas conservan el timeout general. El error sigue manejándose por el flujo de restauración existente (sesión anónima e hidratada); no cambia FastAPI, refresh, cookies ni contratos. `phase1-auth.test.ts` verifica el límite de 5 s y el estado anónimo/hidratado ante timeout simulado.

**Resultado y límites:** `users-timeout.test.ts`, `phase1-auth.test.ts` y `home-loading-accessibility.test.tsx`: 10 PASS. Se comprueba el timeout entregado a Axios y que los consumidores existentes conservan 30 s; el fallo se simula, sin espera de cinco segundos ni infraestructura/red real. La carrera de logout ya tiene prueba existente. S00/R02 siguen PARTIAL por respuesta tardía pareada, comparación integral, lector físico y otros escenarios no cubiertos; este control específico queda DONE.

## R02G — respuesta tardía después de logout, 2026-11-02

La inspección confirma que ambos clientes invalidan la restauración con una generación/época incrementada por logout. Next prueba la carrera (`phase1-auth.test.ts`: **7 PASS**) y Flutter ahora la prueba con una respuesta de identidad diferida (`auth_provider_test.dart`: **9 PASS**). Flutter3.41.6/Dart3.11.4 se instaló en `/tmp`; `pub get --enforce-lockfile` no cambió el lockfile; analyze PASS y format-check sin cambios. R02G queda DONE en esta carrera. S00/R02 siguen PARTIAL por error de transporte real, comparación integral, lector físico y otros escenarios no cubiertos.

**R02H — timeout local de Splash Flutter:** `app_smoke_test.dart` deja pendiente `checkSession`, avanza cinco segundos y verifica navegación al login: **2 PASS** incluyendo smoke anónimo. `dart format` sin cambios. Cubre el límite y el router con reloj de widget; no simula indisponibilidad real del backend ni dispositivo físico. R02H DONE solo para el timeout del cliente.

**R02I — error de perfil durante restauración:** Next `phase1-auth.test.ts` **8 PASS** verifica tokens/caché clínica borrados y estado hidratado anónimo; Flutter `auth_provider_test.dart` **10 PASS** verifica sesión limpiada y rol no guardado. Fallos de transporte simulados; no son prueba de backend/red real ni de la representación visual del mensaje. Flutter analyze y Next lint/typecheck PASS. R02I DONE para el manejo local probado; R02/S00 siguen PARTIAL.

## R03L — catálogo S21 a 320×568

El test de R03K a390×844 no detectaba la fila de acciones que excedía por36px el ancho interno de256px a320×568. Se sustituyó esa fila por `OverflowBar`, que reacomoda “Cancelar” y “Guardar” conservando ambas acciones. `vaccine_catalog_screen_test.dart`: **5 PASS**; `flutter analyze`: PASS; formato sin cambios. R03L DONE solo para el overflow; no declara paridad de todos los viewports o de la pantalla completa.

## R03M — esquema estudiante S05 a 320×568

Un test del detalle expandido reprodujo overflow de32px en la fila de estado/cantidad y de211px en el encabezado del comentario de revisión. Ambos `Row` se cambiaron por `Wrap` conservando etiquetas y acciones. Test sintético comprueba la tarjeta cerrada y expandida a320×568. Suites S05+S21: **8 PASS**; `flutter analyze` PASS; formato sin cambios. R03M DONE para estos dos defectos visuales; no prueba paridad completa ni dispositivos físicos.

## R03N — lista administrativa S17 a 320×568

La lista, chips de filtro y paginación cabían; el grupo expandido fallaba por9,3px en el chip de vacunación “Pendiente” (icono+etiqueta:107,3px, espacio disponible98px). El `Row` interior pasó a `Wrap`, sin ocultar acción ni contenido. `admin_student_list_pagination_test.dart`: **2 PASS**, incluye el caso estrecho expandido y el test anterior de refresh/página/filtros; `flutter analyze` PASS, formato sin cambios. R03N DONE para ese overflow; R03/S17 siguen PARTIAL por paridad/otros viewports y accesibilidad física pendientes.

## R03O — detalle administrativo S19 a 320×568

Se añadió una comprobación de las tres tabs (perfil, esquema expandido con comentario y evidencia vacía/paginación) a320×568. No apareció overflow ni fue necesario modificar código de producto. `admin_student_detail_screen_test.dart`: **3 PASS** en la verificación R03O original. R03O DONE solo para ese recorrido; S19/R03 continúan PARTIAL por otros estados/viewports, validación física y paridad integral.

## R03P — lote de evidencia administrativa S19 a 320×568

La suite `admin_student_detail_screen_test.dart` ahora también expande un lote sintético con un archivo de nombre largo y comprueba que el estado “En revisión” y los controles “Aprobar”/“Denegar” se presentan sin overflow a320×568. Suite actualizada: **4 PASS**; `flutter analyze --no-pub` y formato PASS. No hubo cambio de producto, permisos ni transición. R03P DONE solo para este escenario; S19/R03/Fase5B siguen PARTIAL por otros estados/viewports, validación física y paridad integral.

## R03Q — interacción del editor de catálogo S21 a 320×568

El test responsive del editor ahora opera los selectores de tipo de dosis y aplicabilidad (“Refuerzo”, “Mujeres”) a320×568 y comprueba ausencia de excepción. `vaccine_catalog_screen_test.dart`: **5 PASS**; `flutter analyze --no-pub` y formato PASS. No se reprodujo fallo ni se cambió código de producto. R03Q DONE solo para estos controles; S21/R03/Fase5B siguen PARTIAL por otros viewports, tema/accesibilidad física y paridad integral pendientes.

## R03R — evidencia administrativa Next S19 a 320×568

El runner Chrome con PostgreSQL sintético reprodujo overflow con un nombre permitido de archivo de233 caracteres: scrollWidth1788px en viewport320px. El botón de descarga ahora puede envolver palabras largas y queda limitado al ancho disponible. E2E **1 PASS**; medición: documento320px, panel12–308px y nombre25–295px. Next detalle focal **14 PASS**, lint/typecheck/build webpack PASS. El runner adjunta el fixture sintético a los lotes paginados. R03R DONE solo para el caso; sin evidencia física/zoom/lector ni paridad integral. S19/R03/Fase5B siguen PARTIAL.

## R03S — interacción de selectores del catálogo Next S21 a 320×568

El E2E Next ahora opera por teclado los selectores nativos “Tipo” y “Aplica a” a320×568: `standard → booster → standard` y `all → female → all`. No envía el formulario ni muta catálogo. Chrome/PostgreSQL sintético: **1 PASS**; medidas en `evidence/phase5b/catalog-dialog/measurements.json`; `node --check` PASS. S21/R03/Fase5B permanecen PARTIAL por cobertura integral, dispositivos y accesibilidad física pendientes.

## R03T — estado agregado y contadores S17 Next a 320×568

FastAPI devuelve `in_review` para el agregado pendiente. Next no lo contemplaba y lanzaba un TypeError al leer `variant`; con fixtures, el endpoint respondía200/45 items pero la página caía en error. Se añadió esa variante como representación “Pendiente”, contándola junto al alias de reportes legacy, y se permitió que el grupo de badges envuelva. El E2E real Chrome/PostgreSQL pasó **1/1**; a320×568 el documento queda en320px y los badges están dentro del grupo16–304px. Vitest focal8 PASS, lint/typecheck/build webpack PASS. R03T DONE solo para esos estados/ancho; no prueba lector/zoom/dispositivo físico ni paridad integral. S17/R03/Fase5B siguen PARTIAL.

## S06 — recuperación de la consulta auxiliar del esquema en Flutter

Flutter representa ahora progreso y error de `schemeProvider` junto al selector de dosis, con reintento independiente de lectura. La prueba focal confirma que un fallo no se presenta como una lista vacía y que el retry obtiene dosis sin recargar evidencias ni enviar una mutación. Suite Flutter focal **16 PASS**, analyze PASS. Next ya tenía error y retry de esa consulta. El escenario es provider controlado, no caída real de red; lector/zoom/dispositivo físico UNKNOWN. S06 resuelve esta diferencia en el recorrido probado, pero la pantalla/R04/Fase5B continúan PARTIAL por cobertura integral.

## R04 — límite inicial del ranking para app_admin

La matriz previa registraba tres filas colapsadas en Flutter frente a cuatro para Next `app_admin`. El contrato entrega la misma lista y ambos clientes conservan expansión completa; se alineó Next a tres filas iniciales para los dos roles. Esta es representación de contenido existente: no cambia datos, orden ni agregados. La prueba por rol verifica el límite común y que “Ver más” conserva los cinco elementos de la fixture. Estadísticas institucionales y accesibilidad/dispositivo físico permanecen UNKNOWN; R04/Fase5B siguen PARTIAL.

También se alineó el contenido y orden inicial de la lista: Flutter filtra entradas `total=0` y desempata porcentajes iguales por `total` descendente; Next usa el mismo criterio ahora. Prueba sintética cubre ranking descendente, desempate, omisión de cero y expansión de cuatro elementos válidos; suite de dashboard **20 PASS**, lint/typecheck/build webpack PASS. No modifica las estadísticas de FastAPI. Equivalencia institucional y lector/dispositivo físico UNKNOWN; R04/Fase5B siguen PARTIAL.

## R05 — comprobación semántica automatizada del retry de esquema S06

El test Flutter de error del esquema verifica que el mensaje queda en una región viva y que el retry expone flag de botón y acción tap. `phase5b_evidence_recovery_test.dart`: **16 PASS**, `flutter analyze`: PASS y formato PASS. Esto valida el árbol semántico del widget; no acredita TalkBack/VoiceOver ni uso en dispositivo. R05 global sigue UNKNOWN para validación física; Fase5B continúa PARTIAL.

## R02J — transporte HTTP local durante la restauración de sesión S00 (2026-11-05)

Se ejercitó `checkSession()` de Next con Axios real contra un servidor HTTP sintético en loopback: respuesta HTTP 503 y socket interrumpido (**2 PASS**). Ambos casos verifican que la restauración termina en estado anónimo/hidratado y elimina la caché de esquema; la solicitud no lleva `Authorization`. `npm run lint` y `tsc --noEmit` PASS; `git diff --check` PASS. Es evidencia de transporte local controlado, sin credenciales ni datos institucionales. Servicio desplegado, integración real FastAPI/BFF, respuesta tardía pareada, lector físico y paridad integral siguen UNKNOWN; S00/R02/Fase5B permanecen PARTIAL.

## R02K — timeout HTTP local real durante restauración S00 (2026-11-05)

Se añadió una respuesta demorada de 6 segundos al servidor sintético de R02J. El test constata que Axios cumple el límite de 5 segundos, deja el store anónimo/hidratado y limpia caché clínica; la suite de transporte queda en **3 PASS**. Lint, typecheck y `git diff --check` PASS. Solo verifica el cliente contra loopback; endpoint desplegado, TLS/proxy, paridad visual/temporal integral, respuesta tardía pareada y accesibilidad física siguen UNKNOWN. S00/R02/Fase5B continúan PARTIAL.

## S00 — destinos al completar hidratación (2026-11-05)

`home-loading-accessibility.test.tsx`: **7 PASS** entre carga sin redirección prematura y seis destinos: anónimo→login, estudiante→student, admin/app_admin→admin y cambio obligatorio de contraseña según rol. Lint/typecheck PASS. El test controla directamente el store y el router; no prueba la integración de HTTP con navegador. S00 sigue PARTIAL por comparación integral y condiciones remotas/físicas UNKNOWN.

## S01 — anuncio del error de login en Flutter (2026-11-05)

El error global ya se presentaba visualmente en ambos clientes, pero Flutter no lo exponía como región viva como Next `role=alert`. Se añadió `Semantics(liveRegion: true)` al contenedor ya existente. Flutter `login_screen_test.dart` **3 PASS** y analyze PASS; Next `phase5b-login-accessibility.test.tsx` **2 PASS**, lint y typecheck PASS. Se valida el árbol semántico automatizado; TalkBack/VoiceOver, foco y hardware UNKNOWN. S01/R02/Fase5B permanecen PARTIAL.

## S01 — submit del login con teclado Flutter (2026-11-05)

`login_flow_test.dart` reproducía que la acción Done desde contraseña no invocaba login (0 llamadas). Flutter ahora ofrece Next en correo y Done en contraseña, conectado al submit validado existente. `login_flow_test.dart` + `login_screen_test.dart`: **5 PASS**; analyze PASS. Next conserva submit nativo del form; test focal de accesibilidad/error **2 PASS**, lint/typecheck PASS. Dispositivo y teclado físico, lector y foco real UNKNOWN. S01/R02/Fase5B siguen PARTIAL.

La misma prueba verifica que Next desde correo enfoca contraseña. Se retiró un callback manual redundante porque junto al avance estándar de Flutter saltaba ese campo; tras retirarlo, las suites focales siguen **5 PASS**. Es foco en widget test, no verificación con teclado físico.

Next `phase5b-login-accessibility.test.tsx` añade envío con `userEvent.keyboard("{Enter}")`; verifica una invocación con email/contraseña capturados. Suite actual **3 PASS**, lint/typecheck PASS. Esta prueba usa JSDOM y no reemplaza un E2E de navegador o teclado físico; ambos permanecen UNKNOWN.

## S01 — copy de credenciales inválidas (2026-11-05)

FastAPI devuelve 401 con detalle inglés fijo; Flutter lo convierte en “Correo o contraseña incorrectos” y Next antes exponía el detalle. Next store ahora mapea solo 401 al mismo mensaje. Prueba `phase1-auth.test.ts`: **9 PASS**; lint/typecheck/build webpack PASS. El resto de estados no se modifica ni se da por validado; login real, errores restantes y lectores/dispositivos siguen UNKNOWN.

La prueba de componente integra LoginPage con ese error401 simulado: submit por Enter, alerta española, no filtra detalle en inglés y conserva campos. Next login **4 PASS**; combinado store/UI **13 PASS**, lint/typecheck PASS. Sin endpoint o credenciales reales.

## S02 — enviar recuperación con teclado (2026-11-05)

El test Flutter confirmó que Done en correo no enviaba (`api.calls=[]`). El campo ahora usa `TextInputAction.done` y el handler validado existente. Flutter `phase5b_account_forms_test.dart`: **38 PASS**, analyze PASS; Next `phase5b-account-forms.test.tsx`: **33 PASS**, Enter en JSDOM, lint/typecheck PASS. Datos sintéticos y datasource/API mockeados: no se entregó correo. SMTP, teclado físico y lector UNKNOWN; S02/R02/Fase5B continúan PARTIAL.

## S03 — enviar restablecimiento con teclado (2026-11-05)

Done de Flutter en confirmación se reprodujo sin petición; ahora ejecuta `_resetPassword` con los validadores existentes. Next Enter se probó en JSDOM. Suites actuales Flutter account forms **39 PASS** y Next **34 PASS**; analyze/lint/typecheck PASS. Token y transporte sintéticos; no se cambió contraseña real ni se envió correo. Deep link/email real, hardware/lector y paridad integral siguen UNKNOWN; S03/R02/Fase5B PARTIAL.

## S09 — enviar cambio de contraseña con teclado (2026-11-05)

Done en confirmación Flutter se reprodujo sin petición; los campos quedaron con Next/Next/Done y el último llama al handler validado. Enter Next se prueba en JSDOM. Suites actuales Flutter account forms **40 PASS** y Next **35 PASS**; analyze/lint/typecheck PASS. Todo es sintético/mock, sin cambiar contraseñas reales. Sesión/dispositivo/lector y paridad integral UNKNOWN; S09/R02/Fase5B PARTIAL.

## S03/S09 — anuncios de error de servidor (2026-11-05)

Errores Flutter de reset/cambio se veían sin región viva, frente a `role=alert` Next. Se añadieron `Semantics(liveRegion: true)` alrededor de los mensajes actuales; tests 503 sintéticos verifican ambos flags. Flutter account forms **42 PASS**, analyze PASS; Next account forms **35 PASS**; `git diff --check` PASS. Es árbol automatizado, no lector físico. S03/S09 semántica del error probada; lectores/hardware y R02/Fase5B siguen UNKNOWN/PARTIAL.

## S09 — confirmación visible tras logout (2026-11-05)

Tras el cambio exitoso, ambos clientes invalidan la sesión y los guards navegan a `/login`; el formulario protegido podía desaparecer antes de presentar el éxito. Flutter muestra la confirmación en el messenger persistente y Next la publica en el Toaster global. La regresión Flutter verifica student/admin sintéticos, logout, redirect y aviso visible; suite focal **44 PASS**, analyze PASS. Next verifica `AuthGate`, redirect y aviso global al desmontarse el formulario durante logout; suite **36 PASS**, lint/typecheck/build webpack PASS. No se alteró el flujo de revocación. Cuenta/sesión reales y lector/dispositivo físico siguen UNKNOWN; S09/R02/Fase5B permanecen PARTIAL.

## R02L — transporte local de restauración Flutter S00 (2026-11-05)

La restauración Flutter ya convertía fallos de `/users/me` en estado anónimo y limpiaba la caché, pero esa ruta solo se cubría con el datasource simulado. El test nuevo `phase5b_session_transport_test.dart` usa `AuthRemoteDataSource`, `ApiClient` y Dio reales contra `HttpServer` loopback para **HTTP503**, **reset TCP** y **respuesta HTTP demorada4,3s** que excede el límite de4s. En los tres casos verifica la petición de perfil, estado anónimo, limpieza de caché clínica y solicitud de `SessionManager.clearSession`; el bearer es sintético.

Flutter test: **3 PASS**; `flutter analyze --no-pub`: **PASS**. Next `session-transport.integration.test.ts`: **3 PASS** (503, reset TCP, timeout Axios de5s), repetido para comparar. No hay llamada a FastAPI/PostgreSQL, credenciales reales ni alteración del protocolo. El `SessionManager` está simulado: el test no demuestra borrado del plugin de almacenamiento seguro en dispositivo. TLS/proxy/servicio desplegado, comparación visual/temporal pareada y lector/dispositivo físico siguen UNKNOWN. **R02L DONE** para el transporte loopback; **S00/R02/Fase5B PARTIAL**.

## R03U — nombre largo en acordeón del esquema estudiante S05 (2026-11-05)

**Causa raíz.** En Next, `StudentSchemePage` aplicaba `truncate` al nombre de la vacuna del trigger del acordeón. Flutter usa el título de `ExpansionTile`, que puede envolver. El test de Next falló primero al encontrar la clase `truncate` en un nombre sintético largo; se cambió únicamente esa clase por `break-words`.

Next `phase5b-detail-scheme.test.tsx`: **8 PASS**, incluyendo título largo completo. Flutter `scheme_detail_screen_test.dart`: **4 PASS**; el widget con nombre largo a320×568 ocupa varias líneas y no lanza excepción. Next lint/typecheck/webpack build: **PASS**; `flutter analyze --no-pub`: **PASS**. Chromium headless sobre el build Next, con respuesta sintética de usuario/esquema: **PASS** a320/768/1440 y720 CSS px; no hay ellipsis, overflow del nodo ni de la página. [Mediciones](evidence/phase5b/scheme-name-reflow/measurements.json).

Solo se altera la representación del título; estado, conteos, acciones y reglas clínicas no cambian. La comprobación720 CSS px aproxima reflow a200%, no es zoom nativo. Lector/dispositivo físico, contraste integral, escalado real y cobertura visual de estados restantes permanecen UNKNOWN. **R03U DONE** para este truncamiento; S05/R03/Fase5B siguen **PARTIAL**. Sin backend, migración, dependencia o commit.

## R03V — nombre y correo largos en listado administrativo S17 (2026-11-05)

Next `StudentMobileCard` truncaba ambos valores (`truncate`) mientras Flutter permite wrap. Se cambió la representación a `break-words`, sin tocar datos, controles o navegación. La prueba Next reprodujo el truncamiento y ambas regresiones pasaron: Next listado **2 PASS**; Flutter listado/paginación a320×568 **2 PASS**. Next lint/typecheck/build webpack, Flutter analyze y Chromium E2E **PASS**. En Chromium el nombre envuelve en320/640/720 CSS px; correo envuelve en320/640 y permanece completo en una línea a720; sin overflow horizontal. Los datos son sintéticos y las mediciones están en [evidencia agregada](evidence/phase5b/admin-student-list-reflow/measurements.json). Zoom nativo, lector/dispositivo, contraste y tabla con anchos reales UNKNOWN. **R03V DONE** solo para este recorte; S17/R03/Fase5B siguen **PARTIAL**.

## R03W — nombre largo en esquema administrativo S19 (2026-11-05)

El `AdminVaccineCard` Next truncaba el título de vacuna; Flutter lo deja envolver en `ExpansionTile`. Se reemplazó solo `truncate` por `break-words`. Next `phase5b-detail-scheme.test.tsx`: **9 PASS**; Flutter `admin_student_detail_screen_test.dart`: **4 PASS**, con wrap verificado a320×568; analyze/lint/typecheck/build webpack PASS. Chromium con respuestas API sintéticas confirmó título completo y sin overflow a320/640/720 CSS px. [Mediciones](evidence/phase5b/admin-scheme-title-reflow/measurements.json). No zoom nativo, lector/dispositivo, temas/estados completos o contraste integral; S19/R03/Fase5B permanecen PARTIAL.

## R03X — nombres de archivo y reflow del selector de evidencias S06 (2026-11-05)

Next truncaba nombres de archivo seleccionados e históricos. Flutter, al ensanchar cobertura a320×568, mostró un `RenderFlex overflow` de62 px en el selector de dosis debido al ancho intrínseco de su opción larga; el selector se ajusta ahora al espacio disponible. Next y Flutter permiten leer los nombres completos en varias líneas. Next selección/recuperación: **17 PASS**; Flutter selección: **15 PASS**, analyze PASS. Next lint/typecheck/build webpack y Chromium con archivos/API sintéticos a320/640/720 CSS px: **PASS**, sin overflow horizontal. [Mediciones](evidence/phase5b/evidence-file-reflow/measurements.json). R03X DONE para estos casos; scroll lector/dispositivo, zoom nativo, contraste y demás estados de S06 UNKNOWN. S06/R04/Fase5B siguen PARTIAL.

## R03Y — nombre largo de vacuna en catálogo administrativo S21 (2026-11-05)

Next aplicaba `truncate` al nombre de cada vacuna; Flutter lo muestra como `ListTile.title`, que envuelve. Una regresión de componente falló antes de la corrección al encontrar `truncate`; se cambió solo la presentación del nombre a `min-w-0 break-words`. Next `phase5b-catalog-dialog.test.tsx`: **14 PASS**; Flutter `vaccine_catalog_screen_test.dart`: **6 PASS**, incluido widget320×568 y nombre sintético largo. `flutter analyze --no-pub`, Next lint/typecheck/build webpack y Chromium E2E sintético a320/640/720 CSS px: **PASS**, texto completo sin overflow de elemento ni de página. [Mediciones](evidence/phase5b/admin-catalog-name-reflow/measurements.json). Zoom nativo, lector/dispositivo físico, contraste y resto de estados S21 UNKNOWN. R03Y DONE solo para el nombre de la fila; S21/R03/Fase5B continúan PARTIAL.

## R03Z — nombre largo en header fijo del detalle administrativo S19 (2026-11-05)

Next truncaba el nombre completo del estudiante en el header fijo; Flutter lo muestra en el título de `AppBar` y el test a320×568 confirma que envuelve sin excepción. El primer E2E midió solo116 px para el título y525 px de altura; en móvil se reordenó navegación/acciones arriba y nombre a ancho completo debajo, mientras `sm` conserva la fila inline. Next `phase5b-detail-scheme.test.tsx`: **10 PASS**; Flutter `admin_student_detail_screen_test.dart`: **4 PASS** y `flutter analyze --no-pub`: PASS. Next lint/typecheck/build webpack y Chromium con fixture sintético a320/640/720 CSS px: PASS, nombre multilínea visible y sin overflow horizontal; a320 el título ahora mide288×150 px. [Mediciones](evidence/phase5b/admin-student-name-reflow/measurements.json). Next mantiene el email truncado en el header; Flutter lo ubica dentro del perfil, diferencia explícita no cambiada. Zoom nativo, lector/dispositivo físico y cobertura integral S19 UNKNOWN; R03Z DONE solo para nombre/reflow, S19/R03/Fase5B PARTIAL.

## R04 — preview de último mensaje de comunicaciones S12/S13 (2026-11-05)

Flutter limita el preview a una línea (`maxLines: 1`); Next mostraba hasta dos (`line-clamp-2`), elevando tarjetas con mensajes largos. Next cambia solo el límite a una línea. `phase5b-communications-peer.test.tsx` y `phase5b_communications_peer_test.dart` verifican ambas representaciones; Next peer/recuperación: **48 PASS**, Flutter peer: **20 PASS**. Analyze, lint, typecheck, webpack build y Chromium sintético a320/640/720 CSS px: **PASS**; navegador confirma `-webkit-line-clamp:1`, una línea y sin overflow. [Mediciones](evidence/phase5b/communications-preview-line/measurements.json). E2E usa API interceptada, sin backend/PostgreSQL ni identidades institucionales. R04 DONE solo para este preview; S12/S13/R04/Fase5B siguen PARTIAL por cobertura integral y accesibilidad física UNKNOWN.

## R03AA — etiqueta de dosis larga en esquema administrativo S19 (2026-11-05)

Flutter `ListTile.title` permite wrap. Next `AdminDoseRow` aplicaba `truncate`; tras quitarlo, la fila daba solo96 px al título en320 px porque compartía espacio con tres acciones. Se cambió a wrap completo y, por debajo de768 px, etiqueta y acciones ocupan filas separadas; el layout horizontal se conserva desde768 px. Next `admin-dose-row.test.tsx` + `phase5b-detail-scheme.test.tsx`: **16 PASS**; Flutter `admin_student_detail_screen_test.dart`: **4 PASS**, `flutter analyze --no-pub`: **PASS**. Next lint, typecheck y build webpack: **PASS**. Chromium sintético a320/640/720 CSS px confirma texto multilínea sin truncamiento ni overflow horizontal; anchos/alturas de etiqueta medidos:262×140,540×60 y620×60 px, respectivamente. [Mediciones](evidence/phase5b/admin-scheme-title-reflow/measurements.json). Fixtures sintéticos, sin FastAPI/PostgreSQL. Lector/zoom/dispositivo, contraste integral y otros estados S19 UNKNOWN; R03AA DONE solo para etiqueta/reflow probado, S19/R03/Fase5B siguen PARTIAL.

## R03AB — expansión inicial de esquema administrativo S19 (2026-11-05)

Flutter `ExpansionTile` empieza cerrado; Next abría las dos primeras tarjetas por `defaultOpen={index < 2}`. Next cambia a paneles cerrados y conserva su activación explícita/clic/teclado. La regresión de componente falló antes del cambio; luego Next `phase5b-detail-scheme.test.tsx`: **10 PASS**, y las suites combinadas de detalle/dosis: **16 PASS**. Flutter detalle: **4 PASS**, analyze PASS. Lint, typecheck, webpack build y Chromium sintético PASS; Chromium verificó `aria-expanded=false` al cargar, apertura explícita y disponibilidad de dosis tras abrir. Datos sintéticos, sin backend. No se pierde acceso a dosis; los lectores/dispositivos físicos y los demás estados de S19 siguen UNKNOWN. R03AB DONE solo para el estado inicial; S19/R03/Fase5B continúan PARTIAL.

## Revalidación integrada de clientes — 2026-11-05

Suite completa Flutter: **443 PASS**. Suite completa Next: **571 PASS, 3 SKIP**. Los skips corresponden a los gates PostgreSQL definidos con `skipIf(!databaseUrl)`; no se configuró URL de base en esta revalidación. La primera corrida sandbox falló en tres sockets loopback por `EPERM`; la ejecución repetida fuera del sandbox pasó. Lint/typecheck/webpack de Next, analyze/formato de Flutter y el E2E sintético de S19 también pasaron. Sin nuevos cambios de código en esta revalidación; PostgreSQL, backend, migraciones/concurrencia, E2E final de todo el producto y accesibilidad nativa/física siguen pendientes. R07 y Fase5B permanecen PARTIAL.

**Actualización posterior R07, 2026-11-05:** la suite completa Next volvió a ejecutarse contra PostgreSQL18.6 temporal con base sintética `immuno_phase5b`: **574 PASS, 0 SKIP, 0 FAIL** en56 archivos; los tres casos condicionados por base también corrieron. El clúster está detenido y sus datos sintéticos quedan en `/tmp/pg-immuno-phase5b-20261105`; no se usaron datos institucionales. Flutter sigue en **443 PASS** y lint/typecheck/webpack de Next, analyze/formato de Flutter están PASS en la verificación previa. El gate global R07 continúa PARTIAL: falta suite backend completa, migraciones/concurrencia, E2E integrado final y accesibilidad física; Fase5B no se cierra.

**Actualización backend y E2E R07, 2026-11-05:** backend/PostgreSQL: **389 PASS, 24 SKIP, 0 FAIL**; los skips optativos se ejecutaron después por separado: migraciones **3 PASS** y navegadores Chrome con Next/FastAPI/PostgreSQL **21 PASS**. Cubre cuentas/datos sintéticos. Los cuatro fallos de la primera pasada browser se rastrearon a runners: acordeón cerrado, etiqueta `Sede` obsoleta, setter de input para `<select>` y botón de fila incorrecto; los cuatro casos se corrigieron y pasaron al repetirlos. No hubo cambios funcionales. Next completo **574 PASS/0 SKIP**, Flutter **443 PASS**, demás gates de cliente documentados arriba. Queda accesibilidad física y revisión final de diff/secretos; R07/Fase5B PARTIAL.

**Revalidación final R07, 2026-11-05:** backend/PostgreSQL repetido: **389 PASS,24 SKIP,0 FAIL**; Next completo con PostgreSQL sintético: **580 PASS,0 SKIP**; Flutter **443 PASS**. Next lint/typecheck/build webpack, Flutter analyze y Ruff PASS. Migraciones3 PASS en corridas dedicadas. Los **21 E2E integrados** se repitieron juntos en Chrome y pasaron; incluyen login R02N. El backend volvió a ejecutarse con acceso local porque el sandbox impedía sockets; el intento bloqueado no se cuenta. Las instancias PostgreSQL locales quedaron detenidas. El resultado automatizado está verificado; validación física R05, decisiones R06 y paridad integral de R02–R04 siguen UNKNOWN/PARTIAL. Fase5B no se cierra.

## Revalidación R07 — 2026-11-06

Backend/PostgreSQL completo **393 PASS,24 SKIP**; los gates optativos pasaron por separado: migraciones **3 PASS**, Chrome/Next/FastAPI/PostgreSQL **21 PASS**. Next con PostgreSQL **582 PASS,0 SKIP**, lint/typecheck/build webpack PASS. Flutter 3.41.6: analyze PASS, **445 tests PASS**, Dart format PASS. Ruff check/format y `git diff --check` PASS. Ejecución detallada y advertencias: [cierre R07](../audits/phase5b-closure.md).

La disponibilidad local de Flutter reportó Linux y Chrome, sin dispositivos móviles físicos. La auditoría del árbol de evidencia encuentra36 grupos, pero varias pantallas/grupos tienen capturas de una sola plataforma o carecen de un par que cubra los estados y viewports pedidos. No se extrapola de esos tests a equivalencia visual completa. R02–R04 continúan **PARTIAL** y validación física R05 **UNKNOWN**; H02/C02/A07 están DONE. **Fase5B = PARTIAL**, sin commit.

## Estado vigente tras C02/R07 — 2026-11-06

La decisión C02 es ocultar el destinatario cuando no se identifica a otra persona. La revisión final detectó un caso límite adicional: con `currentUserId=null`, la comparación `participant.id !== currentUserId` trataba a cualquier participante como contraparte. `communicationPeer` ahora retorna `null` si falta la identidad del viewer. Lista y detalle tienen regresiones para ese caso, además de los fixtures sin contraparte; suite focal **25 PASS** y suite Next completa/PostgreSQL **584 PASS,0 SKIP**. Lint, typecheck y build webpack **PASS**. Es una corrección de representación y no modifica FastAPI, destinatarios ni permisos.

R06 queda **DONE**: H02 permite Historial a `app_admin` conforme a la decisión recibida; C02 oculta contraparte no identificable incluso ante identidad incompleta; A07 consume opciones canónicas de semestres publicadas por FastAPI. Las etiquetas históricas `UNKNOWN`/`PARTIAL` de secciones previas describen el estado a su fecha y quedan supersedidas por esta consolidación para R06, sin cerrar R04.

R02–R04 siguen **PARTIAL**: el inventario contiene36 grupos, pero no hay pares Flutter/Next suficientes para todas las pantallas, estados, roles, temas y viewports aplicables. R05 está **BLOCKED/UNKNOWN**: el teléfono se enumera en USB como MTP, pero ADB devolvió cero dispositivos en dos consultas; no apareció el diálogo RSA. No se ejecutaron TalkBack, zoom nativo ni teclado virtual. El resultado físico no se sustituye por Chrome ni widget tests.

R07: backend/PostgreSQL **393 PASS,24 SKIP** (los gates optativos pasaron por separado: migraciones **3 PASS**, E2E Chrome integrado **21 PASS**); Next **584 PASS,0 SKIP**, lint/typecheck/build webpack **PASS**; Flutter **445 PASS**, analyze/formato **PASS**; Ruff y `git diff --check` **PASS**. No commit. Ver [cierre vigente](../audits/phase5b-closure.md) para evidencia y límites completos.

## Validación física Android R05 — 2026-11-07

| Pantalla / dimensión | Flutter físico | Evidencia | Estado / límites |
|---|---|---|---|
| Login anónimo / arranque | Smoke integration en POCO X4 Pro; usa auth fake y preferencias aisladas; llega a «Bienvenido» y los campos de login | [`integration_test/app_smoke_test.dart`](../../frontend/integration_test/app_smoke_test.dart), test físico **1 PASS**; [captura 1.0×](evidence/phase5b/android-physical-login/login-font-1.0.png) | **DONE** solo para arranque/login probado. No es login real ni valida servidor/red. |
| Texto grande | Escala de texto Android1.8×; correo envuelve sin truncarse y el botón «Ingresar» crece para mostrar completo su label | [captura física corregida 1.8×](evidence/phase5b/android-physical-login/login-button-font-1.8-fixed.png); test de bounds a escala explícita en `login_screen_test.dart` | **DONE** caso puntual; zoom nativo del sistema y otras pantallas **UNKNOWN**. |
| Zoom nativo Android | Antes de la prueba la ampliación estaba desactivada (`enabled=0`, escala configurada2.0) | Se activó el flag temporalmente y se intentó el triple toque; no se observó ampliación. Flag restaurado a0; escala y atajo conservados | **UNKNOWN**: el servicio de ampliación no llegó a activarse; no se atribuye a un fallo de la app. Requiere habilitación/validación desde Ajustes del dispositivo. |
| Teclado virtual | Se abrió al enfocar el campo; no se escribió texto | Ejecución física anotada en [auditoría](../audits/phase5b-implementation.md#validación-android-física-r05-y-revalidación-flutter--2026-11-07) | **DONE** para apertura en login; interacción de todos los formularios y resize por teclado **UNKNOWN**. |
| TalkBack | El servicio se enlazó temporalmente y la preferencia original desactivada se restauró; el usuario confirma que la comprobación ya se realizó previamente | El test widget verifica labels; no hay audio ni resultado escrito de la pasada física anterior. No se repite la interacción | **UNKNOWN** anuncio hablado, orden de foco y navegación real: la confirmación de ejecución no registra qué se oyó ni el orden observado. |
| Android Studio Emulator / smoke virtual | AVD API35 x86_64 en SDK local; host sin `/dev/kvm` | Reintento con aceleración software completó el arranque tras ~194s, pero captura mostró “System UI isn't responding”. Dos `flutter test integration_test/app_smoke_test.dart --no-pub -d emulator-5554` se quedaron en instalación y se cancelaron: **No tests ran**; un intento reportó ADB exit -2. ADB vio el AVD y Package Manager respondió, pero no se obtuvo pantalla de la app estable. | **BLOCKED**, no PASS ni fallo funcional. El smoke físico POCO 1 PASS sigue siendo evidencia separada; la prueba de lector/zoom y las demás pantallas no se sustituyen por AVD/Chrome. |
| Otras pantallas / VoiceOver | Sin verificación física equivalente | Sin capturas/pruebas de dispositivo para la cobertura completa | **UNKNOWN** para el resto de las22 pantallas, iOS/VoiceOver y zoom nativo separado. |

**Actualización física posterior, 2026-11-07:** el ajuste de altura del botón se comprobó a1.8× en el POCO; el texto aparece completo. El smoke de integración físico pasó **1 PASS**. El build exacto actual se instaló mediante `flutter run` después de desbloquear el teléfono y habilitar “Instalar vía USB”; ADB confirmó paquete y proceso. Escala restaurada a1.0×. El impacto de una instalación previa con firma distinta sigue UNKNOWN. Se recomienda desactivar “Instalar vía USB” después de la revisión manual; la app permanecerá instalada.

**R05 = PARTIAL; R02–R04/R07 y Fase5B siguen PARTIAL.** TalkBack audible/orden de foco, zoom nativo, otras pantallas, iOS/VoiceOver y paridad integral siguen UNKNOWN. Detalle/rollback: [auditoría R05](../audits/phase5b-implementation.md). No commit.
