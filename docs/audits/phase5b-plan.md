# Fase 5B — Plan de temas, accesibilidad y paridad visual controlada

Fecha inicial: 2026-10-09, America/Bogota. Revisión: 2026-10-26. La ejecución inicial se recuperó el2026-10-10 UTC. **PLAN_READY; IMPLEMENTACIÓN OBSERVADA PARTIAL, SIN CIERRE.**

## Estado consolidado — 2026-10-21

Esta tabla reúne los pendientes activos; las secciones cronológicas inferiores conservan los resultados de cada bloque y sus limitaciones. **FASE5B PARTIAL**. No interpretar una etiqueta histórica PENDING como reapertura de una corrección con evidencia posterior.

| ID / alcance | Estado actual | Pendiente para ese alcance |
|---|---|---|
| B5-C01, interlocutor conocido | DONE | Casos legacy sin otro participante se separan en C02. |
| B5-C03, capas de comunicaciones | DONE | No equivale a paridad visual completa. |
| B5-C04, coordinación/reintento de lectura Next | DONE | Componentes, E2E específico y suite integrada pasan; coordinación por instancia/marcador, no entre pestañas. |
| B5-C05, texto de mensajes propios Flutter/Next | DONE | Contraste y cuatro goldens nuevas pasan; controles/iconos/avatares no cubiertos por esta corrección. |
| B5-C06, estados de comunicaciones | DONE en estados y recuperación probados | Flutter: loading/empty/error/retry/success para student/admin/app_admin, 60 referencias nuevas y errores HTTP seguros. Next conserva pruebas/componentes y E2E previos. Las capturas web no cubren cada combinación de app_admin/retry; no afirmar igualdad de píxeles ni validación nativa integral. |
| B5-C07, búsqueda de destinatarios S12/S13 | DONE en búsqueda Flutter probada | Flutter distingue error/empty y ofrece retry; requests obsoletos no pueden retener spinner ni opciones. Suite Flutter comunicacional32 PASS, completa411 PASS/analyze PASS; Next74 PASS. Diferencia en autoasignación de destinatario estudiante documentada, sin cambiar política. |
| B5-P01, arranque de perfil Flutter | DONE | Primera carga sin perfil representa loading; no acceder a profile! antes de GET. Pruebas con ProfileNotifier real y Dio controlado. |
| B5-P02, lectura/reflow y retry S08 | DONE en escenas probadas | Perfil estudiante Next sin truncar valores; shell acotado a /student/profile y espacio disponible; doble retry comparte GET. 24 referencias Flutter,44 capturas web posteriores,46 casos E2E. No certifica accesibilidad nativa ni contraste integral. |
| B5-P03, refresco y borrador del perfil | DONE en recorridos probados | GET fallido retira datos/acciones y conserva borrador de la misma vista;PUT confirmado+GET fallido se distingue de PUT fallido,retry solo GET. 12 pruebas nuevas Next,18 Flutter,seis referencias nativas y E2E final del perfil pasan. No persistencia entre sesiones ni cierre de S22/accesibilidad nativa. |
| B5-E01, selección y envío de evidencias | DONE en recorridos probados | Retirada por ocurrencia;formulario congelado;Flutter descarta picker tardío. Backend402 PASS/0 SKIP,14 E2E;Next386 PASS/Flutter253 PASS y gates. Cuatro pares anotados,no cierre de S06 integral. |
| B5-E02, carga confirmada y recarga fallida de evidencias | DONE en recorridos probados | POST/GET separados, retry comparte GET y conserva página; borrador según confirmación. Backend403 PASS/0 SKIP,15 E2E;Next395 PASS/Flutter268 PASS y gates. S06 sigue PARTIAL como pantalla integral. |
| B5-H01, recuperación del historial | DONE en recuperación probada | Flutter y Next separan loading/empty/error;retry, metadata y paginación probados. H02 app_admin web está resuelto en navegación/guard según decisión;S11 integral sigue PARTIAL. |
| B5-M01, alta de administradores | DONE en alta verificada | Form nativo,validación contractual,borrador fijo/bloqueado,opcionales omitidos y una recarga.Next422 PASS/Flutter301 PASS;backend405 PASS/0 SKIP,17 E2E,migraciones/concurrencia.S20 integral sigue PARTIAL. |
| B5-M02, recuperación administradores Next | DONE en Next verificado |27 tests Next y E2E real:lectura segura,vacío/busy,reintento GET-only,POST/DELETE confirmados frente a lectura fallida.Next449 PASS/Flutter301 PASS;backend406 PASS/0 SKIP,18 E2E,migraciones/concurrencia.S20/M03 PARTIAL. |
| B5-M03, recuperación administradores Flutter | DONE en recuperación probada |Lectura/error/borrador,escritura confirmada/GET fallido,retry único,bloqueo y dispose:26 pruebas nuevas,Flutter327 PASS/Next449 PASS;backend406 PASS/0 SKIP,18 E2E,migraciones/concurrencia.R01 DONE;S20 integral PARTIAL. |
| B5-R02A, S02/S03/S09 formularios de cuenta | DONE en controles probados |Envío único,bloqueo,errores seguros,lifecycle,reflow,descripciones/copy,contraste oscuro y capas de cambio.Next485 PASS/Flutter364 PASS;backend407 PASS/0 SKIP con19 E2E sobre build inicial yE2E final específico PASS tras capas.R02 integral PARTIAL. |
| B5-R02B, S18 alta/importación | DONE en controles probados |Form nativo,lock común,preview consumida/error seguro/dispose y capa exacta.Next499 PASS/Flutter382 PASS;backend408 PASS/0 SKIP,20 E2E y migraciones/concurrencia sobre build final.R02/S18 integrales PARTIAL. |
| B5-R02C, S22 perfil base | DONE en controles probados |Borrador/lectura,PUT confirmado frente a lectura fallida,retry GET-only,form/lifecycle/capa scoped.Next528 PASS;Flutter402 PASS;backend409/0 SKIP,21 E2E y gates.Firma intacta y excluida,S22/R02 integrales PARTIAL. |
| B5-R02D, S00/S01 inicio y login | PARTIAL |S01 login Next asocia/anuncia errores;Next lint/typecheck/webpack PASS,Flutter suite405 PASS/analyze PASS. S00 Next usa el mismo timeout de4s de `/users/me` que Flutter;3 suites focales Next:14 PASS incluyen respuesta loopback tardía descartada. R02N ejecuta login E2E en Chrome con Enter desde contraseña:1 PASS contra BFF/FastAPI/PostgreSQL sintéticos. Servicio desplegado,TLS/proxy,paridad visual/temporal integral y validación física siguen UNKNOWN. |
| B5-R02E, S00 carga de restauración Next | DONE en semántica de carga |“Cargando…” ahora es status live polite;regresión1 PASS;Next completa528 PASS/3 SKIP,lint/typecheck/webpack PASS. No altera hidratación o navegación. |
| B5-R03A, S17 estado de vacunación en listado | DONE en representación Next probada |FastAPI emite denied;tipo Next y tabla/tarjeta/resumen ahora lo conservan separado de pending;1 regresión PASS;Next527 PASS/3 SKIP+lint/typecheck/webpack PASS.No cambia API ni clínica;S17/R03 integrales PARTIAL.|
| B5-R03B, S05 error inicial de esquema Flutter | DONE en retry probado |Flutter3.41.6/Dart3.11.4:widget test1 PASS,suite403 PASS al cerrar ese bloque,analyze y format PASS. SDK/cache temporales;sin build Android. S05/R03 integral sigue PARTIAL por estados/viewport/accesibilidad.|
| B5-R03E, S19 error inicial del detalle Flutter | DONE en recuperación probada |Error genérico + retry conjunto GET-only;2 tests PASS y suite Flutter final405 PASS/analyze/format PASS. Consultas siguen atómicas;paridad integral S19/R03 pendiente.|
| B5-R03F, S05 acordeón de vacunas Next | DONE en revisión de paridad |El código y test existente confirman aria-expanded/controls/región y teclado nativo Enter/Espacio;7 tests focalizados PASS. Sin cambio funcional;captura pareada/lector físico S05 siguen UNKNOWN.|
| B5-R03G, S21 estado vacío de catálogo Flutter | DONE en estado vacío probado |La lista vacía ya no queda en blanco;mensaje explícito y pull-to-refresh sobre lista vacía. Widget test PASS;Flutter analyze y suite final406 PASS,format PASS. S21/R03 integral sigue PARTIAL.|
| B5-R03AC, S21 refresco explícito Next | DONE en refresco probado |Se añade actualización manual equivalente al pull-to-refresh Flutter en catálogo poblado y vacío;deshabilitada durante la lectura. Next 17 PASS,lint/typecheck/build webpack PASS;Chrome sintético320/640/720 CSS px verifica control disponible y sin overflow. S21/R03 integral sigue PARTIAL.|
| B5-R03AE, S21 conservar crear ante error de lectura no-auth | DONE en error503 probado |Next conserva encabezado/crear y QueryError con retry ante503;401/403 siguen sin acciones. Suite catálogo20 PASS,lint/typecheck/webpack y E2E viewport PASS. No cambia permisos FastAPI;S21/R03 integral sigue PARTIAL.|
| B5-R05A, S21 estado de carga accesible | DONE en semántica automatizada |Flutter `CircularProgressIndicator` expone `SemanticsRole.loadingSpinner`;Next anuncia carga con `role=status` y `aria-live=polite`. Next 18 PASS y lint/typecheck/build webpack PASS. TalkBack/VoiceOver y lector físico siguen UNKNOWN.|
| B5-R03H, S05 estado vacío de esquema Flutter | DONE en estado vacío probado |La respuesta exitosa sin vacunas ahora explica el estado y permite pull-to-refresh aunque la lista sea corta. Tests focales2 PASS;Flutter analyze y suite final407 PASS;format ejecutado. S05/R03 integral sigue PARTIAL.|
| B5-R03I, S17 paginación administrativa | DONE como revalidación documental |La matriz ya reflejaba páginas del backend en ambos clientes;lo obsoleto era la auditoría. Flutter4 PASS,Next8 PASS;el E2E Fase5A existente evidencia navegación/filtros/reload. Sin cambio funcional;R03 integral PARTIAL.|
| B5-N10, S10 errores de lectura y marcado | DONE en errores probados |Flutter limpia datos retenidos en 4xx/cancelación y anuncia fallo de marcado;Next student/admin anuncia fallo de mutación. Flutter409 PASS/analyze PASS;Next530 PASS/3 SKIP,lint/typecheck/webpack PASS. Diferencia de navegación al fallar marcado permanece UNKNOWN;accesibilidad física UNKNOWN.|
| B5-H02, historial web app_admin | DONE en acceso web | Decisión: sí. Next muestra el enlace Historial y admite ambos roles administrativos; FastAPI ya autorizaba admin/app_admin. Sin cambio de permisos de servidor. |
| B5-C02, hilo sin interlocutor identificado | DONE en representación | Decisión: ocultarlo. Flutter y Next omiten nombre/avatar/etiqueta cuando no hay otro participante identificable; no asignan destinatarios. |
| B5-A07, opciones de semestre | DONE en opciones acordadas | Decisión: usar Flutter1–10. FastAPI publica esas opciones; Next las consume en dashboard, listado y formularios. Altas nuevas validan1–10; lecturas/filtros conservan compatibilidad histórica hasta20. |
| Otras pantallas/estados del inventario | PARTIAL | Completar comparación pareada en formularios/listas/perfil/detalle/esquema/evidencia/catálogo; los bloques anteriores cubren solo los estados documentados. |
| Accesibilidad y reflow nativos | UNKNOWN | Lectores, zoom nativo, teclado virtual y dispositivos; contraste de controles/iconos y composición global no cerrados por el contraste de mensajes. |
| UI-16/UI-17 | BLOCKED por alcance | Sin cambios de certificado/verificador, PDF/QR. |

Inventario restante finito:[R01–R07 y22 pantallas incluidas](phase5b-remaining-work.md). Distingue trabajo técnico,decisiones,validación física y exclusiones;no inventa un porcentaje ni plazo.No cerrar5B al completar solo M03.

### Resolución R06 recibida — 2026-11-06

H02: sí, app_admin puede consultar el historial web. C02: ocultar la contraparte cuando no se identifica a otra persona. A07: usar las opciones Flutter1–10, publicadas por FastAPI para que Next las consuma. Las tres decisiones están implementadas y verificadas con pruebas focales; el gate E2E PostgreSQL/Chrome pasó. R06 está DONE. R04 sigue PARTIAL por cobertura integral de pantallas/estados y R05 UNKNOWN por validación física.

Los siguientes grupos de trabajo son: completar el inventario restante por pantalla, validar accesibilidad nativa y ejecutar el cierre integrado. T-02/T-03 y almacenamiento real siguen pendientes fuera de esta validación visual y no se consideran validados con datos sintéticos. [Evidencia y rollback actuales](phase5b-implementation.md#continuación--h01-recuperación-del-historial).

Gates H01:backend/PostgreSQL404 PASS/0 SKIP,51 warnings,452,11s,dieciséis E2E y tres migraciones existentes;Next411 PASS/lint/typecheck/build webpack PASS;Flutter297 PASS/analyze/formato PASS. E2E final reforzado1 PASS/17,43s. [Evidencia y rollback](phase5b-implementation.md#continuación--h01-recuperación-del-historial). Sin migraciones nuevas,decisiones clínicas ni commit.

Alcance inicial: **preparar el plan, sin modificar código**. La continuación anterior avanzó en componentes de tema y pruebas pese a ese límite; se detuvo y documentó. Autorización posterior explícita del usuario: **implementar ambas correcciones diagnosticadas y verificarlas**, únicamente Enter del E2E y contención de decoración. Ambas se implementaron con evidencia en [phase5b-implementation.md](phase5b-implementation.md). Las continuaciones posteriores se acotaron, en sus mensajes de inicio, al bloque2 (detalle/esquema), al **bloque3, catálogo y diálogos**, y al **bloque4, etiquetas/notificaciones/panel de usuario**. Sus resultados se separan en ese informe; la comparación integral de estados sigue pendiente. El bloque5 comenzó posteriormente por notificaciones, documentado al final; el cierre integral sigue pendiente. Fase5A permanece DONE según [phase5a-closure.md](phase5a-closure.md); no se atribuyen sus resultados históricos a esta fase.

Fuentes leídas: `AGENTS.md`, skills locales `ui-parity`, `quality-gates`, `security-health`, [phase5-ui-parity.md](phase5-ui-parity.md), [phase5-parity-matrix.md](../ui/phase5-parity-matrix.md), cierre/implementación de Fase 5A, temas y componentes actuales de Flutter/Next. Referencia de tokens extraída: [design-tokens.md](../ui/design-tokens.md).

## Objetivo y límites

Corregir UI-14/UI-15 en bloques revisables: representación clara/oscura/sistema, etiquetas, foco, teclado, pestañas, expansión y responsive. Flutter es referencia funcional/visual inicial; FastAPI sigue siendo autoridad de negocio y permisos. Paridad significa información, acciones y estados equivalentes con controles apropiados para cada plataforma, no igualdad ciega de píxeles.

Exclusiones vigentes:

- UI-16/UI-17 **BLOCKED por alcance**: verificador público, capacidades de certificados, firma visual, responsable, historial y revocación. No cambiar sus funciones ni añadir pantallas.
- Sin backend, contratos, migraciones, autenticación de Fase 2, reglas clínicas, PDF/QR, Maps, Azure, stores o publicación.
- UI-12 (límites de fechas) y catálogo institucional de opciones de UI-18 no se mezclan con el bloque visual. Continúan pendientes/UNKNOWN según su evidencia; no copiar valores locales Flutter como política institucional.
- T-02/T-03 y Fase 3B siguen PARTIAL; almacenamiento real pendiente. No se declara producción lista.
- Sin commit. No instalar dependencias ni herramientas automáticamente en la etapa de planificación.

## Evidencia actual, contrastada con el audit

Líneas referidas al estado inspeccionado; pueden cambiar durante implementación. Son hallazgos de código, no resultados de ejecución visual.

| ID / prioridad | Causa raíz y evidencia actual | Impacto | Propuesta / verificación necesaria |
|---|---|---|---|
| B-01 / UI-14 P2 | Antes del bloque2, detalle, AdminVaccineCard y AdminDoseRow fijaban fondos/textos/bordes oscuros. AppTheme Flutter tiene valores por brightness. | Detalle administrativo no seguía el tema claro; el título de dosis podía quedar blanco sobre la nueva tarjeta clara. | **Corrección implementada** con tokens existentes y CSS/capturas de datos, comentario y confirmaciones en temas opuestos al SO. Paridad visual completa de carga/vacío/error aún **UNKNOWN**. |
| B-02 / UI-14 P2 | Antes del bloque3, VaccineEditorModal y ToggleChip fijaban colores oscuros. | Editor/chips contradecían preferencia clara. | **Corregido** con tokens existentes y capturas/CSS de editor, edición, confirmación, guardado y error; sin cambiar payloads/reglas. Paridad Flutter completa **UNKNOWN**. |
| B-03 / UI-14 P2 | El catálogo usaba `dark:` sin seguir consistentemente data-theme manual. | Algunos consumidores seguían SO en lugar de preferencia manual. | **Corregido en catálogo**: tokens semánticos en indicadores/inactividad/advertencia. No hay modificación global de variantes Tailwind ni cierre de todos los consumidores. |
| B-04 / UI-15 P2 | Antes del bloque2, detalle no tenía tablist/tab/tabpanel; las vacunas no describían expansión. | Selección y contenido relacionado no se comunicaban con semántica completa. | **Corrección implementada**: paneles estables, flechas/Home/End para foco, Enter/Espacio para activación explícita y expansión con aria-expanded/controls. Tests de componente y Chrome conservan URL/página/retorno. Lectores de pantalla reales **UNKNOWN**. |
| B-05 / UI-15 P2 | Antes del bloque3, Overlay solo cerraba por click exterior. En Chrome, el primer dialog nativo dejó BODY activo al Tab desde el último control. | Selección y teclado no quedaban contenidos. | **Corregido**: dialog nativo/modalidad/fondo inerte más ciclo explícito de Tab/Shift+Tab; foco inicial/retorno, Escape/backdrop, cierre y edición bloqueados durante escritura. Tests de componente y Chrome. Lectores/dispositivos reales **UNKNOWN**. |
| B-06 / UI-15 P2 | Field de estudiantes/detalle/alta/admins y catálogo tenían Label sin asociación al control. | Nombre accesible/click en etiqueta no garantizados. | **Corregido en catálogo y en lista/alta/detalle de estudiantes y alta de administradores**: IDs únicos y etiquetas asociadas. Chrome verifica foco por click nativo; atributos, opciones y payloads se conservan. Otras pantallas fuera de esta lista no se dan por verificadas. Sin nueva validación clínica. |
| B-07 / UI-15 P2 | Antes del bloque4, NotificationsList tenía span role=button/tabIndex dentro del botón de abrir. | Dos acciones anidadas interfieren con teclado y nombre accesible. | **DONE** controles hermanos nativos: marcar no navega; abrir conserva lectura+navegación de Flutter. Componente y Chrome comprueban contador/recarga por rol contra PostgreSQL. |
| B-08 / UI-15 P2 | Antes del bloque4, UserMenu declaraba role=menu con links, selector y logout sin el patrón de teclado correspondiente. | Semántica/teclado integral del menú no quedan definidos por probar únicamente la selección de tema. | **DONE** panel disclosure de navegación/preferencias con controles nativos; Tab/Enter/Espacio, Escape/retorno y cierre al salir el foco. Logout conserva su función exacta; Chrome verifica 401 posterior. Comparación Flutter integral pendiente. |
| B-09 / responsive P2 | Círculos absolutos del fondo ampliaban el login390→446 sin contención. | Autoescalado móvil demostrado; comparación scrollWidth≤innerWidth aislada podía ocultarlo. | **DONE D-02** en el alcance probado: capa decorativa recortada, contenido separado y medidas320/390/768/1440+scroll vertical PASS. Responsive completo de otros estados sigue pendiente. [Implementación](phase5b-implementation.md). |

Correcciones ya presentes y que no deben repetirse como defectos abiertos: perfil Next usa labels enlazados; ThreadDetail ya tiene label de respuesta; AppShell ya tiene navegación móvil; Flutter detalle y catálogo ya muestran tooltips en varias acciones. El audit histórico no sustituye esta inspección.

No se afirma incumplimiento/conformidad global de accesibilidad. Contraste renderizado, lector de pantalla y geometría en dispositivos reales siguen **UNKNOWN** hasta producir evidencia.

## Bloques propuestos de implementación

### Bloque 0 — Baselines y criterios por pantalla

- Causa: matriz inicial fue documental; no hay capturas pareadas ni mediciones que permitan justificar una paridad visual cerrada.
- Preparar fixtures deterministas sintéticos, roles y metadata de captura; baseline de código para separar fases anteriores sin commit.
- Pantallas iniciales: shell/dashboard, estudiantes/lista/detalle, esquema, catálogo/editor, formularios, notificaciones y comunicaciones. Excluir pantallas UI-16/UI-17.
- Archivos documentales/artefactos previstos: `docs/ui/phase5b-parity-matrix.md`, capturas organizadas por pantalla/estado/tema/viewport y futuro `docs/audits/phase5b-implementation.md`.
- Criterio: inventario de capturas realizadas frente a faltantes; no usar capturas de una sola plataforma como prueba de equivalencia.
- Riesgo/rollback: fixtures pueden variar tipografía/datos; registrar SDK/navegador/fuentes y preservar baseline. Sin cambio funcional.

### Bloque 1 — Temas y componentes compartidos

- Causa: mezcla de variables, `dark:` y colores literales; preferencia manual y SO pueden divergir.
- Archivos: `globals.css`, `lib/theme/store.ts`, `theme-toggle.tsx`, `ui/badge.tsx`, `ui/alert.tsx`, `app-shell.tsx` y componentes afectados. Revisar layout solo si la inicialización del tema requiere una corrección demostrada.
- Solución: aplicar mapa de tokens actual, mantener `ic_theme` y modos; selección accesible y primer plano/foco adecuados sin renovar identidad. Preferir eliminar variantes inconsistentes en componentes intervenidos a introducir otro mecanismo global.
- Antes del gate se identificaron la secuencia Enter incompleta de CDP y el desbordamiento decorativo de `components/brand.tsx`. **D-01/D-02 ya están DONE** tras la autorización acotada y sus pruebas; detalle en [phase5b-implementation.md](phase5b-implementation.md). Eso no autoriza añadir los demás cambios de este bloque.
- Tests nuevos: persistencia inválida/storage deshabilitado; selección accesible; CSS real bajo manual light/SO dark, manual dark/SO light, system/SO light y system/SO dark; recarga/hidratación/cambio de preferencia del SO.
- Gate: tests de componentes + navegador; contraste y capturas reales de componentes. Tests de estado de themeStore no prueban estilos renderizados.
- Riesgo/rollback: componentes compartidos alcanzan otras pantallas; inspeccionar consumidores y hacer smoke sin añadir funciones a certificados. Revertir bloque visual de forma aislada, conservando preferencias existentes.

### Bloque 2 — Detalle y esquema

Estado de avance: correcciones técnicas implementadas; verificación y límites en [phase5b-implementation.md](phase5b-implementation.md#bloque-2--detalle-y-esquema). No se cierra la comparación visual integral ni UI-14/UI-15.

- Causa: fondos oscuros fijos, pestañas y expansión sin relaciones semánticas.
- Archivos: `admin/students/[id]/page.tsx`, `student/scheme/page.tsx`, `components/admin-dose-row.tsx`.
- Solución: tokens, tabs con panel asociado y teclado consistente, expansión con ID estable y estado accesible; foco visible. Mantener todo dato, estado, fecha, señal backend y orden de acciones.
- Tests nuevos: selección con teclado, aria-selected/expanded/controls; tab URL+reload+back; foco al colapsar; data/loading/empty/error en claro/oscuro. Regresión comentario ≠ revisión, confirmaciones y permisos.
- Gate: componentes + Chrome con backend sintético; no modificar CertificateHistory, descarga, emisión/revocación ni firma.
- Riesgo/rollback: cambiar tab/foco puede alterar navegación o desmontaje; conservar serialización de Fase 5A y verificar cache/drafts. Revertir cambios de presentación/semántica conservando mutaciones separadas.

### Bloque 3 — Catálogo y diálogos

Avance de esta continuación: correcciones implementadas y E2E aislado PASS; ejecución integrada y límites en [phase5b-implementation.md](phase5b-implementation.md#bloque-3--catálogo-y-diálogos). El backend funcional y las decisiones del catálogo permanecen intactos.

- Causa: Overlay no maneja foco/teclado y editor fija estilos oscuros.
- Archivos: `admin/vaccines/page.tsx` y, si se justifica, nuevo componente de diálogo sin dependencias adicionales.
- Solución: diálogo con nombre, foco inicial, Tab/Shift+Tab contenido, Escape y retorno al disparador; bloqueo/cierre coherente con escritura en curso. Tokens y etiquetas en controles/dosis dinámicas. No alterar lógica de guardado ni reconciliación.
- Tests nuevos: teclado completo, click exterior/Cancelar/Escape sin llamadas API; guardar una sola vez; fallo conserva valores; foco al añadir/quitar fila; permisos app_admin; zoom y scroll con teclado virtual cuando exista dispositivo.
- Gate: componente + CDP de foco real + captures de modal en claro/oscuro; mocks de catálogo no se presentan como prueba del permiso backend.
- Riesgo/rollback: atrapamiento de foco puede impedir controles o cierre; probar teclado en navegador. Revertir componente/presentación sin modificar datos ni contratos del catálogo.

### Bloque 4 — Etiquetas, listas y menús

- Causa: campos sin asociación, acciones anidadas de notificación y patrón de menú incompleto.
- Archivos: páginas de estudiantes/lista/alta/detalle/admins, `notifications-list.tsx`, `user-menu.tsx` y helpers de campos si son necesarios.
- Solución: etiquetas y ayudas asociadas, botones con nombres claros, controles hermanos, lectura/selección perceptible además de color. Mantener filtros, paginación, retorno y formularios de Fase 5A.
- Tests nuevos: getByLabelText/getByRole, IDs únicos en repetidores, click label enfoca control; Enter/Espacio por acción; abrir notificación no invoca otra mutación; lectura actualiza contador; menú y selección por teclado. Logout conserva el flujo de autenticación/FCM existente.
- Gate: componentes + navegador, regresiones de contexto y doble submit. No añadir nuevas validaciones de dominio ni copiar opciones institucionales.
- Riesgo/rollback: separar acciones puede cambiar zonas clicables; comparar con Flutter y documentar. Revertir layout/semántica sin restaurar acciones anidadas inseguras ni modificar escritura backend.

### Bloque 5 — Comparación Flutter y ajustes mínimos demostrados

- Causa: Flutter también utiliza constantes en algunos textos/estados; no es prueba automática de contraste/accesibilidad correcta.
- Archivos de referencia: `core/theme/app_theme.dart`, pantallas de detalle/esquema/catálogo/notificaciones y widgets comunes Flutter.
- Solución posible: únicamente tema/semántica/tooltip/foco demostrados por comparación, manteniendo datos, reglas, transiciones y navegación. No convertir este bloque en rediseño Flutter.
- Tests nuevos previstos: widget/semantics, texto ampliado, claro/oscuro y golden estable con fuentes locales. Confirmar disponibilidad de fuentes/renderer antes de aceptar un baseline golden.
- Gate: analyze/test y capturas pareadas; TalkBack/VoiceOver reales se registran como pendientes si no hay dispositivo. Sin build nativo ni credenciales de publicación como requisito inventado para estos cambios documentales.
- Riesgo/rollback: renderizadores y métricas tipográficas difieren entre plataformas; comparar jerarquía/capacidad, no solo píxeles. Revertir únicamente ajustes de presentación, manteniendo funcionalidad de Fase 5A.

### Bloque 6 — Gate integrado y documentación

- Ejecutar Next tests/lint/typecheck/build webpack; Flutter analyze/test/format; backend con PostgreSQL para regresiones de permisos/intención/concurrencia; E2E Chrome sobre el build final.
- Repetir comentario sin aprobación, aprobar/denegar explícitos, filtros+página→detalle→regreso, tabs+reload, doble submit/respuesta retrasada; añadir teclado/temas y modales sin efectos clínicos.
- Actualizar matriz y `phase5b-implementation.md` con causa, archivos, tests/comandos/resultados, riesgo, rollback y UNKNOWN. Un futuro cierre solo refleja gates ejecutados.
- Revisar diff, archivos nuevos, secretos/PII en artefactos y `git diff --check`; distinguir cambios preexistentes. Sin commit.

## Matriz de validación prevista

En cada fila: datos, loading, empty, error+retry y success cuando aplique; tema claro/oscuro/sistema, roles permitidos y negativos, sesión expirada antes/durante operación. Los estados se inducen con datos/respuestas sintéticas existentes de FastAPI; no se calculan clínicamente en el cliente.

| Pantalla / referencia Flutter | Next / validación principal | Evidencia nueva pendiente |
|---|---|---|
| Dashboards + navegación por rol | AppShell, dashboard, UserMenu, selector de tema | Teclado, ruta activa, contraste y responsive en manual/SO opuestos. |
| AdminStudentListScreen | /admin/students | Labels/filtros, primera/última página, retorno privado y contexto tras zoom. |
| AdminStudentDetailScreen | /admin/students/[id] | Tres tabs, perfil/esquema/evidencia, foco y ambos temas. Capacidades de certificados excluidas. |
| SchemeDetailScreen | /student/scheme + DoseRow | Expansión, etiquetas, foco/registro representado y estados backend, sin cambiar límites clínicos. |
| VaccineCatalogScreen y editor | /admin/vaccines | Modal/cierre/errores/filas dinámicas y permisos app_admin. |
| CreateStudentScreen + AdminManagementScreen | Alta/importación y admins | Labels, resultados multipágina, responsive; catálogo de opciones institucionales UNKNOWN. |
| Perfil y evidencia | Perfiles/evidence | Smoke de etiquetas/carga/error y formularios ya corregidos; firma/certificados excluidos. |
| NotificationsScreen | NotificationsList | Abrir/marcar como acciones independientes; lectura y contador confirmados. |
| CommunicationsScreen/DetailScreen | CommunicationsPage/ThreadDetail | Teclado, nombres, paneles, error/read retry; roles y retorno preservados. |

Propuesta inicial de viewports de prueba, sin declararlos requisitos institucionales: móvil390×844, tablet768×1024 y escritorio1440×900; zoom/texto200% y ancho320 como prueba adicional de reflow. Ajustar cobertura si una limitación real se demuestra. Las dimensiones no sustituyen un dispositivo o teclado virtual.

Naming propuesto de evidencia: pantalla/rol/estado/tema/viewport/plataforma. Solo fixtures sintéticos, sin sesión/tokens/PII reales en nombres, capturas o árbol de accesibilidad exportado. Capturas y CDP complementan pruebas manuales, no acreditan por sí solos conformidad universal.

## Tests existentes y faltantes

| Existente | Lo que sí demuestra | Falta para 5B |
|---|---|---|
| Next `lib/__tests__/theme.test.tsx` (2 tests) | Preferencia almacenada/restaurada y recuperación de JSON inválido. | SO contra preferencia, CSS calculado, contraste y selección accesible. |
| `phase5a-student-detail.test.tsx` | Confirmaciones, permisos representados, deep link/retorno y errores. | Tabs por teclado, relaciones semánticas, foco y temas. |
| `phase5a-queries.test.tsx` | Error con retry en pantallas y mensajes HTTP diferenciados. | Lectura/visibilidad con zoom, foco al retry y contraste efectivo. |
| `phase5a-session-navigation.test.tsx` | Expiración montada, descarte de respuesta anterior y enlaces móviles. | Foco/cierre de diálogo al expirar y árbol accesible sin contenido previo. |
| `phase5a-list-sync.test.tsx` | Paginación, contexto privado y sincronización de mutaciones. | Labels/teclado y capturas responsive. |
| Harness real `test_phase5a_browser.py` + `phase5a-browser.mjs` | Chrome→Next→FastAPI→PostgreSQL, intención/permisos/contexto/doble submit/GET retrasado. | Las variantes5A/5B pasan tras las dos correcciones; siguen faltando foco de diálogo y comparación completa Flutter/Next de los demás bloques. No se borra cobertura5A. |
| Flutter `core/theme/app_theme_test.dart` | Conservación de transiciones por plataforma. | No mide colores/contraste; faltan widgets y goldens de las pantallas intervenidas. |

Se propone utilizar Testing Library/Vitest, flutter_test y CDP ya disponibles. Un motor adicional de accesibilidad sería una mejora evaluable; **no se instala ni se vuelve gate implícito en este plan**. Lectores de pantalla/dispositivos, fuentes de golden y emuladores quedan UNKNOWN hasta inspeccionar disponibilidad.

## Condiciones de cierre y estado actual

Una implementación posterior solo podrá declarar un bloque DONE cuando sus tests/gates pasen y la evidencia visual exigida exista. Cuando falte comparación Flutter/Next o prueba manual relevante, separar el cambio técnico probado de la validación pendiente; no presentar JSDOM como captura/lector ni screenshots como prueba de permisos. Fallo crítico funcional/permisos impide cierre.

Estado de la entrega original del plan: documentación preparada sin cambios de código ni suites nuevas. Ese estado describe aquel momento, no el árbol actual. La presente revisión solo actualiza documentación y conserva los cambios encontrados. Los PASS de 5A son evidencia histórica explícitamente separada, no resultados nuevos de 5B.

## Estado observado al retomar: cambios y verificación pendientes

Registro histórico del árbol antes del diagnóstico y la autorización acotada. Las mediciones/capturas se actualizaron posteriormente; la evidencia final figura en la última sección y en el audit de implementación.

La comparación SHA-256 contra el inventario de 543 archivos previo al avance de temas identifica 25 archivos añadidos/modificados: 12 de código/pruebas y 13 artefactos visuales. No debe usarse `git diff HEAD` como aislamiento de esta fase: el repositorio contiene cambios sin commit de fases anteriores.

| Área encontrada | Archivos / evidencia | Estado y límite |
|---|---|---|
| Tokens y tema inicial | `frontend-next/src/app/globals.css`, `layout.tsx` | Nuevos primeros planos/acciones, color-scheme y validación de preferencia almacenada. **PARTIAL**, pendientes de gate final; sin identidad institucional nueva aprobada. |
| Componentes compartidos | `components/app-shell.tsx`, `theme-toggle.tsx`, `ui/button.tsx`, `ui/badge.tsx`, `ui/alert.tsx` | Variables semánticas, selección anunciada y foco. **PARTIAL**. Su alcance compartido exige smoke de consumidores, incluso cuando la capacidad de una pantalla esté excluida. |
| Tests Next | `components/__tests__/phase5b-theme.test.tsx`, `ui/__tests__/badge.test.tsx`, `tests/e2e/phase5b-theme-browser.mjs` | Tests de preferencia/script y componentes; E2E ampliado con teclado/viewport. No confundir assertions de clases con contraste renderizado. |
| Harness PostgreSQL/navegador | `backend/tests/test_phase5a_browser.py` | Cambio de pruebas, no de backend funcional. Parametriza los flujos 5A y 5B. La variante 5B falla en la última ejecución completa. |
| Referencia Flutter | `frontend/test/core/theme/phase5b_palette_reference_test.dart` | Swatches de AppColors y artefactos de paleta; **no** capturas de pantallas, tipografía, semántica ni paridad completa. |
| Artefactos | `docs/ui/evidence/phase5b/shared-theme/` | Capturas Next y paletas Flutter. `measurements.json` corresponde a una ejecución anterior: carece del campo `palette` que el runner actual añade y no contiene la captura de teclado prevista. No acredita éxito del runner actual. |

No se encontraron cambios adicionales respecto a esa línea base en backend funcional, migraciones, contratos, autenticación de Fase 2, Flutter funcional, dependencias o lockfiles. Esta comprobación distingue el avance de temas del trabajo anterior; no acredita una revisión funcional global.

Última ejecución completa recuperada, PostgreSQL sintético y navegador habilitados:

```sh
# Desde backend/, infraestructura local de pruebas ya existente.
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs
```

Resultado real: **1 FAILED, 386 PASSED, 3 SKIPPED, 7 warnings, 152.91 s**. Fallo: `test_browser_comment_review_permissions[phase5b-theme-browser.mjs]`. Los tres skips corresponden a migraciones que requieren bases desechables/variables específicas; no se cuentan como PASS ni se sustituyen por evidencia histórica. En la primera revisión faltaba el mensaje completo. La continuación de diagnóstico lo reprodujo: timeout al activar Claro por una secuencia CDP incompleta de Enter. Una sonda temporal permitió alcanzar un segundo fallo, desbordamiento móvil causado por decoración absoluta. Ambas causas y los resultados FAILED se documentan en [phase5b-theme-diagnosis.md](phase5b-theme-diagnosis.md); ambas correcciones se implementaron posteriormente; el fallo se conserva como evidencia histórica.

Orden del diagnóstico y su continuación:

1. Revisar y aprobar o descartar explícitamente los cambios de temas existentes, aislados de fases previas. No aplicar una reversión global al árbol sucio.
2. **DONE**: diagnóstico, autorización explícita, implementación de ambas correcciones sin debilitar assertions y gate integrado satisfactorio.
3. Completar la línea base por pantalla/estado y su comparación Flutter/Next; las muestras de color solo cubren la paleta.
4. Cerrar el bloque 1 con sus gates y luego seguir los bloques 2–6 de este plan, uno por uno. No avanzar con un fallo crítico pendiente.

No hay nuevas instalaciones ni migraciones en esta revisión. Rollback propuesto: recuperar exclusivamente versiones previas de los archivos de este bloque después de revisar su diff; conservar los cambios de otras fases y los datos. El inventario SHA-256 detecta cambios, pero **no es una copia restaurable** de sus contenidos.

## Resultado de la autorización posterior acotada

**D-01/D-02 = DONE** con regresiones: backend/PostgreSQL387 PASS y3 SKIP explícitos (migraciones sin sus bases/variables), ambos E2E Chrome PASS sobre webpack final; Next127 PASS, lint/typecheck/build PASS; Flutter analyze PASS y57 tests PASS. Sin migraciones nuevas ni dependencias modificadas.

La [matriz acotada](../ui/phase5b-parity-matrix.md) y el [audit de implementación](phase5b-implementation.md) distinguen la paleta coincidente de una comparación de pantallas completas. Los pasos pendientes descritos arriba conservan su orden para una autorización futura; estas dos correcciones no cierran todo el bloque1 ni UI-14/UI-15.

Ese resultado corresponde a la primera autorización acotada. Las continuaciones de bloques2 y3 están documentadas por separado en [phase5b-implementation.md](phase5b-implementation.md): última ejecución integrada388 PASS/3 SKIP, Next147 PASS y Flutter57 PASS; lint/typecheck/webpack/analyze pasan. Los pasos restantes conservan su orden; no se cierran las comparaciones visuales UNKNOWN.

**FASE 5B = PARTIAL, SIN CIERRE. Bloques2/3/4 tienen correcciones técnicas verificadas; paridad visual integral pendiente. UI-16/UI-17 = BLOCKED por alcance. T-02/T-03 = PARTIAL. Sin commit.**


## Resultado de la continuación acotada — bloque4

B-06 en lista/alta/detalle de estudiantes y alta de administradores, B-07 y B-08: **DONE** en controles probados. Etiquetas asociadas, botones hermanos de notificación, panel disclosure con teclado nativo. Logout y apertura conservan exactamente su función; sin cambios de backend/contratos/dominio.

Última ejecución: **389 backend/PostgreSQL PASS,3 SKIP de migraciones sin bases/variables,7 warnings,116,37 s**, incluidos cuatro E2E Chrome. **166 Next PASS**; lint/typecheck/webpack PASS. **Flutter analyze PASS y57 tests PASS**. Diecinueve tests nuevos de componentes y un E2E real nuevo;18 PNG+JSON solo sintéticos. [Evidencia y rollback](phase5b-implementation.md#continuación--bloque4-etiquetas-notificaciones-y-panel-de-usuario).

La inspección de código Flutter acredita equivalencia de acciones, no paridad visual integral. El siguiente bloque es la comparación Flutter/Next de pantallas/estados, con zoom/lector/dispositivos donde sea posible; no se inicia aquí. **Fase5B PARTIAL**, UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL. Sin commit.


## Resultado de bloque5 — primera comparación pareada, 2026-10-10

Notificaciones: fixtures comunes sin datos institucionales, AppTheme/Inter real local, captura Flutter y Chrome de datos/leído/vacío/carga, ambos temas y ampliación. Error503 se captura solo en Next: el provider Flutter actual no comunica error; gap confirmado, pendiente de bloque funcional separado, sin modificarlo aquí.

Dos defectos demostrados en Flutter se corrigen con presentación mínima: texto vacío oscuro con contraste3,85→11,00 (claro8,93), tooltip de marcado y estado semántico de lectura. Apertura/lectura/provider/auth/contratos intactos. Las16 referencias se repiten idénticas; se añade comparación golden previa a cualquier exportación.

Entorno temporal recuperado en /tmp: Flutter3.41.6 con checksum oficial, Python3.12.15 y PostgreSQL18 exclusivamente sintético. pub get --enforce-lockfile conserva las versiones; no instalaciones globales ni updates del proyecto. [Resultados y límites](phase5b-implementation.md#continuación--bloque5-notificaciones-y-referencia-visual-local).

Otras pantallas/estados pareados, lectores, dispositivos y zoom nativo permanecen pendientes/UNKNOWN. CSS zoom2 en Chrome es una simulación de layout distinta de TextScaler2 en Flutter. **Fase5B PARTIAL**, UI-16/UI-17 BLOCKED por alcance y T-02/T-03 PARTIAL. Sin commit.

## Continuación — cierre acotado de B5-N04, 2026-10-10

Se corrige únicamente el error/reintento de notificaciones Flutter: fallo inicial distinto de vacío, conservación de avisos anteriores con aviso, invalidación de frescura tras fallo y deduplicación del reintento. Sin cambios de auth/contratos/dominio/backend/Next funcional. Contraste del nuevo botón de reintento comprobado y corregido localmente (B5-N05).

**B5-N04/B5-N05 DONE**:19 pruebas Flutter nuevas (11 funcionales +8 de representación/accesibilidad), ocho capturas de error, suite97 PASS y analyze/format PASS. Backend/PostgreSQL390 PASS/3 SKIP de migraciones, incluidos cinco E2E; Next166 PASS y lint/typecheck/webpack PASS. [Evidencia, causas, límites y rollback](phase5b-implementation.md#continuación--b5-n04-error-y-reintento-de-notificaciones-flutter).

Pendiente: comparación pareada de otras pantallas/estados y de refresh fallido con datos anteriores (Next devuelve QueryError, Flutter conserva la lista con aviso); lectores/dispositivos/zoom nativo UNKNOWN. Esta continuación no cierra el bloque5 ni Fase5B. UI-16/UI-17 BLOCKED por alcance, T-02/T-03 PARTIAL. Sin commit.

## Continuación — refresh fallido Next, 2026-10-10

**B5-N06/B5-N07/B5-N08 DONE en lo probado:** ambas páginas conservan datos con aviso solo ante fallo transitorio, bloquean retención desde la primera denegación/cancelación, conservándola durante retries automáticos y navegación hasta nuevo éxito, coordinan retry y evitan aviso duplicado de shell en notificaciones. Otras rutas conservan error/reintento global; contadores de navegación fallidos se ocultan. Sin cambios de backend/Flutter funcional, API/auth/dominio, migraciones o dependencias.

40 pruebas Next nuevas:206 PASS; lint/typecheck/webpack PASS. Backend/PostgreSQL390 PASS/3 SKIP, incluidos cinco E2E finales; Flutter97 PASS/analyze PASS.24 capturas nuevas, roles/temas, fixture sintético,503/403/401 controlados y403 administrativo real. [Causas, ejecución, límites y rollback](phase5b-implementation.md#continuación--refresh-fallido-de-notificaciones-next).

Pendientes: B5-N09/P2, representación de la fila y captura con CSS zoom2 (truncamiento/solapamiento con header); zoom nativo/dispositivo UNKNOWN. Próximo bloque propuesto: medir ampliación/responsive de notificaciones y corregir solo defectos demostrados conservando acciones; después seguir pantallas pareadas del bloque5. No afirmar legibilidad por scrollWidth únicamente. Otras pantallas/estados y lectores siguen pendientes. **Fase5B PARTIAL**, UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL. Sin commit.

## Continuación — B5-N09, reflow acotado

Correcciones técnicas probadas en Chrome: título adaptable, fila reorganizada por ancho del contenedor, mensaje completo en estrecho, scroll bajo altura real del header y capa de contenido delante de decoración exclusivamente en notificaciones. Handler de abrir/marcar, consultas/retención, auth y contratos conservados.36 escenarios nuevos, roles/temas,320 normal/390 CSS zoom2/1280 escritorio, datos ordinarios/texto largo/refresh retenido; fragments de texto, teclado y RGB de badge. Flutter referencia existente no modificada.

Next214 PASS,8 tests nuevos; lint/typecheck/webpack PASS. Flutter97 PASS/analyze PASS. E2E aislado final1 PASS/52,26 s; backend/PostgreSQL final390 PASS/3 SKIP/176,58 s, incluidos cinco E2E. Skips de migraciones sin bases/variables; no migraciones nuevas. [Evidencia y rollback](phase5b-implementation.md#continuación--b5-n09-reflow-de-notificaciones).

**B5-N09 PARTIAL:** correcciones técnicas verificadas, ampliación nativa/dispositivos/lectores UNKNOWN. Otras pantallas del bloque5 siguen pendientes; seguir el inventario original y crear referencias pareadas por estados, sin repetir estos defectos como abiertos ni afirmar paridad integral. UI-16/UI-17 BLOCKED por alcance, T-02/T-03 PARTIAL, Fase5B PARTIAL. Sin commit.


## Continuación del bloque5 — dashboard estudiante

B5-D01/D02: representar únicamente señales/contadores backend con respuesta exitosa, conservar navegación tras errores y equiparar refresh/cinco estadísticas con Flutter. B5-D03: contraste onSurface de accesos Flutter, etiquetas ampliadas multilínea y tooltip de notificaciones. B5-D04: reflow CSS local Next. Pruebas específicas y suites Next226/Flutter122 PASS; backend/PostgreSQL391 PASS/3 SKIP con seis E2E, lint/typecheck/analyze/formato/webpack PASS; registro integrado/build/evidencia final en [implementación](phase5b-implementation.md#continuación--dashboard-estudiante-b5-d01-a-b5-d04).

Comparación de estados acotados y correcciones técnicas verificadas; cierre integral del dashboard PARTIAL por lectores/dispositivos/zoom nativo UNKNOWN y composición no idéntica. Dashboard administrativo, formularios, comunicaciones, esquema y demás pantallas aún requieren sus referencias pareadas. No cambiar la clínica/backend/cache/auth, certificados ni UI-16/UI-17. FASE5B PARTIAL; T-02/T-03 PARTIAL; sin commit.


## Continuación del bloque5 — dashboards administrativos

B5-A01: gráfico Next no debe representar caché después de error/403. B5-A02: refresh por rol y filtro semestre en los cinco enlaces. B5-A03: error/retry seguros Flutter y tooltip; mismo provider/export. B5-A04: reflow/grids mínimos y capa de decoración exclusiva /admin. B5-A05: ranking con aria-expanded/controls, sin cambios de métricas/reglas.19 pruebas Next y38 Flutter nuevas; suites245/160 PASS; backend/PostgreSQL392 PASS/3 SKIP con siete E2E; lint/typecheck/analyze/format/webpack PASS; E2E específico1 PASS,48 escenarios web; gates y evidencia final en [implementación](phase5b-implementation.md#continuación--dashboard-administrativo-b5-a01-a-b5-a05).

**B5-A06 DONE en la continuación de contexto:** semestre en URL para opciones actuales, back/reload/deep-link y enlaces probados sin PII. **B5-A07 UNKNOWN:** opciones institucionales de semestre (Flutter10/Next12/API20); no cambiar rangos a ciegas. Mantener diferencias de representación de ranking, rotulación clínica, lector/zoom nativo/dispositivos y otras pantallas pendientes. FASE5B PARTIAL; UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL. Sin commit.


## Continuación — contexto URL del dashboard, B5-A06

Causa: selección local en useState no leía URL y se perdía al desmontar/reload. Implementada fuente de contexto semester en search params y router.push, con Suspense solo para admin normal; mismas opciones1–12, mismas keys/GET/CSV/roles, sin nueva política clínica. Generador de URL incluye únicamente semester o /admin para Todos.41 pruebas Next nuevas y1 Flutter de regreso desde5 tarjetas, más E2E de Chrome/PostgreSQL real. Focalizados78 PASS; Next286 PASS/lint/typecheck/webpack PASS; E2E específico1 PASS. Gates integrados finales en [auditoría](phase5b-implementation.md#continuación--b5-a06-contexto-de-semestre-del-dashboard).

B5-A06 DONE dentro de opciones actuales: backend/PostgreSQL396 PASS/0 SKIP con ocho E2E y tres migraciones existentes; Flutter161 PASS/analyze/formato PASS. B5-A07 sigue UNKNOWN (Flutter10/Next12/API20), sin cambiar opciones a ciegas. Mantener pendientes de ranking/rotulación, otras pantallas y validación nativa; UI-16/UI-17 BLOCKED y T-02/T-03 PARTIAL. Fase5B PARTIAL. Sin commit.

## Continuación — interlocutor de comunicaciones, B5-C01

La lista Next seleccionaba recipient sin excluir userId; el encabezado mostraba student + recipient, incluyendo al usuario conectado. Flutter lista/detalle eligen el primer participante distinto del usuario actual entre recipient, created_by y student. FastAPI define esos participantes y autoriza cada conversación; student también referencia a un administrador en conversaciones administrativas. No inferir roles por el nombre de esa propiedad.

Corrección limitada a representación en ThreadRow/ThreadDetail mediante communicationPeer; mismo orden y fallback legacy de Flutter, sin configurar destinatarios ni alterar POST/PUT/GET, estados, permisos o búsquedas. Diez fixtures compartidos, veinte pruebas Next y veinte Flutter en pantallas reales. E2E con ocho perspectivas reales, lista/detalle/reload y dos403 de un estudiante sobre conversación ajena. Gates finales y rollback: [implementación](phase5b-implementation.md#continuación--b5-c01-interlocutor-de-comunicaciones).

Pendientes separados: **B5-C02 UNKNOWN**, conversación sin destinatario y sin otro participante identificable: fallback legacy conservado, no inventar persona responsable por rol/ámbito. **B5-C03 PENDING**, decoración superpuesta al compositor en captura390 de comunicaciones; AppShell limita su contexto de capas a /admin y notificaciones. Requiere corrección acotada y mediciones propias en un bloque posterior. Contraste de burbujas, estados pareados completos, lectores/zoom nativo/dispositivos y responsive integral no quedan cerrados por este cambio de datos. Fase5B PARTIAL; UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL. Sin commit.

**B5-C01 DONE** en ese alcance: backend/PostgreSQL397 PASS/0 SKIP, nueve E2E y tres migraciones existentes; Next306 PASS/lint/typecheck/webpack PASS; Flutter181 PASS/analyze/formato PASS. Sin nuevo contrato, permiso, migración ni regla clínica. Siguiente bloque propuesto: B5-C03 con evidencia de capas y comparación de estados; no cerrar el resto de comunicaciones por estos resultados.

## Continuación — capas de comunicaciones, B5-C03

2026-10-19. La condición de AppShell para relative/z-0 omitía comunicaciones; la decoración absoluta podía pintarse sobre el compositor. Corrección limitada a listas/detalles de /student/communications y /admin/communications (coincidencia exacta o descendiente con barra), preservando dashboard/notificaciones y rutas externas al alcance. No cambiar el componente de fondo ni su recorte, el contenido, formularios, APIs, permisos o clínica.

Pruebas:17 casos de componente,46 focalizados PASS; E2E previo confirma4/57 píxeles del compositor alterados por decoración. E2E posterior1 PASS,48 escenas reales con tres roles, dos pantallas, dos temas y cuatro anchos;2736 píxeles muestreados sin diferencia. Capturas conservan antes/después. Next323 PASS/lint/typecheck/webpack PASS; Flutter181 PASS/analyze PASS, sin goldens nuevas ni cambios funcionales móviles. [Auditoría, gates finales y rollback](phase5b-implementation.md#continuación--b5-c03-capas-de-comunicaciones).

No cerrar el resto de comunicaciones por esta corrección de capas. B5-C02 permanece UNKNOWN: no asignar otro destinatario cuando la respuesta no identifica interlocutor. Siguientes pendientes: comparación de loading/empty/error/success, contraste de burbujas y recuperación de marcado de lectura; lectores/zoom nativo/dispositivos siguen UNKNOWN. B5-A07 UNKNOWN; UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL. Fase5B PARTIAL. No commit.

**B5-C03 DONE** en el alcance probado. Gate final backend/PostgreSQL398 PASS/0 SKIP,27 warnings,332,82 s: diez E2E y tres migraciones existentes. Next323 PASS/lint/typecheck/webpack PASS; Flutter181 PASS/analyze PASS. Único archivo funcional: app-shell.tsx; sin migración nueva. [Antes/después e índice](../ui/evidence/phase5b/communications-layers/evidence-index.json). Mantener separados los pendientes anteriores y no cerrar Fase5B.


## Continuación — M01, alta de administradores

Causas demostradas: onClick fuera de form evita validación nativa/Enter;campos activos durante POST permiten perder edición posterior;opcionales borrados generan strings incompatibles y doble invalidación provoca dos GET. Corrección acotada a una fuente Next con payload fijo,form/fieldset y restricciones contractuales existentes. No se copia obligatoriedad Flutter para nombres que FastAPI permite omitir.

11 pruebas Next nuevas,4 Flutter de referencia y1 E2E nuevo con alta real/403 por rol en PostgreSQL sintético. Next422 PASS/lint/typecheck/webpack PASS;Flutter301 PASS/analyze/formato PASS. Backend/PostgreSQL405 PASS/0 SKIP,51 warnings,456,40s;17 E2E,migraciones y concurrencia.M01 DONE en alta probada,S20 integral PARTIAL. [Evidencia y rollback](phase5b-implementation.md#continuación--m01-alta-de-administradores-2026-10-21).

Siguiente bloque técnico propuesto M02: separar escritura confirmada/lectura fallida y estados de recuperación del listado de administradores;auditar primero Flutter/Next sin cambiar contrato/permisos. Dropdowns/representación global/lectores/dispositivos/zoom nativo siguen pendientes;H02/C02/A07 separados;UI-16/UI-17 BLOCKED;T-02/T-03 PARTIAL. Sin migraciones nuevas ni commit.


## Continuación — M02, recuperación administradores Next

Error de GET sin isFetching/retry compartido,ausencia de vacío y callbacks que confundían escritura confirmada con recarga fallida:corregidos en una fuente Next,conservar borrador sin exponer lista/formulario tras error y sin repetir POST/DELETE al reintentar GET. Eliminación deja de invalidar dos veces;permisos/confirmación/endpoints intactos.

27 tests Next nuevos y E2E real de alta/eliminación+GET fallido en ambos temas.Next449 PASS/lint/typecheck/webpack PASS;Flutter301 PASS/analyze PASS;E2E específico1 PASS/17,39s.Backend/PostgreSQL406 PASS/0 SKIP,51 warnings,474,91s;18 E2E,migraciones y concurrencia.M02 DONE para Next,M03/S20 integral PARTIAL. [Evidencia,causas y rollback](phase5b-implementation.md#continuación--m02-recuperación-de-administradores-next-2026-10-21).

Próximo bloque acotado:M03 nativo,inspeccionar y probar antes de corregir errores/recargas/coordinación y disposición del formulario Flutter de administradores.Sin nuevas reglas clínicas u opciones institucionales.H02/C02/A07 separados;UI-16/UI-17 BLOCKED;T-02/T-03 PARTIAL.Sin migraciones nuevas ni commit.


## Continuación — M03 Flutter y lista finita

Se separan lectura/escritura en administradores Flutter,se retira contenido al fallar GET,se conserva borrador,se coordina retry/escritura/confirmación y se comprueba mounted antes de modificar controles o recargar tras respuestas tardías;mensajes seguros sin diagnóstico.El formulario/valores institucionales/permisos no cambian.

26 nuevas pruebas nativas y cuatro goldens;Flutter327 PASS/analyze PASS,Next449 PASS/lint/typecheck/webpack PASS.Backend/PostgreSQL406 PASS/0 SKIP,51 warnings,491,20s;18 E2E,migraciones y concurrencia.M03/R01 DONE en recuperación probada;S20 integral PARTIAL.[Resultados y rollback](phase5b-implementation.md#continuación--m03-recuperación-de-administradores-flutter-2026-10-21).

[Lista finita](phase5b-remaining-work.md):R01=M03;R02–R04=barrido de22 pantallas por grupos definidos;R05=accesibilidad/físico;R06=H02/C02/A07;R07=cierre.Mantener N/A justificado y UNKNOWN visible,sin ampliar alcance con funciones nuevas.UI-16/UI-17 BLOCKED;T-02/T-03 PARTIAL.Sin migraciones nuevas ni commit.


## Continuación — R02A formularios de cuenta

Correcciones acotadas S02/S03/S09 en ambos clientes:envío único/campos bloqueados,copy segura por HTTP/timeout,mounted y conservación del orden de logout,scroll corto,errores asociados a campos y copy de contraseña temporal por correo.Contraste oscuro demostrado3,87 se corrige solo en mensajes;decoración web deja de tapar contenido solo en las dos rutas de cambio.No backend/auth/store/FCM/contratos/reglas de contraseña o clínica modificados.

R02A DONE en controles probados:Next485 PASS/lint/typecheck/webpack PASS;Flutter364 PASS/analyze/formato PASS;backend407 PASS/0 SKIP,19 E2E,migraciones/concurrencia,sobre build inicial;tras capas E2E específico final1 PASS/5,67s yNext completo485 PASS.[Evidencia y rollback](phase5b-implementation.md#continuación--r02a-formularios-de-cuenta-2026-10-21),[cobertura finita R02](../ui/phase5b-r02-coverage.md).

R02 permanece PARTIAL:seguir con S18 alta/importación y S22 perfil base;cerrar cobertura S00/S01 y pendientes de representación sin alterar autenticación.Lector/dispositivo/zoom físico sigue en R05.No ampliar a firma/PDF/QR ni clínica;UI-16/UI-17 BLOCKED,T-02/T-03 PARTIAL.Sin commit.


### Continuación R02B — S18,2026-10-21

Formulario nativo Next y exclusión de crear/preview/importar en ambos clientes;preview se consume por intento y reinicia página;errores seguros y callbacks tras dispose protegidos.Capa relative/z-0 solo en /admin/students/create tras comprobar aro sobre botón.11 pruebas nuevas Next+3 de capa,18 Flutter,dos pares390 y E2E sintético con alta/importación reales en PostgreSQL;correo deshabilitado.No contratos,backend funcional,auth/opciones institucionales/reglas clínicas cambiados.Controles DONE tras backend408/0 SKIP y20 E2E sobre build final;837 referencias SHA válidas.S18/R02 como paridad integral siguen PARTIAL;próximo S22 base y cobertura S00/S01.


### Continuación R02C — S22 base,2026-10-21

Controles R02C01–R02C05 DONE:borrador conservado ante error,PUT confirmado distinto de GET fallido,retry solo GET,payload/envío/cancelación coordinados,mounted/propietario y capa exacta /admin/profile.Next528/Flutter402/backend409 PASS/0 SKIP con21 E2E,migraciones/concurrencia y gates.2 fuentes Next;sin fuentes Dart/backend modificadas.Firma hook/JSX byte idénticos y ciclo anterior conservado;sin validación real de almacenamiento.S22/R02 integral PARTIAL.Siguiente S00/S01 y comparación restante,con nombres/composición/contraste/foco pendientes explícitos en cobertura R02.No commit.
