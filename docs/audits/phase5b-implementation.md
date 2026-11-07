# Fase 5B — Implementación por bloques de tema y accesibilidad

Fecha: 2026-10-09, America/Bogota. **D-01 = DONE; D-02 = DONE en el alcance probado. FASE 5B = PARTIAL.**

El usuario autorizó explícitamente «Implementar ambas correcciones y verificarlas» después del [diagnóstico](phase5b-theme-diagnosis.md). Esa primera ejecución cubrió Enter del E2E y contención del fondo decorativo. Tras entregar sus resultados, las siguientes instrucciones «continua» se acotaron al bloque2 (detalle/esquema), al bloque3 (catálogo/diálogos) al bloque4 (etiquetas/notificaciones/panel de usuario) y al inicio del bloque5 (notificaciones pareadas) del [plan](phase5b-plan.md). Cada continuación se documenta por separado; las cifras anteriores permanecen como evidencia histórica.

Se leyeron `AGENTS.md` y skills locales `ui-parity`, `quality-gates`, `security-health`. FastAPI conserva la autoridad de dominio y permisos. No se cambian reglas clínicas, backend funcional, contratos, autenticación de Fase 2, lógica funcional de Flutter, PDF/QR, Maps, Azure ni dependencias. Los bloques3/4/5 añaden tests de navegador backend que reutilizan el harness sintético; no cambian backend funcional. Sin commit.

## Cambios y causa raíz

| Hallazgo | Causa raíz demostrada | Archivos | Solución | Estado |
|---|---|---|---|---|
| D-01 / P2 | La secuencia CDP de Enter enviaba keyDown/keyUp sin generar keypress/click; el botón correcto tenía foco, pero la preferencia no cambiaba. | `frontend-next/tests/e2e/phase5b-theme-browser.mjs`; regresión en `src/components/__tests__/phase5b-theme.test.tsx` | Añadir el evento char de Enter entre pulsación y liberación. Mantener comprobaciones de foco, teclado, aria-pressed, preferencia y CSS. Sin click programático para sustituir Enter. | **DONE**, componente y Chrome real sobre build final. |
| D-02 / P2 | Los círculos absolutos con offsets negativos ampliaban el contenido móvil de390 a446 y provocaban autoescalado. | `frontend-next/src/components/brand.tsx`; nuevo `src/components/__tests__/phase5b-brand-background.test.tsx`; runner de navegador | Capa absoluta recortada, aria-hidden y sin eventos de puntero, únicamente para decoración. Contenido como hermano, fuera de overflow-hidden. Comparar geometría con ancho solicitado y verificar scroll vertical. | **DONE** para causa compartida y regresiones ejecutadas; responsive de cada pantalla/estado sigue pendiente. |

Se preservan colores, tamaños y posiciones de círculos dentro del área visible. No se aplica overflow global ni se mueve el contenido a la capa decorativa. El cambio visual necesario consiste en contener la decoración en los límites del fondo.

Archivos de código/pruebas modificados en este bloque: **4** (los indicados en la tabla; el test del fondo es nuevo). No se modificó el harness backend ni se borró cobertura previa. **Migraciones nuevas: ninguna. Dependencias/lockfiles: sin cambios.**

## Pruebas añadidas y ampliadas

- Dos tests nuevos del fondo: contenido accesible fuera de aria-hidden, activación por Tab/Enter y feedback/overlay fuera de la capa recortada. JSDOM verifica estructura y comportamiento; no acredita medidas CSS.
- Un test nuevo del selector: enfocar Claro con Tab, activar Enter, comprobar aria-pressed, data-theme y persistencia.
- Runner Chrome actualizado: secuencia completa de Enter; foco visible y selección; conservar comprobaciones de cuatro combinaciones manual/system contra SO, Badge/Alert reales y contraste; comprobar geometría en320/390/768/1440 y scroll vertical del formulario a320×400.

Las assertions anteriores se conservan. Se añade la comparación contra el ancho solicitado porque scrollWidth≤innerWidth aislado podía aprobar un viewport autoampliado.

## Ejecución real

Entorno: Python3.12.15 con venv existente, Node22.22.1, Next16.3.6, PostgreSQL local de pruebas y SDK Flutter local existente. Solo fixtures sintéticos. No se instala ni actualiza ningún paquete.

| Gate | Comando / directorio | Resultado |
|---|---|---|
| Tests de componentes intervenidos | `npm test -- src/components/__tests__/phase5b-theme.test.tsx src/components/__tests__/phase5b-brand-background.test.tsx`, `frontend-next/` | **19 PASS**,2 archivos,1,39 s. |
| Next completo + PostgreSQL BFF | `BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test` | **127 PASS**,24 archivos,5,99 s. |
| Next lint | `npm run lint` | **PASS**, sin errores ni warnings ESLint. |
| Next typecheck | `node node_modules/typescript/bin/tsc --noEmit` | **PASS**. |
| Production webpack build | `node node_modules/next/dist/bin/next build --webpack` | **PASS**, compilación/TypeScript y26 páginas estáticas. |
| Backend/PostgreSQL completo + ambos E2E Chrome | Comando siguiente, `backend/` | **387 PASS,3 SKIP,7 warnings,112,03 s**. |
| Flutter analyze | `FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache /tmp/immuno-miguel-tools/flutter/bin/flutter analyze --no-pub`, `frontend/` | **PASS**, sin issues,2,0 s. |
| Flutter tests | Mismo entorno/SDK, `flutter test --no-pub --reporter expanded` | **57 PASS**. |
| Comparación de paletas | AppColors de los JSON Flutter existentes contra CSS calculado de4 combinaciones de tema | **32 coincidencias**,8 tokens×4. No es paridad de pantallas completas. |
| Sintaxis del runner | `node --check tests/e2e/phase5b-theme-browser.mjs` | **PASS**. |
| Ruff backend | `.venv/bin/python -m ruff check app tests` | **PASS**. |

```sh
# backend/; sin plugin ni sondas temporales del diagnóstico.
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs
```

Ambos parámetros del harness pasan dentro de387: `phase5a-browser.mjs` (intención/permisos/contexto/sincronización) y `phase5b-theme-browser.mjs` (temas/teclado/contraste/reflow). No se cuentan como pruebas adicionales fuera de ese total. La suite también conserva concurrencia HTTP/PostgreSQL, entre otras `test_comment_concurrent_with_review_preserves_explicit_decision` y `test_concurrent_refresh_has_one_success_then_compromised_family`.

Los3 skips son `test_phase1_migration.py`, `test_phase2_migration.py` y `test_certificate_signer_migration.py`: requieren sus variables y bases desechables separadas. **No se ejecutaron migraciones en esta verificación ni se cuentan skips como PASS.** No hay cambios de modelos/esquema. Los7 warnings backend son deprecaciones existentes de SQLAlchemy noload y Firebase MulticastMessage.tokens. Vitest avisa sobre un futuro cambio de configLoader en Vite; no impidió la ejecución y no se modifican dependencias para silenciarlo.

## Evidencia visual y límites

[Matriz acotada](../ui/phase5b-parity-matrix.md), [mediciones del runner final](../ui/evidence/phase5b/shared-theme/measurements.json), [paleta comparada](../ui/evidence/phase5b/shared-theme/palette-comparison.json), [foco y Claro seleccionado](../ui/evidence/phase5b/shared-theme/next-theme-selector-keyboard-light-os-dark.png), [login móvil final](../ui/evidence/phase5b/shared-theme/next-login-error-mobile-light-os-dark.png).

Geometría final del login con error: clientWidth/scrollWidth/innerWidth coinciden con cada ancho solicitado:320,390,768 y1440. En320×400 el formulario requiere scroll vertical, puede desplazarse y el botón de envío queda visible al final. Se inspeccionaron las capturas móvil y menú de tema final; el contenido/menú permanecen visibles.

Las capturas contienen únicamente fixtures sintéticos. Los JSON de medidas no incluyen cuentas, identificadores de estudiante, cookies, tokens ni datos clínicos. La referencia Flutter disponible es una paleta rasterizada de AppColors; **UNKNOWN** la comparación de cada pantalla completa, tipografía, texto ampliado y lectores de pantalla. No se afirma conformidad general de accesibilidad ni se cierra UI-14/UI-15.

## Riesgos y rollback

- La capa es compartida por páginas raíz/auth/AppShell: el recorte solo afecta decoración; contenido, foco y overlays quedan fuera. Se validan componentes y ambos E2E, pero no todas las pantallas/estados en dispositivos físicos.
- La prueba de teclado depende de CDP; mantener la secuencia completa y assertions de activación real. Evitar reemplazarla por clicks que oculten regresiones.
- Rollback: revertir exclusivamente el cambio de capa en `brand.tsx` y los cambios del runner/tests de este bloque contra su diff previo. No usar una reversión global del árbol ni tocar datos. El inventario SHA-256 local sirve para detectar alcance, no como copia restaurable.

Los cambios de temas anteriores y fases previas ya estaban en el árbol sin commit; se conservaron. La comparación con el inventario previo a esta autorización separa los4 archivos de código/pruebas de este bloque de ese trabajo.

Revisión final: **git diff --check PASS**; archivos nuevos inspeccionados; enlaces locales y espacios finales correctos; comparación SHA-256 confirma únicamente los4 archivos de código/pruebas autorizados, documentación y artefactos. Backend, Flutter funcional, contratos, autenticación, dependencias y migraciones coinciden con la línea base de esta autorización. El escaneo acotado de patrones de secretos en archivos nuevos/actualizados no detectó coincidencias; no sustituye una auditoría global de secretos del árbol histórico.

## Estado

| Elemento | Estado |
|---|---|
| D-01 — Enter del E2E | **DONE** |
| D-02 — contención decorativa y regresiones medidas | **DONE** |
| Fase5B completa / demás bloques del plan | **PARTIAL**, no implementados aquí |
| UI-16/UI-17 | **BLOCKED por alcance**, sin cambios |
| Comparación integral Flutter/Next, dispositivos/lectores | **UNKNOWN**, pendiente |
| T-02/T-03 y Fase3B | **PARTIAL**, requieren validación institucional autorizada |

No se cierra Fase4 ni se declara producción lista. No hay commit.

## Bloque 2 — Detalle y esquema

Continuación posterior al cierre acotado de D-01/D-02. Se leyeron nuevamente AGENTS.md, las tres skills indicadas, plan/matriz y código/test existente. Referencia Flutter: `AdminStudentDetailScreen._schemeTab` (`ExpansionTile`) y `SchemeDetailScreen._buildVaccineCard`. Solo fixtures sintéticos locales; sin datos institucionales.

### Causa raíz, solución y archivos

| Hallazgo | Causa raíz | Cambio | Resultado acotado |
|---|---|---|---|
| B-01 / UI-14 P2 | Root, encabezado y tarjetas del detalle fijaban colores oscuros, incluso con preferencia clara. Baseline CSS: tarjeta rgb(14,32,35) bajo ambas preferencias. | `src/app/admin/students/[id]/page.tsx`: fondos/textos/bordes y foco consumen tokens existentes. | **DONE** corrección de superficies/texto medida en Chrome. |
| B-01, dependencia de fila / P2 | `AdminDoseRow` conservaba título blanco y fondos literales; reemplazar solo la tarjeta podía hacer ilegible el título en claro. | `src/components/admin-dose-row.tsx`: tokens para título/fechas/titulación, indicadores, acciones, comentario y marcos de confirmación. No cambia ninguna condición, callback, endpoint ni payload. | **DONE** título, comentario y confirmar/cancelar medidos; tests de intención/permisos conservados. |
| B-04 / UI-15 P2 | Tabs sin relación control/panel ni navegación de teclado; acordeones sin expansión comunicada. | Detalle: tablist/tab/tabpanel con useId y tabindex móvil; flechas/Home/End mueven foco sin activar. Enter/Espacio activan por botón nativo. Detalle y `src/app/student/scheme/page.tsx`: aria-expanded/controls y región etiquetada, IDs estables y foco visible. | **DONE** relaciones/teclado y contexto probado; lectores reales **UNKNOWN**. |

La selección sigue viniendo de URL. Se conservan `studentDetailTab`, `safeStudentReturn`, serialización y `router.replace(scroll:false)`. Solo el panel seleccionado monta su contenido; expandir/colapsar mantiene el desmontaje previo de filas/formularios. No se cargan las tres consultas por añadir paneles semánticos. Next administrativo mantiene las dos primeras vacunas abiertas; estudiante mantiene todas cerradas. Flutter administra ExpansionTile cerrado inicialmente: diferencia preexistente registrada en la matriz, sin alterar comportamiento para copiar apariencia.

**Archivos de código/pruebas de esta continuación:5.** Los tres componentes/páginas de la tabla, runner existente `tests/e2e/phase5b-theme-browser.mjs` ampliado, y nuevo `src/components/__tests__/phase5b-detail-scheme.test.tsx`. No se cambia el harness backend ni se elimina cobertura5A. **Migraciones/dependencias nuevas: ninguna.**

### Pruebas nuevas y ejecución final

Siete tests nuevos: relaciones entre3 tabs/paneles y consulta exclusiva; flechas/Home/End sin navegar; activación explícita Enter y Espacio conservando contexto; apertura inicial y toggles administrativos; acordeón estudiante y ausencia de revisión; cancelar comentario por teclado conserva dato sin llamar revisión. Spies comprueban que estas interacciones no envían escrituras clínicas. Los tests existentes mantienen confirmación, permiso y separación de comentario/aprobación/denegación/revisión.

Runner ampliado sobre producción webpack: claro/SO oscuro y oscuro/SO claro; CSS real de root/tarjeta/título/estado/comentario/acciones/confirmaciones; abrir y cancelar aprobación/denegación; tabs por teclado y recarga con página de evidencia y filtro/página de retorno; acordeones admin/estudiante y foco; ausencia de controles de revisión en estudiante; reflow320/390/768/1440 en ambas pantallas/temas. El harness conserva la comprobación final de dosis EN REVISIÓN para5B y DENEGADA para el flujo explícito5A.

| Gate final de esta continuación | Resultado real |
|---|---|
| Next completo + BFF PostgreSQL; comando anterior `npm test` con BFF_TEST_DATABASE_URL | **134 PASS**,25 archivos,5,43 s; incluye los7 nuevos. |
| Next `npm run lint` | **PASS**, repetido después de la última ampliación del runner. |
| Next `node node_modules/typescript/bin/tsc --noEmit` | **PASS**, después del build final. |
| Next `node node_modules/next/dist/bin/next build --webpack` | **PASS**, compilación6,1 s, TypeScript y26 páginas estáticas. |
| Backend completo + PostgreSQL + ambos E2E Chrome; comando siguiente | **387 PASS,3 SKIP,7 warnings,103,16 s**. |
| E2E5B aislado, antes de la repetición completa; mismo entorno y `pytest -q --tb=short --show-capture=no tests/test_phase5a_browser.py -k phase5b` | **1 PASS,1 deselected,6 warnings,8,43 s**. La repetición completa también lo incluye; no sumar como test distinto. |
| Flutter analyze, mismo SDK/entorno y comando anterior | **PASS**, sin issues,1,4 s. |
| Flutter test, mismo SDK/entorno y comando anterior | **57 PASS**. Flutter fuente no modificada. |
| Ruff `app tests` | **PASS**. |

```sh
# backend/, PostgreSQL sintético; sin plugin diagnóstico ni modificaciones del rate limiting.
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

Los3 skips de migraciones y los warnings tienen el mismo motivo documentado arriba; no se presentan como pruebas de migración ejecutadas. Concurrencia y permisos PostgreSQL sí pasan en la suite completa. No se crean migraciones para presentación.

**Fallos previos conservados en este informe:** primer backend completo386 PASS/1 FAIL/3 SKIP (112,89 s): el runner añadió un login y agotó el rate limit real, dando429. Se reutiliza la sesión sintética ya emitida, con cookies opacas solo en memoria de Chrome/CDP; no se desactiva el control ni se persisten cookies/tokens. Un intento E2E posterior falló al buscar textContent exacto de un botón con icono oculto; se usa su title explícito y se comprueba activación/confirmación real. Los errores iniciales de tests nuevos eran orden canónico de query y nombre accesible con espacios: las assertions verifican parámetros y nombre/rol en lugar de ese formato incidental. Ninguno se registra como PASS. La última ejecución completa pasa sin plugins temporales.

### Evidencia, riesgos, rollback y pendientes

[Matriz actualizada](../ui/phase5b-parity-matrix.md#continuación--bloque2-detalle-y-esquema), [baseline previo](../ui/evidence/phase5b/detail-scheme/baseline.json), [mediciones finales](../ui/evidence/phase5b/detail-scheme/measurements.json) y capturas antes/después en ese directorio. El baseline se obtuvo sobre el build anterior:1 test de adquisición PASS, sin demostrar paridad. Su campo shell mide el contenedor externo transparente, no el root del detalle. Después se mide explícitamente el root que contiene Volver.

Contrastes reales claro/oscuro: título de dosis15,61/15,32; estado EN REVISIÓN7,29/7,92; comentario6,07/7,52; botón aprobar6,36/8,40; denegar7,62/9,03. Confirmaciones medidas≥12,51. Medidas no se extrapolan a hover, disabled, todos los estados/vacunas, lectores o todas las pantallas. Se inspeccionan capturas claras/oscuras y móvil; no se declara composición visual global resuelta por ausencia de overflow horizontal.

Riesgos: foco y navegación pueden afectar borradores; activación manual evita desmontar por una flecha. El desmontaje al activar otra tab/colapsar es el previo. Cambios de color se limitan a estos consumidores; no se introduce un mecanismo global. El E2E depende del catálogo sintético y del build final; las cookies sintéticas reutilizadas permanecen únicamente en memoria del proceso temporal.

Rollback: revertir únicamente diff de estos3 archivos de aplicación y cambios de runner/test nuevos respecto al inicio de este bloque. Hay copias locales restaurables de esos archivos en `/tmp/immuno-miguel-tools/phase5b-detail/backup/`; no son un respaldo de release. No revertir globalmente el árbol, migrar ni borrar datos. Se conserva el inventario SHA-256 inicial para distinguir trabajo previo.

| Elemento | Estado |
|---|---|
| B-01, superficies y fila de dosis; B-04, tabs/expansión | **DONE** correcciones técnicas acotadas y gates arriba. |
| Bloque2 como comparación de todos los estados Flutter/Next | **PARTIAL**; nuevas capturas pareadas de loading/empty/error/perfil/evidencia, zoom y lector **UNKNOWN**. |
| Bloques3–5, catálogo/diálogos/labels/menús y comparación Flutter integral | **PENDIENTES**, no implementados aquí. |
| Fase5B completa | **PARTIAL**. |
| UI-16/UI-17 | **BLOCKED por alcance**, sin cambios funcionales. |
| T-02/T-03, Fase3B y almacenamiento real | Conservan sus estados pendientes; no se valida con fixtures sintéticos ni se declara producción lista. |

Revisión incremental: fuentes backend, Flutter, clientes/contratos `src/lib/`, CertificateHistory, InfoTab, EvidenceTab y lógica de escritura de dosis permanecen iguales a la línea base del bloque. La fila administrativa cambia únicamente colores/clases. **git diff --check PASS**; revisión adicional de whitespace/enlaces en documentos y test nuevo PASS. Escaneo acotado de patrones de secretos de alta confianza sin coincidencias; no acredita auditoría de secretos de todo el trabajo previo. El diff global incluye fases anteriores sin commit; el inventario incremental delimita estos5 archivos de código/pruebas más documentación y capturas regeneradas. No hay commit.

## Bloque 3 — Catálogo y diálogos

La nueva continuación se acotó al editor y confirmaciones del catálogo. Lecturas: AGENTS.md, skills ui-parity/quality-gates/security-health, plan y matrices vigentes, página/tests/API Next, AuthGate y layout específico de vacunas, rutas FastAPI y editor/confirmación Flutter. No se amplían permisos: `app_admin` es el rol existente autorizado por FastAPI y el layout del catálogo. Normal admin y estudiante conservan sus restricciones.

### Causa raíz, implementación y archivos

| Hallazgo | Causa raíz / impacto | Solución | Estado acotado |
|---|---|---|---|
| B-02 / UI-14 P2 | Editor y chips fijaban colores oscuros. Baseline del build anterior: fondo rgb(36,41,44) en claro y oscuro. | `src/app/admin/vaccines/page.tsx` consume tokens de superficie/texto/selección y componentes de formulario existentes. | **DONE** en elementos y estados medidos. |
| B-03 / UI-14 P2 | Indicadores de catálogo/advertencia usaban dark: según SO, incompatible con preferencia manual. | Tokens semánticos para activos/inactivos, acción y advertencia; no se toca la variante dark global. | **DONE** corrección de consumidores del catálogo; no se extrapola a otras páginas. |
| B-05 / UI-15 P2 | Overlay solo gestionaba clicks, sin nombre/modalidad/foco/Escape. Primer dialog nativo hizo inerte el fondo, pero Tab desde el último control dejó BODY activo en Chrome. | Nuevo `src/components/ui/modal.tsx`: dialog nativo, título/descripción, foco inicial/retorno, ciclo explícito de Tab/Shift+Tab sobre controles visibles habilitados, Escape y backdrop con comprobación geométrica. Mientras busy, foco permanece dentro y no se puede cerrar. | **DONE** componente y navegador; lectores y plataformas adicionales **UNKNOWN**. |
| B-06, catálogo / UI-15 P2 | Label no estaba asociado; chips/filas y acciones de icono carecían de contexto/nombre accesible suficiente. | useId/htmlFor/describedby, leyenda de características, grupos de dosis y nombres de editar/activar/eliminar; foco después de añadir/quitar fila, fallback a Agregar. | **DONE** catálogo. Resto de formularios pendiente en bloque4. |
| Error/pending dentro del modal / P2 | Cierre/edición podían ocurrir durante escritura. Con modalidad nativa, un toast exterior no garantiza feedback accesible dentro del diálogo. | Fieldset disabled/aria-busy, cierre bloqueado mientras escribe, error genérico inline con role=alert y borrador conservado. `toggle.reset()` al abrir una confirmación evita mostrar error de una operación anterior. | **DONE**, doble submit, fallo, reapertura y reintento probados. |

Se preservan exactamente inicialización de DraftForm y composición de payload de create/update, incluyendo code inmutable fuera de update; mutationFn de activar/desactivar; EMPTY, enums, opciones y reglas de numeración existentes. Añadir/eliminar fila agrega únicamente destino de foco al comportamiento previo. No se incorpora DoseType.annual ni se altera Vaccine.is_annual; la eliminación histórica de annual ya estaba en la línea base de Fase3A/3B. No se cambian mensajes de política/reconciliación ni se presenta el test sintético como validación de T-02/T-03.

**Archivos de código/pruebas:5.** Página del catálogo modificada;4 nuevos: Modal, `src/components/__tests__/phase5b-catalog-dialog.test.tsx`, `tests/e2e/phase5b-catalog-browser.mjs` y `backend/tests/test_phase5b_catalog_browser.py`. El test backend llama al harness existente con su nuevo runner y esquema PostgreSQL aislado; no modifica el harness original ni la aplicación FastAPI. **Migraciones nuevas:0. Dependencias/lockfiles:sin cambios.**

### Tests nuevos, evidencia y resultados

**13 tests de componente**: nombre/modalidad/foco/labels; Tab/Shift+Tab y foco desde diálogo; cuatro cierres sin escritura y con retorno de foco; filas/IDs/chips; payload create exacto y submit único con campos/cierre bloqueados; error seguro/borrador/retry; update sin code; activar/desactivar explícitos con error/reapertura limpia;403 seguro sin acciones. JSDOM no implementa showModal/close: el test provee shims locales para lifecycle y visibilidad de controles. **No se usa esa simulación como evidencia de modalidad nativa, inertness ni geometría.**

Chrome sobre webpack final comprueba: temas manuales opuestos al SO; modalidad e inertness; foco inicial, ciclo y retorno; filas; Escape/backdrop/cancelar; edición con code disabled; confirmación segura; geometría320/390/768/1440 y scroll que hace alcanzable el envío. El guardado retiene una petición para comprobar busy/no doble POST, induce503 seguro, conserva valores y permite un **reintento real** hacia FastAPI/PostgreSQL. La creación usa únicamente catálogo sintético y conserva la comprobación final de dosis original EN REVISIÓN del harness. GET del catálogo es403 para normal admin y estudiante; el guard de ruta existente redirige al normal admin. No se desactiva rate limiting.

| Gate final | Comando / resultado |
|---|---|
| Next completo/BFF PostgreSQL | Mismo comando BFF_TEST_DATABASE_URL anterior; **147 PASS**,26 archivos,6,37 s. Incluye13 nuevos. |
| Next lint | `npm run lint`: **PASS**, repetido tras el último cambio del runner. |
| Next typecheck | `node node_modules/typescript/bin/tsc --noEmit`: **PASS**, después del build final. |
| Next producción | `node node_modules/next/dist/bin/next build --webpack`: **PASS**, compilación3,0 s, TypeScript y26 páginas estáticas. |
| Backend/PostgreSQL completo +3 E2E | Comando siguiente: **388 PASS,3 SKIP,7 warnings,108,62 s**. |
| E2E catálogo aislado anterior a repetición integrada | Mismo entorno; `pytest -q --tb=short --show-capture=no tests/test_phase5b_catalog_browser.py`: **1 PASS,6 warnings,6,10 s**. La ejecución integrada vuelve a incluirlo; no sumar como test distinto. |
| Flutter analyze | Mismo SDK/entorno y comando anterior: **PASS**, sin issues,4,1 s. |
| Flutter test | Mismo SDK/entorno y comando anterior: **57 PASS**. Sin cambios de código Flutter. |
| Ruff | `.venv/bin/python -m ruff check app tests`: **PASS**; `ruff format --check tests/test_phase5b_catalog_browser.py`: **PASS**. |
| Sintaxis/diff | `node --check tests/e2e/phase5b-catalog-browser.mjs`, `git diff --check`: **PASS**. |

```sh
# backend/, PostgreSQL sintético; sin plugin de adquisición/diagnóstico.
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

El backend completo incluye las regresiones existentes de concurrencia/permisos y los runners5A,5B-tema y5B-catálogo. Los3 SKIP son las migraciones anteriores que requieren bases/variables específicas; **no se cuentan como migraciones verificadas en esta ejecución**. No hay modelo/esquema nuevo. Los7 warnings de SQLAlchemy/Firebase y el aviso Vitest/Vite son los ya documentados; no se actualizan dependencias para silenciarlos.

Fallos previos: selector del test con regex mal escapada al construir una expresión CDP; sustitución por replaceAll literal. Dos intentos registraron la fuga de foco a BODY y motivaron ciclo explícito, conservando la assertion original. Después el test esperaba pantalla403 donde el guard existente redirige a /admin: se corrigió la expectativa y se añadió GET real403. No se modifican permisos para hacer pasar la prueba. Se esperó el fin de la transición del chip antes de medir y se compuso su fondo translúcido sobre la superficie real mediante canvas, evitando contar una transición inicial como estado seleccionado. Todos los FAILED anteriores siguen siendo FAILED; solo la última suite integrada acredita PASS.

Baseline: capturas del **build anterior**, obtenido con runner/plugin temporales fuera del repositorio;1 test de adquisición PASS (3,50 s), sin assertions de paridad. [Baseline](../ui/evidence/phase5b/catalog-dialog/baseline.json) conserva fondo fijo, ausencia de dialog y labels no asociados. No se usa ese plugin en los gates finales.

[Matriz actualizada](../ui/phase5b-parity-matrix.md#continuación--bloque3-catálogo-y-diálogos), [mediciones finales](../ui/evidence/phase5b/catalog-dialog/measurements.json), capturas antes/después/editor móvil/edición/confirmación/guardado/error en ese directorio. Contraste claro/oscuro de editor/input15,61/15,32, chip seleccionado con fondo compuesto6,09/7,59, advertencia6,74/6,35 y error oscuro9,27. No se extrapola a todos los hover/disabled, colores, lectores o dispositivos. Se inspeccionaron antes/después claro y editor móvil oscuro con botón accesible por scroll.

### Riesgos, rollback y estado

- Modalidad nativa y ciclo explícito se prueban en Chrome155. Safari/Firefox, lectores, texto ampliado y teclado virtual físicos: **UNKNOWN**; no se afirma conformidad global de accesibilidad. No se introduce dependencia de UI externa ni fallback de browser no validado.
- Fieldset/cierre bloqueado mantiene la operación visible hasta respuesta; no cancela/reenvía el request. Ante fallo se puede corregir/reintentar/cancelar; al reabrir activación no se muestra error anterior. Una respuesta de sesión expirada conserva el flujo AuthGate/BFF de Fase2; su regresión general pasa, pero no hay nueva captura de expiración con este modal abierto: **UNKNOWN** visual.
- El503 es una respuesta controlada de transporte para probar UI; el segundo POST sí escribe PostgreSQL. No demuestra disponibilidad productiva ni validación institucional/histórica. Datos y procesos son desechables/sintéticos.
- Rollback: recuperar únicamente página de catálogo previa y retirar uso del nuevo Modal/runner/tests de este bloque. Copia local de página previa y runner anterior en `/tmp/immuno-miguel-tools/phase5b-catalog/backup/`; inventario SHA-256 de581 archivos en ese directorio. No revertir globalmente el árbol ni tocar migraciones/datos. Deshacerlo restablece los gaps P2 de modalidad/tema.

| Elemento | Estado |
|---|---|
| B-02, B-03 en catálogo, B-05 y B-06 en catálogo | **DONE** correcciones técnicas acotadas y gates ejecutados. |
| Bloque3 como paridad visual completa Flutter/Next | **PARTIAL**: pantallas Flutter pareadas, listado loading/empty/error en todos los temas, zoom, lectores/dispositivos aún **UNKNOWN**. |
| B-06 fuera del catálogo, B-07/B-08 y bloques4–5 | **PENDIENTES**, no implementados aquí. |
| Fase5B completa | **PARTIAL**, sin cierre. |
| UI-16/UI-17 | **BLOCKED por alcance**. |
| T-02/T-03 y validación institucional/almacenamiento real | Conservan sus estados pendientes; no se cierran ni se declara producción lista. |

Revisión final: **git diff --check PASS**; revisión adicional de archivos nuevos, whitespace y enlaces locales PASS. Comparación incremental SHA-256 confirma backend/app, Flutter, clientes/contratos src/lib y runner anterior intactos; EMPTY/enums, inicialización/composición de payload y mutationFn de activación iguales al inicio del bloque. Solo cambia la página existente más los4 archivos nuevos y documentación/artefactos regenerados. Escaneo acotado de patrones de secretos de alta confianza sin coincidencias; no sustituye revisión global del árbol histórico. Sin migraciones, cambios clínicos ni commit.


## Continuación — bloque4: etiquetas, notificaciones y panel de usuario

Alcance anunciado para esta continuación: B-06 fuera del catálogo, B-07 y B-08 del plan. Se inspeccionaron la implementación, los tests afectados, AGENTS.md y las skills locales ui-parity, quality-gates y security-health antes de editar. Sin implementación del bloque5 ni cierre de Fase5B.

### Causas y solución

| Hallazgo | Causa raíz / archivos | Solución | Estado técnico |
|---|---|---|---|
| B-06 / P2 | Field en `admin/students/page.tsx`, `admin/students/create/page.tsx`, `admin/students/[id]/page.tsx` y `admin/admins/page.tsx` renderizaba Label sin htmlFor/id. También el Select de sexo en el alta. | useId estable por campo; htmlFor relacionado; los helpers de un hijo conservan ID explícito y clonan exclusivamente id en Input/Select. Sin cambios de valores, opciones, required, límites, payloads, invalidación ni navegación. | **DONE** en estas cuatro pantallas; no se extrapola a todos los formularios del proyecto. |
| B-07 / P2 | `components/notifications-list.tsx`: span role=button/TabIndex dentro del botón de abrir. Acciones/nombre y teclado anidados. | Botones nativos hermanos, nombres diferenciados y foco visible. Estado Leída/No leída escrito además del indicador de color. Marcar nunca navega; abrir conserva lectura+navegación. Iconos decorativos ocultos a tecnologías de asistencia. Tokens existentes para texto/iconos por tema. | **DONE**, componente y Chrome/FastAPI/PostgreSQL. |
| B-08 / P2 | `components/user-menu.tsx`: role=menu con links y selector de tema sin implementar teclado de un menu compuesto. | Panel disclosure/region de navegación y preferencias, nombre e IDs relacionados, aria-expanded/controls, Tab normal, Escape con retorno al disparador, cierre por click/foco exterior sin robar foco. No requiere flechas de un menu ARIA. | **DONE** controles probados; lectores de pantalla/dispositivos reales **UNKNOWN**. |

La referencia funcional Flutter se inspeccionó en `frontend/lib/features/shared/presentation/screens/notifications_screen.dart`, `_openNotification`: al abrir, marca como leída antes de navegar; IconButton de lectura es independiente. También se revisaron PopupMenuButton de dashboards administrativo y estudiantil: perfil/historial/contraseña/logout. No se copia ninguna regla clínica. La zona de marcado en Next pasa a ser un botón hermano de la zona de abrir; esa separación es el cambio de estructura necesario, no un rediseño masivo.

**Logout y función open/read se compararon exactamente contra los archivos previos y no cambiaron.** Next conserva su store/BFF y Flutter su coordinación de FCM. Este bloque no añade FCM a web ni presenta un test web como validación del transporte FCM real.

### Archivos y pruebas nuevas

- Se modifican los seis archivos UI de la tabla y `frontend-next/tests/e2e/phase5b-theme-browser.mjs`: sus tres selectores de disparador usan ahora el nombre accesible del panel. El resto de las assertions de ese runner se conserva.
- Nuevos tests de componente: [phase5b-field-labels.test.tsx](../../frontend-next/src/components/__tests__/phase5b-field-labels.test.tsx), [phase5b-notifications.test.tsx](../../frontend-next/src/components/__tests__/phase5b-notifications.test.tsx), [phase5b-user-menu.test.tsx](../../frontend-next/src/components/__tests__/phase5b-user-menu.test.tsx). **19 pruebas**: 4 de pantallas/campos, 7 de notificaciones y 8 de panel/roles/tema/logout.
- Nuevo [runner Chrome](../../frontend-next/tests/e2e/phase5b-controls-browser.mjs) y [test backend](../../backend/tests/test_phase5b_controls_browser.py). Reutilizan el harness de producción Next, FastAPI y PostgreSQL aislado; añaden exclusivamente avisos sintéticos por rol. No cambian `test_phase5a_browser.py` ni backend funcional.
- **12 archivos de código/pruebas**: 7 modificados y 5 nuevos. Documentos y capturas se enumeran por separado. **Migraciones nuevas: ninguna. Dependencias y lockfiles: sin cambios.**

Los tests verifican Enter/Espacio por acción, ausencia de navegación por marcado, una única lectura al abrir, avisos sin destino/ya leídos, refresh de query/contador, carga/vacío sin acciones, IDs únicos y click de etiquetas, atributos existentes, links por rol, Tab/Escape/foco exterior, cambio de tema sin logout y espera de finalización del logout antes de navegar.

En Chrome se comprueban dos roles de notificaciones y app_admin para las etiquetas del alta de administradores; marcado real persistido al recargar; contador; destino definido por backend; 401 de `/api/users/me` tras logout. Geometría del panel/lista sin overflow horizontal a320/390/768/1440 con alto568/844/1024/900. El contador del sidebar también comparte la invalidación existente de notifications; no se altera esa lógica.

### Ejecución y revisión

Entorno local existente: Python3.12.15/venv, Node22.22.1/Next16.3.6, PostgreSQL18, Chrome155, Flutter3.41.6/Dart3.11.4. Sin instalaciones ni credenciales institucionales.

| Gate | Comando / directorio | Resultado |
|---|---|---|
| Componentes nuevos | `npm test -- --run src/components/__tests__/phase5b-field-labels.test.tsx src/components/__tests__/phase5b-notifications.test.tsx src/components/__tests__/phase5b-user-menu.test.tsx`, frontend-next | **19 PASS**,3 archivos,1,86 s. |
| Next completo/BFF PostgreSQL | `BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test` | **166 PASS**,29 archivos,5,63 s. |
| Next lint | `npm run lint` | **PASS**. |
| Next typecheck | `node node_modules/typescript/bin/tsc --noEmit`, después del build | **PASS**. |
| Next production | `node node_modules/next/dist/bin/next build --webpack` | **PASS**, compilación4,3 s y26 páginas estáticas. |
| E2E nuevo aislado | Comando backend siguiente con `tests/test_phase5b_controls_browser.py` | **1 PASS**,6 warnings,8,64 s. |
| Backend completo/PostgreSQL + cuatro E2E | Comando siguiente sin selección de archivos | **389 PASS,3 SKIP,7 warnings,116,37 s**; los cuatro E2E pasan dentro de ese total. |
| Ruff | `.venv/bin/python -m ruff check app tests` y `ruff format --check tests/test_phase5b_controls_browser.py` | **PASS**,1 archivo ya formateado. |
| Flutter analyze | Entorno siguiente, `flutter analyze --no-pub`, frontend | **PASS**, sin issues,3,4 s. |
| Flutter test | Mismo entorno, `flutter test --no-pub --reporter expanded` | **57 PASS**. |
| Sintaxis runners | `node --check tests/e2e/phase5b-controls-browser.mjs` y `phase5b-theme-browser.mjs` | **PASS**. |

```sh
# backend/; PostgreSQL exclusivamente local y sintético.
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
# frontend/; SDK existente, sin pub get ni cambios de paquetes.
FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache \
/tmp/immuno-miguel-tools/flutter/bin/flutter analyze --no-pub
FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache \
/tmp/immuno-miguel-tools/flutter/bin/flutter test --no-pub --reporter expanded
```

Los tres SKIP son test_phase1_migration, test_phase2_migration y test_certificate_signer_migration: faltan PHASE1_POSTGRES_URL, PHASE2_POSTGRES_URL y PHASE4_SIGNER_POSTGRES_URL para sus bases desechables específicas. **No se ejecutaron ni se cuentan como PASS**; no hubo cambios de esquema ni migraciones nuevas. Los warnings son las deprecaciones existentes de noload SQLAlchemy y MulticastMessage.tokens Firebase; Vitest conserva su aviso de futuro configLoader.

El total389 incluye regresiones PostgreSQL de concurrencia de comentario/revisión, refresh/reset y operaciones administrativas, paginación/permisos y los runners phase5a-browser, phase5b-theme-browser, phase5b-catalog-browser y phase5b-controls-browser. No se suman los E2E otra vez al total.

Intentos fallidos conservados: primera sonda CDP devolvía un nodo DOM con returnByValue (`Object reference chain is too long`); se convirtió a Boolean. Segunda sonda consultaba `/api/backend/users/me` y recibió404; se corrigió a la ruta existente `/api/users/me`, manteniendo la exigencia401. Son errores del test, no correcciones del producto ni relajación de permisos. Un primer comando de anexado del runner utilizó un directorio equivocado y falló sin escribir; se corrigió con ruta absoluta. No se cuentan esos intentos como PASS.

[Colección de capturas/mediciones](../ui/evidence/phase5b/controls/measurements.json):18 PNG y un JSON, solo datos sintéticos. Se inspeccionaron visualmente el panel móvil claro y la lista administrativa oscura. Hay referencia de código Flutter y capturas Next; **no hay todavía captura Flutter pareada completa** de estas pantallas. Se mantiene **UNKNOWN**, sin atribuir paridad visual global a tests de estructura, paleta o ausencia de overflow.

### Seguridad, riesgos y rollback

No cambios de endpoints/contratos, auth, consultas/mutaciones de negocio, backend/app, frontend/lib, modelos o migraciones. Sin URLs/logs nuevos con PII; las capturas contienen únicamente cuentas/avisos sintéticos. No exportar cookies/CSRF ni IDs personales en los artifacts. Verificación exacta de función de logout, apertura y revisión incremental por SHA-256 frente al inicio del bloque.

Riesgos: el panel ya no anuncia menu ARIA sino región; se verifica teclado nativo, queda pendiente lector de pantalla real. La separación cambia los límites de zonas clicables; la lectura y destinos se preservan. Los helpers Field admiten un único control con id, restringido por tipo; futuros controles compuestos necesitan asociación explícita.

Rollback: revertir exclusivamente el delta de presentación/etiquetas/panel de este bloque, después de revisar los archivos contra la copia inicial local `/tmp/immuno-miguel-tools/phase5b-controls/backup`. Mantener los botones hermanos de notificación y sus tests al revertir aspectos visuales; no reinstalar controles anidados. No restaurar el árbol completo ni sobrescribir cambios de fases anteriores. No hay rollback de datos, contratos o infraestructura necesario.

Revisión final: `git diff` y `git diff --check` PASS; también se revisaron los nuevos archivos (no incluidos en el diff de archivos rastreados). La comparación SHA-256 frente al inicio distingue el árbol sucio anterior:7 archivos de código/pruebas modificados,5 nuevos,3 documentos actualizados,18 PNG+JSON nuevos. La suite regeneró además8 capturas existentes de bloques2/3/tema; no representan nuevos cambios de producto. Verificación exacta de lógica de formularios fuera de Field, de handleLogout/open y del runner previo salvo sus tres selectores: PASS. Backend/app, Flutter/lib, contratos/auth Next, migraciones, dependencias y lockfiles sin cambios incrementales. Links locales/whitespace de documentos: PASS. Escaneo limitado de patrones de secretos de alta confianza sobre los textos intervenidos:0 hallazgos; no equivale a auditoría integral. Sin commit.

UNKNOWN pendientes: comparación Flutter/Next pareada de todas las pantallas/estados, lectores, zoom/texto ampliado, dispositivos/teclado virtual, carga/error/expiración del panel en ambos temas y alturas inferiores a las medidas. No se afirma que el test de lectura entre roles valide notificaciones ajenas por ID; no se cambió ese control backend. El transporte FCM con infraestructura real tampoco se valida con este E2E web.

**B-06 en cuatro pantallas = DONE; B-07 = DONE; B-08 = DONE en controles probados. Bloque4 visual integral = PARTIAL. FASE5B = PARTIAL. Bloque5 pendiente. UI-16/UI-17 = BLOCKED por alcance. T-02/T-03 = PARTIAL. Sin commit.**


## Continuación — bloque5: notificaciones y referencia visual local

Fecha:2026-10-10, America/Bogota. Primera muestra pareada del bloque5, acotada a notificaciones. Se releen AGENTS.md, skills ui-parity/quality-gates/security-health, plan, matriz y código/tests antes de modificar. No se cierra el bloque5 ni Fase5B por completar esta pantalla.

### Hallazgos, causa y solución

| ID / prioridad | Causa raíz / archivo | Solución | Pruebas / estado |
|---|---|---|---|
| B5-N01 / P2 | NotificationsScreen fijaba AppColors.textSecondary en vacío incluso con AppTheme oscuro. Contraste de widget real3,84697. | ColorScheme.onSurfaceVariant existente; no nueva paleta. Claro8,92786, oscuro11,00208. | Test falla antes y pasa después, captura antes/después. **DONE** para este texto. |
| B5-N02 / P2 | IconButton de lectura sin tooltip; lectura diferenciada por color/peso, sin etiqueta explícita de estado. | Tooltip Marcar como leída y Semantics Leída/No leída. Sin cambios a onTap/onPressed ni provider. | Falla por ausencia de tooltip antes; luego marcado sin navegación, contador, estado semántico, labeledTapTargetGuideline y androidTapTargetGuideline pasan. **DONE** controles probados. |
| B5-N03 / P2 | No había referencia de pantalla Flutter real con fuentes locales ni comparación pareada de estados. | Fixture común, Inter auténtico local, MaterialIcons del bundle,16 muestras claras/oscuras con TextScaler1/2; Chrome por rol/estado/tema y CSS zoom. | **DONE** infraestructura/muestras de notificaciones; no paridad global. |
| B5-N04 / P2 | NotificationState no tenía error; NotificationNotifier._load catch conservaba/restauraba lista sin avisar. Una carga inicial fallida podía representar vacío. | Se registró sin modificar provider en aquel bloque de presentación. Corrección funcional en la continuación documentada abajo. | **DONE** en la continuación de error/reintento; anteriormente PENDING / PARTIAL. |

Único archivo funcional modificado: [notifications_screen.dart](../../frontend/lib/features/shared/presentation/screens/notifications_screen.dart). Se preservaron exactamente _openNotification y _categoryIcon, así como el código de callbacks de lectura, provider, auth y contratos. La captura con texto2× sugería un borde del Badge recortado; la prueba del rectángulo de texto confirma que el número sigue dentro del viewport. **No se cambió el espaciado** ni se presentó la apariencia del círculo como pérdida de datos demostrada.

### Infraestructura y archivos

- Nuevo [test Flutter](../../frontend/test/core/theme/phase5b_notifications_reference_test.dart):21 tests, con16 comparaciones golden a390×844, sin actualizar referencias. El matcher compara ANTES de cualquier exportación opcional.16 PNG se repitieron idénticos entre una ejecución aislada y la suite completa antes de fijar ese gate. Goldens de Flutter3.41.6/renderer actual; otros SDK/OS necesitan evaluación, no actualización ciega.
- Nuevo [fixture común](../ui/fixtures/phase5b-notifications.json): dos avisos sintéticos sin información clínica ni credenciales. Flutter agrega IDs ficticios/destino para representación; PostgreSQL genera IDs y FastAPI resuelve destinos por rol. No se publican IDs/cookies en las mediciones.
- Nuevos [test PostgreSQL/Chrome](../../backend/tests/test_phase5b_notifications_browser.py) y [runner](../../frontend-next/tests/e2e/phase5b-notifications-browser.mjs). No cambia el harness anterior. Avisos se guardan en el schema aislado; se comprueba respuesta real inicial y403 real de administración app_admin para student/admin. Read/empty/loading/error se inducen mediante respuestas controladas/CDP para presentación, sin escribir estados falsos al backend. La lectura persistente real sigue cubierta por el runner de controles.
- Cuatro fuentes Inter TTF de tests, [manifest](../../frontend/test/fixtures/fonts/manifest.json), licencia OFL y [README](../../frontend/test/fixtures/fonts/README.md). SHA-256/tamaño coinciden con los descriptores de google_fonts6.3.3 ya fijado. No se añaden al pubspec ni al producto. MaterialIcons se carga del bundle real; runtime fetching desactivado en el test. Seam visibleForTesting del paquete acotado y restaurado.
- Actualizados audit, plan, matriz y design-tokens.99 artifacts nuevos:94 PNG y5 JSON;92 PNG de pantallas (16 antes,16 después Flutter y60 Next) y2 de paleta generados incidentalmente por la suite anterior.17 PNG previos se regeneraron por los E2E existentes; no son cambios nuevos de producto.
- **Migraciones nuevas: ninguna. Dependencias/manifiestos/lockfiles: sin cambios. Backend y Next funcional: sin cambios.**

### Recuperación del entorno y evidencia real

Las herramientas que estaban en /tmp desaparecieron entre sesiones. El venv apuntaba a Python ausente (`No such file or directory`) y pg_ctl informó que pgdata no existía. Se recuperaron únicamente herramientas temporales/versiones anteriores: Python3.12.15 para el venv existente; Flutter3.41.6 desde el [archivo oficial](https://docs.flutter.dev/install/archive), SHA-256503b3e6b7d352fca5d21b6474eca95ad544d8fc3b053782eab63a360c7fc7569; paquetes Flutter del lockfile con --enforce-lockfile; PostgreSQL18 local, initdb nuevo solo sintético,127.0.0.1:55544. uv0.13.0 se instala solo en /tmp para recuperar Python; no depende de él el producto. Node22.22.1/npm9.2.0 y paquetes Python/Next del workspace se conservaron. Ninguna instalación global ni conexión institucional.

Primer intento del manifiesto Flutter usaba una ruta incorrecta con segmento adicional y obtuvo404; se corrigió a la ruta oficial releases/releases_linux.json. DNS del sandbox requería ejecutar la descarga autorizada fuera de él. Los errores fueron recuperados sin cambiar versiones ni usar otra versión para obtener PASS.

| Gate / comando | Resultado de esta ejecución |
|---|---|
| Flutter nuevo, `flutter test --no-pub --reporter expanded test/core/theme/phase5b_notifications_reference_test.dart` | Antes:19 PASS/2 FAILED por contraste y tooltip; después21 PASS. Posteriormente16 goldens incorporados y comprobados dentro de la suite final. |
| Flutter completo, `flutter test --no-pub --reporter expanded` | **78 PASS**, suite final sin exportación ni --update-goldens; incluye16 comparaciones golden. |
| Flutter analyze, `flutter analyze --no-pub` | **PASS**, sin issues,2,2 s final. |
| Dart format, archivo de pantalla y test nuevo | **PASS**, último test sin diferencias; sin formatter global. |
| Next/PostgreSQL BFF, `BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test` | **166 PASS**,29 archivos,6,70 s; sin Next funcional nuevo. |
| Next lint / typecheck | `npm run lint` / `node node_modules/typescript/bin/tsc --noEmit`: **PASS**. |
| Production build | `node node_modules/next/dist/bin/next build --webpack`: **PASS**, compilación3,5 s y26 páginas. |
| Nuevo E2E aislado | **1 PASS**,6 warnings,20,16 s; antes de añadir capturas extra de scroll. La versión final ampliada pasa en la suite completa. |
| Backend/PostgreSQL completo + cinco E2E | **390 PASS,3 SKIP,7 warnings,148,89 s**. Incluye los cinco runners existentes/nuevo, concurrencia, paginación y permisos; no se suman otra vez al total. |
| Ruff / formato test Python | `ruff check app tests`, `ruff format --check tests/test_phase5b_notifications_browser.py`: **PASS**. |
| Sintaxis runner | `node --check frontend-next/tests/e2e/phase5b-notifications-browser.mjs`: **PASS**. |

Comandos backend desde backend, Flutter desde frontend y Next desde frontend-next. Flutter usa FLUTTER_SUPPRESS_ANALYTICS=true, PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache y SDK /tmp/immuno-miguel-tools/flutter/bin/flutter. PHASE5B_ARTIFACT_DIR exporta capturas opcionalmente; el gate final Flutter se ejecutó sin esa variable. Backend completo:

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

Los tres SKIP de migraciones requieren PHASE1_POSTGRES_URL, PHASE2_POSTGRES_URL y PHASE4_SIGNER_POSTGRES_URL y sus bases desechables específicas. No se ejecutaron ni se llaman PASS. Sin cambios de esquema en esta continuación. Deprecaciones noload/Firebase y aviso futuro de Vite conservados. El primer analyze del test nuevo detectó5 avisos de estilo; se corrigieron. Un intento posterior falló por SemanticsHandle activo al final del test: se libera en finally dentro del cuerpo antes de la comprobación del runner. No se rebajaron las assertions.

### Comparación, seguridad, límites y rollback

[Matriz pareada](../ui/phase5b-parity-matrix.md#continuación--bloque5-primera-comparación-pareada-notificaciones), [índice/hash de imágenes](../ui/evidence/phase5b/notifications-comparison/comparison-index.json), [contraste real Flutter](../ui/evidence/phase5b/notifications-comparison/flutter-measurements.json), [geometría/estados Next](../ui/evidence/phase5b/notifications-comparison/next-measurements.json). Se inspeccionaron imágenes de vacío oscuro y datos ampliados de ambas plataformas. Flutter muestra appbar/lista nativos; Next conserva shell/navegación/descripción/fechas y necesita scroll vertical al ampliar. No se fuerza igualdad de píxeles ni se copia dominio.

**CSS zoom2 de Chrome no es zoom nativo ni TextScaler2 de Flutter.** Ambos se identifican correctamente; contenido web accesible por scroll y documento sin overflow horizontal. Widget compartido Flutter no demuestra permisos móviles ni FCM. Error visual Flutter pendiente, no simulado como validado. TalkBack/VoiceOver, dispositivos/teclado virtual, otras pantallas y estados pareados, expiración durante estos widgets y zoom nativo permanecen **UNKNOWN** donde faltan pruebas.

Riesgo: los goldens dependen del renderer/SDK/font; una actualización necesita revisar diferencias justificadas. El seam de fuente es solo de test y está ligado al paquete fijado. Rollback de producto: revertir únicamente color/tooltip/Semantics de NotificationsScreen frente al backup inicial local de este bloque, después de revisar el diff; mantener cambios de fases anteriores. No hay rollback de datos/migraciones. Los tests, fixtures y referencias se pueden conservar para detectar el defecto reintroducido. Eliminar /tmp perdería herramientas locales pero no fixtures/goldens de tests; recuperación documentada.

**B5-N01/B5-N02 e infraestructura de notificaciones = DONE en lo probado. B5-N04 y comparación integral = PARTIAL. FASE5B = PARTIAL; UI-16/UI-17 = BLOCKED por alcance; T-02/T-03 = PARTIAL. Sin commit; no producción lista.**


Revisión final de este bloque: git diff y git diff --check PASS; inspección incremental contra baseline SHA-256 distingue los cambios anteriores. Único código funcional intervenido: NotificationsScreen en presentación. No archivos borrados ni cambios de backend/app, Next/src, provider, auth, dominio, migraciones, manifiestos o lockfiles.21 tests Flutter nuevos y1 test browser nuevo; fuentes/fixture/evidencia detallados arriba. Formato Dart final --output=none --set-exit-if-changed:2 archivos,0 cambios. Links locales y texto propio sin errores; se preserva el whitespace original de OFL.txt. Escaneo limitado de patrones de secretos de alta confianza:0 hallazgos; no auditoría completa del repositorio. Sin commit.

## Continuación — B5-N04: error y reintento de notificaciones Flutter

Fecha: 2026-10-10, America/Bogota. Bloque acotado anunciado antes de editar. AGENTS.md y skills ui-parity, quality-gates y security-health leídos; inspección de provider, datasource, pantalla, auth y tests de sincronización existentes. FastAPI sigue siendo autoridad. Sin cambio de negocio, permisos, contratos, autenticación, backend o Next funcional.

### Causas y solución

**B5-N04 / P2 = DONE en lo probado.** El catch de `_load` descartaba la excepción y construía un estado sin indicador de error; una carga inicial fallida terminaba en “No tienes notificaciones”. Además, tras fallar un refresh, la fecha de la respuesta anterior seguía habilitando el TTL de 15 segundos y podía impedir una nueva carga normal inmediata.

- `frontend/lib/features/shared/presentation/providers/notification_provider.dart`: campo opcional local `errorMessage`; mensaje constante seguro sin datos de la excepción. Conserva lista y contador tras el fallo; invalida la frescura de la caché. El inicio del reintento y el éxito limpian el error. Conserva guards por request/mounted, deduplicación de cargas y escrituras, TTL de respuestas exitosas y reconstrucción del provider por userId.
- `frontend/lib/features/shared/presentation/screens/notifications_screen.dart`: error inicial separado del vacío; botón Reintentar y aviso liveRegion. Si hay datos anteriores, mantiene lista visible con aviso. Reintentar usa `load()` después de invalidar el TTL: aprovecha la deduplicación existente incluso si se invoca dos veces antes del siguiente frame. Se conserva exactamente `_openNotification` y `_categoryIcon`; se extrae el cuerpo anterior sin cambiar las pantallas de éxito/carga/vacío.
- **B5-N05 / P2 = DONE** para el nuevo botón: el tema global TextButton heredado daba contraste claro **2,51317:1**, demostrado por cuatro fallos. ColorScheme.onSurface aplicado exclusivamente a Reintentar produce **16,22620:1** claro y **14,47777:1** oscuro. Sin modificar AppTheme, paleta global ni otros botones.

### Archivos y pruebas

Dos archivos funcionales anteriores; nuevo [phase5b_notification_errors_test.dart](../../frontend/test/core/phase5b_notification_errors_test.dart), con **11 pruebas** (7 provider/identidad/disposición y 4 widget). Actualizado [test de referencia](../../frontend/test/core/theme/phase5b_notifications_reference_test.dart), con **8 pruebas adicionales** de error inicial/datos retenidos × claro/oscuro × TextScaler1/2, fuentes locales reales, nombres/targets accesibles y contraste. Las 16 referencias golden existentes pasan sin actualizar sus PNG.

Se prueban fallo inicial distinto de vacío, diagnóstico interno no visible, reintento y doble invocación, fallo de refresh dentro del TTL, conservación de lista/contador y lectura confirmada, error antiguo frente a éxito nuevo, éxito antiguo frente a error nuevo, cambio de usuario/logout con respuesta tardía, fallo tras dispose y recuperación vacía válida. No se modifica el mecanismo de sesión ni FCM.

[Ocho capturas nuevas](../ui/evidence/phase5b/notification-errors/capture-index.json) y [contrastes](../ui/evidence/phase5b/notification-errors/flutter-measurements.json). Se inspeccionaron error inicial claro y error con datos retenidos oscuro/texto2. Se regeneraron capturas Next previas mediante los E2E; el índice de notificaciones actualiza sus hashes (15 PNG cambiaron), verificando que todos los hashes de goldens Flutter anteriores permanecen intactos. Las capturas nuevas son evidencia de representación, **no ocho nuevos goldens**. Datos solo sintéticos.

### Ejecución real

Entorno existente: Python3.12.15/venv, PostgreSQL18 exclusivamente local, Node22.22.1, Next16.3.6/webpack, Chrome155, Flutter3.41.6/Dart3.11.4; mismos manifests/lockfiles. No instalaciones ni migraciones nuevas.

| Gate | Resultado |
|---|---|
| `flutter test --no-pub --reporter expanded test/core/phase5b_notification_errors_test.dart` | Antes: **2 FAILED** por error/reintento inexistentes; después **11 PASS**. |
| Referencias de error, mismo runner con `test/core/theme/phase5b_notifications_reference_test.dart --plain-name "error reference"` | **8 PASS**. Contraste heredado: 4 PASS/4 FAILED; después de ajuste local,8 PASS. |
| Flutter completo, `flutter test --no-pub --reporter expanded` | **97 PASS**, incluido el gate de 16 goldens anteriores; sin --update-goldens ni exportación de referencias. |
| `flutter analyze --no-pub` | **PASS**, sin issues,2,5 s final. Primer intento tuvo dos infos de llaves en tests, corregidas. |
| Dart format --output=none --set-exit-if-changed, cuatro archivos Dart de este bloque | **PASS**,0 cambios. Primer check detectó un test sin formato; se formateó y repitió. |
| Next: `BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test` | **166 PASS**,29 archivos,7,00 s. |
| Next: `npm run lint`; `node node_modules/typescript/bin/tsc --noEmit` | **PASS** ambos. |
| Next: `node node_modules/next/dist/bin/next build --webpack` | **PASS**, compilación3,2 s,26 páginas estáticas. |
| Backend/PostgreSQL + cinco E2E Chrome, comando de abajo | **390 PASS,3 SKIP,7 warnings,147,05 s**; concurrencia/paginación/permisos y cinco E2E incluidos, sin sumarlos otra vez. |
| Backend: `.venv/bin/python -m ruff check app tests` | **PASS**. |

```sh
# backend/; solo PostgreSQL sintético local
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
# frontend/; prefix para los comandos Flutter de la tabla
FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache \
/tmp/immuno-miguel-tools/flutter/bin/flutter analyze --no-pub
```

Los tres SKIP siguen siendo migraciones que requieren PHASE1_POSTGRES_URL, PHASE2_POSTGRES_URL y PHASE4_SIGNER_POSTGRES_URL y bases desechables específicas. No se llaman PASS. No cambia el esquema. Warnings existentes noload/Firebase/Vite conservados. El primer intento Flutter dentro del sandbox falló al crear su socket local (`Operation not permitted`); se repitió con la aprobación de ejecución correspondiente. No fue un resultado de los tests ni se cambiaron dependencias para superarlo.

### Límites, seguridad y rollback

Flutter error/retry se verifica con datasource controlado y notifier real en widgets; las capturas usan estado controlado para representación. Los E2E Chrome ejecutan FastAPI/PostgreSQL reales, pero **no prueban transporte móvil ni dispositivo Flutter real**. TalkBack/VoiceOver, teclados/dispositivos, zoom nativo y otras pantallas continúan UNKNOWN/pending. El mensaje Flutter es seguro/genérico; Next distingue códigos HTTP mediante QueryError. No se afirma igualdad textual o de composición entre plataformas.

Diferencia observada por código y pendiente de evaluación visual: Next devuelve QueryError cuando falla un refresh incluso si useQuery conserva datos previos; Flutter ahora mantiene la lista con aviso. No se cambia Next en este bloque ni se declara paridad completa de refresh fallido. No se modifican fallos de mutación ni políticas de sesión al resolver un fallo de consulta.

Riesgo: los consumidores que cargan notificaciones silenciosamente mantienen avisos anteriores y pueden observar el nuevo error; se invalidó su frescura pero no se añadió reintento automático ilimitado ni polling nuevo. La revisión verifica que `_write`, destinos, permisos y sesión conservan su implementación anterior.

Rollback: revertir únicamente el delta de provider/pantalla/test de este bloque frente a `/tmp/immuno-miguel-tools/phase5b-notification-errors/backup`, después de revisar los cambios. Preservar cambios anteriores y tests de lectura/sesión; no revertir el árbol completo. No hay rollback de datos/migraciones. Conservar la evidencia de fallos y pruebas que detectan su reintroducción.

**B5-N04/B5-N05 = DONE en pruebas ejecutadas. FASE5B = PARTIAL.** Otras pantallas/estados pareados pendientes; UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL. Sin commit, despliegue ni declaración de producción lista.

Revisión final incremental frente a baseline SHA-256 de esta continuación: dos archivos funcionales Flutter modificados, un test actualizado y uno nuevo, tres documentos actualizados, diez artifacts nuevos (ocho PNG y dos JSON),31 capturas previas regeneradas y un índice de hashes previo actualizado. Sin archivos borrados. Apertura/mapeo de destinos y bloque de escrituras/provider por usuario conservados exactamente. Backend funcional, Next funcional, auth, migraciones, manifiestos y lockfiles sin cambios incrementales. `git diff` revisado y `git diff --check` PASS; también se inspeccionaron los archivos nuevos. Links locales/whitespace/índices SHA-256 PASS. Escaneo limitado de patrones de secretos de alta confianza sobre los textos intervenidos:0 hallazgos; no auditoría integral de secretos. Sin commit.

## Continuación — refresh fallido de notificaciones Next

Fecha: 2026-10-10, America/Bogota. Alcance anunciado: conservar avisos anteriores ante fallos transitorios, con aviso/reintento, comparando con Flutter. AGENTS.md y skills ui-parity, quality-gates y security-health leídos antes de editar. La comparación detectó además un aviso duplicado en el shell; se anunció su corrección acotada antes de modificarlo. Sin reglas clínicas, endpoints, contratos API ni autenticación de Fase2 nuevos.

### Hallazgos y causas

| ID / prioridad | Causa raíz / impacto | Solución / archivos |
|---|---|---|
| B5-N06 / P2 | `student/notifications/page.tsx` y `admin/notifications/page.tsx` retornaban QueryError ante cualquier error, ocultando datos previos que useQuery conservaba. Diferencia funcional frente a Flutter tras B5-N04. | Conservar lista/contador de la página solo ante fallos de red/sin status,429 o5xx; error seguro y texto de últimos datos cargados. Error inicial sin data continúa separado del vacío. Reintento con cancelRefetch:false y disabled/aria-busy durante carga. |
| B5-N07 / P1, prevención de regresión | Una primera implementación de retención basada solo en el último status podía mostrar datos anteriores tras403→503. **Riesgo introducido por el prototipo de esta continuación**, no vulnerabilidad atribuida a la versión anterior que ocultaba datos ante cualquier error. Reproducido con dos tests. | `lib/ui/notification-query.ts`: guard de presentación compartido asociado al QueryClient, con booleano y contador de requests en un WeakMap en memoria. Observa cada intento y conserva el antecedente al desmontar/remontar la pantalla. Un error de acceso/contrato o cancelación bloquea la retención hasta una respuesta exitosa nueva. No decide permisos ni sustituye FastAPI. El GET exitoso puede devolver datos estructuralmente iguales: aun así libera el bloqueo. |
| B5-N08 / P2 | `AppShell` observaba la consulta independiente notifications/shell y mostraba su QueryError fuera de main, mientras la página mostraba otro. Captura real con dos errores/reintentos; espera E2E ambigua. Contadores retenidos del shell podían verse incluso al fallar su consulta. | `components/app-shell.tsx`: en las dos rutas de notificaciones, la página representa el error; otros módulos conservan el error global. Ocultar contadores si falla su consulta; reaparecen cuando esa consulta vuelve a tener éxito. Reintento global coordinado y deshabilitado mientras está pendiente. |

`components/query-error.tsx` añade únicamente el prop local opcional `retrying=false`; los consumidores anteriores conservan su comportamiento. El mapa seguro de mensajes HTTP es idéntico; no se muestran mensajes técnicos del payload. failureReason de la consulta permite mostrar el primer error de acceso y ocultar datos durante el retry automático, conservando su política existente. Se preservan exactamente las mutaciones markRead de ambas páginas y el componente NotificationsList, destinos, método PUT, payloads, invalidación, navegación y permisos.

Las claves de consulta de página `['notifications']` y shell `['notifications','shell']`, polling de30 s y transporte permanecen. Se deduplica el reintento de cada consulta, **no se promete una única consulta entre ambos observers independientes**. No se añaden descargas de listas ni reintentos automáticos nuevos. La página conserva avisos previos con advertencia; el shell oculta contadores fallidos en vez de presentarlos como actuales.

### Archivos, pruebas y comparación

- Cinco archivos funcionales Next: dos páginas, QueryError, AppShell y nuevo helper de presentación. Sin código funcional Flutter/backend modificado.
- Nuevos [tests de página](../../frontend-next/src/components/__tests__/phase5b-notification-refresh.test.tsx): **34 pruebas**:32 por student/admin y2 de orden de requests, con QueryClient real y API controlada. Red/503/429,400/401/403/404/422, cancelación, error inicial frente a vacío, reintento/doble click/respuesta demorada, actualización y recuperación vacía, datos previamente vacíos,403→503→200, denegación escondida por retry automático, ocultación desde el primer403 mientras el retry está pendiente, y navegación/remontaje. Las dos carreras prueban que una respuesta antigua no invalida el antecedente más reciente. Las consultas de recuperación no ejecutan markRead ni navegación inesperada.
- Nuevos [tests de shell](../../frontend-next/src/components/__tests__/phase5b-notification-shell.test.tsx): **6 pruebas**, por ambos roles. Aviso/reintento único en notificaciones, conservación del error en otras rutas, reintento pendiente y contador fallido oculto. Menú/tema/logo controlados exclusivamente en estos componentes; E2E conserva componentes reales.
- Ampliado [runner Chrome existente](../../frontend-next/tests/e2e/phase5b-notifications-browser.mjs), sin modificar su wrapper Python/harness. Fixture real inicial desde FastAPI/PostgreSQL; errores503/403/401 y respuesta de recuperación se controlan por CDP. Visibilidad provoca el listener de foco existente; no se añade ningún hook de test al producto. Comprueba una petición para doble retry, respuesta demorada,403→503 sin revelación de datos, regreso desde Historial con denegación conservada, nuevo200,401→login y ausencia de avisos tras expiración.403 de administración app_admin se sigue comprobando contra backend real.
- Capturas pareadas con [Flutter/datos retenidos](../ui/evidence/phase5b/notification-errors/flutter-notifications-error-retained-light-390-text1.png), ambos temas y pantalla390. Chrome usa CSS zoom2 para stress de layout: no equivale a zoom nativo ni TextScaler2. No igualdad pixel a pixel. El error se representa con los componentes y tokens existentes.
- **Migraciones nuevas: ninguna. Dependencias, manifiestos y lockfiles: sin cambios.** UI-16/UI-17, PDFs/QR, Maps, Azure y stores fuera de alcance.

### Ejecución y resultados

Entorno temporal existente: Python3.12.15/venv, PostgreSQL18 local sintético, Node22.22.1/Next16.3.6, Chrome155, Flutter3.41.6/Dart3.11.4. Sin instalaciones ni datos institucionales.

| Gate / comando | Resultado |
|---|---|
| Nuevos tests de página, `npm test -- --run src/components/__tests__/phase5b-notification-refresh.test.tsx` | **34 PASS**. Antes de retención:12 PASS/10 FAILED; regresión403→503:2 FAILED antes del guard; cuatro tests adicionales FAILED demostraron que el guard local se perdía al remontar o ante retry automático. Dos tests más FAILED demostraron que había que representar failureReason durante el retry pendiente, sin esperar el error final. Después se pasan34. |
| Nuevos tests de shell, mismo comando con `phase5b-notification-shell.test.tsx` | **6 PASS**. Primer intento:2 PASS/4 FAILED por preparación/esperas/selectores de tests; corrección descrita abajo. |
| Next completo/BFF PostgreSQL | `BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test`: **206 PASS**,31 archivos,7,97 s, protección final de caché y denegación inmediata durante retry. La ejecución previa con guard local tuvo198 PASS; no se usa como gate final. |
| Next lint | `npm run lint`: **PASS**. |
| Next typecheck | `node node_modules/typescript/bin/tsc --noEmit`, después del build final: **PASS**. |
| Production webpack | `node node_modules/next/dist/bin/next build --webpack`: **PASS**, compilación7,2 s y26 páginas estáticas finales. |
| E2E aislado ampliado, antes de corregir duplicación del shell | **1 PASS**,6 warnings,45,27 s; primera ejecución había fallado por la espera global del error. Es evidencia intermedia, no cierre del build final. |
| Backend/PostgreSQL + cinco E2E, antes de corregir duplicación del shell | **390 PASS,3 SKIP,7 warnings,165,81 s**. Evidencia intermedia: se repite contra el build final. |
| Backend/PostgreSQL + cinco E2E, shell final / guard local | **390 PASS,3 SKIP,7 warnings,163,64 s**, evidencia intermedia. |
| Backend/PostgreSQL + cinco E2E, protección final de caché | **390 PASS,3 SKIP,7 warnings,164,29 s**, build y runner finales; cinco E2E incluidos, sin sumar dos veces. |
| E2E aislado con protección final y selector de Historial corregido | **1 PASS**,6 warnings,40,00 s; también pasa en la suite final. |
| Ruff | `.venv/bin/python -m ruff check app tests`: **PASS**. |
| Sintaxis runner | `node --check tests/e2e/phase5b-notifications-browser.mjs`: **PASS**. |
| Flutter analyze/test | `flutter analyze --no-pub`: **PASS**,sin issues,1,8 s; `flutter test --no-pub --reporter expanded`: **97 PASS**,16 goldens anteriores sin actualizar. Sin cambios Flutter en este bloque. |

Comandos desde backend,frontend-next y frontend según corresponda. Flutter usa FLUTTER_SUPPRESS_ANALYTICS=true/PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache/SDK local. Backend completo:

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

Los SKIP de todas las ejecuciones, incluida la final son las tres migraciones que requieren PHASE1_POSTGRES_URL,PHASE2_POSTGRES_URL y PHASE4_SIGNER_POSTGRES_URL y bases desechables específicas. No se llaman PASS; no se cambió esquema. Warnings noload/Firebase/Vite conservados.

Intentos fallidos conservados: el primer test de reintento de página debía esperar la notificación de error de QueryClient antes de localizar el botón; se añadió findByRole(alert). El primer E2E esperaba cualquier alert, alcanzando el del shell antes del403 de main; ahora exige el mensaje403 específico antes de comprobar que no haya datos. Los cuatro fallos iniciales de tests de shell usaban un nombre accesible con espacio no presente y suponían que, sin datos previos, el botón permanecía al pasar a carga. Se preparó explícitamente un refresh con datos y se verificó el contador dentro de aside. Sin relajar checks de duplicación, datos ocultos, peticiones únicas o recuperación. El gate posterior tuvo1 FAILED/389 PASS/3 SKIP,147,28 s: timeout de navegación porque el test buscaba Historial con mayúscula en el título estudiantil Mi historial. Se corrigió con títulos exactos por rol sin cambiar Historial funcional; resultado fallido conservado.

### Riesgos, seguridad y rollback

El helper mantiene solo booleano de bloqueo y contador por caché en memoria; no almacena el error, identidad ni response data; no persiste tokens/datos ni cambia roles. Cancelaciones y errores4xx salvo429 no permiten retención; el bloqueo previo sobrevive a un5xx posterior. Endpoints protegidos siguen requiriendo FastAPI/BFF; el estudiante no obtiene acciones administrativas. API client, auth store, BFF y logout no se modifican.

Riesgos: las consultas de shell/página siguen independientes; un contador oculto puede tardar hasta su siguiente respuesta válida en reaparecer. Su fallo no invalida la respuesta exitosa de la página. En notificaciones, la página representa el error de su lista; las demás rutas siguen mostrando el error global de contadores. No se modifican errores de escritura ni se promete lectura optimista tras una mutación cuyo GET posterior falla. La compatibilidad de QueryError se verifica también con consumidores anteriores.

401→login del E2E es una respuesta controlada que ejercita el mecanismo existente, **no prueba una expiración criptográfica nueva**.503/403 controlados no se presentan como infraestructura caída ni denegación backend real; el403 administrativo adicional sí es real. Pruebas/capturas solo sintéticas, sin exportar cookies, tokens, UUIDs o datos institucionales. No nuevas URLs/logs con PII/PHI.

Rollback: revertir únicamente los cinco archivos funcionales de este bloque frente a `/tmp/immuno-miguel-tools/phase5b-next-refresh/backup` y retirar el uso del helper nuevo tras revisar el diff. Recuperar la vista original error-only de las páginas si se revierte retención; **no eliminar solo el guard de denegación manteniendo la retención**. Conservar tests preventivos/evidencia y cambios previos. No rollback de datos/infraestructura ni git reset global.

**B5-N06/B5-N07/B5-N08 DONE en la ejecución final. FASE5B PARTIAL.** Otras pantallas/estados, lectores/dispositivos/zoom nativo pendientes/UNKNOWN. UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL. Sin commit ni producción lista.

Evidencia final: [24 PNG y sus hashes](../ui/evidence/phase5b/notification-refresh/capture-index.json), [cuatro escenarios rol/tema y mediciones](../ui/evidence/phase5b/notification-refresh/measurements.json). Se inspeccionaron la captura clara final (sin duplicación) y la oscura ampliada. Se actualizaron los hashes Next del índice previo por las regeneraciones E2E; los16 goldens Flutter permanecen intactos. No se exportan IDs/cookies ni se transforman respuestas controladas en evidencia clínica institucional.

**B5-N09 / P2 = PARTIAL, representación ampliada pendiente:** la captura oscura CSS zoom2 muestra fuerte truncamiento del título/mensaje al compartir la fila con icono y acciones fijos. El sticky header también solapa la primera línea del alert tras scrollIntoView. Fuente: estructura existente de NotificationsList y scroll de captura; estos componentes no cambiaron en esta continuación. Ausencia de overflow horizontal no demuestra legibilidad. Se conserva la evidencia, sin afirmar conformidad visual en texto/zoom ampliado. Hace falta medir zoom nativo y geometría frente al header, ajustar representación en un bloque responsive acotado y añadir checks de texto visible; no cambiar reglas/destinos/acciones. Zoom nativo/dispositivo sigue UNKNOWN.

Revisión final de esta continuación: cinco archivos funcionales Next (cuatro modificados y un helper nuevo), dos archivos nuevos de tests con40 pruebas y un runner E2E ampliado; tres documentos actualizados;26 artifacts nuevos (24 PNG y2 JSON),33 PNG previos regenerados y su índice de notificaciones actualizado. Comparación incremental SHA-256 frente al inicio: sin archivos borrados ni cambios en backend funcional, Flutter funcional/tests, auth/BFF/API, migraciones, dependencias, manifests o lockfiles. Las mutaciones de lectura permanecen exactamente iguales. `git diff` revisado y `git diff --check` PASS, incluidos archivos nuevos mediante revisión incremental. Texto/links/índices de hashes PASS;16 goldens Flutter intactos. Escaneo limitado de patrones de secretos de alta confianza sobre textos intervenidos:0 hallazgos, no auditoría integral. Sin commit.

## Continuación — B5-N09, reflow de notificaciones

Alcance: presentación de notificaciones Next, estudiante/administrador, ambos temas; sin cambios de API, negocio, auth, Flutter, PDF/QR, certificados, Maps ni Azure. `AGENTS.md` y skills locales `ui-parity`, `quality-gates`, `security-health` leídas. Baseline SHA-256 y copias de archivos intervenidos en `/tmp/immuno-miguel-tools/phase5b-notification-reflow`; el diff contra HEAD incluye fases anteriores y no delimita este bloque.

### Causas y solución

**B5-N09 / P2, fila:** `NotificationsList` reservaba icono, chevron y marcado en una misma fila y aplicaba `truncate` al título/`line-clamp-2` al mensaje. En390 CSS zoom2 la columna de texto quedaba muy estrecha; sin overflow horizontal pero con contenido oculto. Flutter permite varias líneas del título y mantiene dos líneas de subtítulo; su golden texto2 es referencia, no equivalente a CSS zoom2. Solución: título adaptable con corte de palabras largas; container query local de22rem reorganiza icono/destino, texto a todo el ancho y marcado independiente debajo. En espacio reducido el mensaje puede crecer completo; en espacio amplio conserva el resumen de dos líneas. Diferencia deliberada de representación para lectura web ampliada, sin añadir ni eliminar datos/acciones.

**B5-N09 / P2, desplazamiento:** `scrollIntoView({block:'start'})` ignoraba el header sticky. Se añade scroll-margin solo a main/título/alert/buttons de las rutas de notificaciones. Altura medida mediante `offsetHeight` y ResizeObserver, fallback al resize de ventana y cleanup al salir/desmontar. No usar `getBoundingClientRect().height` como CSS margin: aplicaría CSS zoom dos veces.

**B5-N09 / P2, capas:** revisión de captura320 y escritorio mostró los aros decorativos sobre tarjeta/contador. La decoración absoluta compartía nivel de pintura con contenido estático. AppShell crea una capa relativa z0 de contenido exclusivamente en notificaciones. `brand.tsx`, recorte decorativo y otras rutas no cambian. Tres muestras RGB de padding del badge en escritorio comprueban pintura real contra su fondo opaco en claro/oscuro; no es solo una assertion de clases.

### Archivos y pruebas nuevas

- `frontend-next/src/components/notifications-list.tsx`: clases/estructura de presentación; handlers `open`, navegación y marcado conservados.
- `frontend-next/src/components/notifications-list.module.css` (nuevo): adaptación por ancho de la tarjeta.
- `frontend-next/src/components/app-shell.tsx`: observación/cleanup y capa local de notificaciones; consultas/menús/contadores/auth intactos.
- `frontend-next/src/components/notification-content.module.css` (nuevo): margen de scroll de notificaciones.
- `frontend-next/src/components/__tests__/phase5b-notification-reflow.test.tsx` (nuevo):8 tests; ambos roles, altura cambiante, cleanup de ruta/unmount, fallback sin ResizeObserver, ausencia de observador en otras rutas; Enter/Espacio con título largo conserva acciones distintas.
- `frontend-next/tests/e2e/phase5b-notifications-browser.mjs`: mismo harness Chrome→Next webpack→FastAPI→PostgreSQL y fixture sintético;36 escenarios adicionales (dos roles × dos temas ×3 anchos/escalas ×3 estados: no leído, texto largo/sin espacios y refresh fallido retenido). Geometría de fragments de título/mensaje/fecha, ausencia de elipsis/clamp en estrecho, scroll fuera del header, Tab al marcado independiente, sin overflow y muestras RGB del contador. Se mantiene cobertura de carga/vacío/error/retry/403/401/permisos. El guard `Boolean(document.body)` evita leer textContent antes de existir body durante navegación; no debilita condiciones de estado.

Migraciones/dependencias nuevas: **ninguna**. Payload largo controlado exclusivamente por CDP para presentación; no se crea política clínica ni dataset institucional. IDs/cookies/sesiones no se exportan. Mediciones contienen solo roles/temas/geometría/RGB, no mensajes ni datos de cuenta.

### Verificación

Entorno existente: Python3.12.15, PostgreSQL18 local sintético127.0.0.1:55544, Node22.22.1, Next16.3.6, Vitest4.1.11, Chrome155/DPR1, Flutter3.41.6. Sin instalaciones ni actualizaciones. La versión observada de Vitest describe el entorno, no una modificación del lockfile.

| Gate real | Resultado |
|---|---|
| Next completo, BFF_TEST_DATABASE_URL sintético + `npm test` |214 PASS /32 archivos,8,98 s en la última ejecución;8 tests nuevos |
| Next `npm run lint` |PASS |
| Next `node node_modules/typescript/bin/tsc --noEmit` |PASS después del build final |
| Next `node node_modules/next/dist/bin/next build --webpack` |PASS final, compilación3,6 s,26 páginas estáticas |
| Flutter `flutter analyze --no-pub` |PASS, sin issues,5,5 s |
| Flutter `flutter test --no-pub --reporter expanded` |97 PASS; sin update-goldens |
| Backend `.venv/bin/python -m ruff check app tests` |PASS |
| Backend/PostgreSQL completo y cinco E2E antes del último ajuste de capa |390 PASS /3 SKIP /7 warnings,174,46 s; no es el gate del build final |
| Chrome/PostgreSQL sobre build final |1 PASS /6 warnings,52,26 s;36 escenarios reflow y12 comprobaciones RGB de escritorio |
| Backend/PostgreSQL completo y E2E final |390 PASS /3 SKIP /7 warnings,176,58 s, incluidos cinco E2E sobre el build final |
| Diff/índices/seguridad incremental |PASS revisión acotada; `git diff --check` PASS; hashes y archivos protegidos verificados |

Comandos de infraestructura/test reutilizados (desde backend/):

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
# Aislado: mismo prefijo + tests/test_phase5b_notifications_browser.py
```

Desde frontend-next/: `BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test`, `npm run lint`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/next/dist/bin/next build --webpack`, `node --check tests/e2e/phase5b-notifications-browser.mjs`. Desde frontend/: SDK `/tmp/immuno-miguel-tools/flutter/bin/flutter`, `FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache`, comandos analyze/test de tabla.

Fallos intermedios conservados: E2E inicial FAILED4,40 s, contenido detrás del header; primeras pruebas de componentes53 PASS/2 FAILED por reutilizar el mismo elemento React al simular cambio de ruta (corregido el montaje,8 nuevas PASS). E2E sucesivos PASS40,06/48,03/50,36 s antes de ajuste de capas. Primer muestreo RGB junto al borde inferior no detectaba el aro (PASS51,66 s); se sustituyó por tres puntos de padding superior que sí lo detectan. Una ejecución falló6,82 s durante stateReady de navegación, document.body aún no protegido; guard local añadido. E2E con tres muestras superior sobre build anterior FAILED9,18 s: RGB199/218/218 frente a fondo255/246/214, reproduce superposición decorativa. No se cuentan estos fallos ni los PASS previos como gate final.

### Riesgos, límites y rollback

Filas estrechas y texto sin espacios aumentan altura; el contenido se recorre verticalmente, no se promete que quepa completo en una captura. El breakpoint depende del ancho real del contenedor; container queries, ResizeObserver y fallback probados en Chrome disponible, otros navegadores UNKNOWN. Mensaje de dos líneas conservado en escritorio amplio: las mediciones no lo presentan como lectura expandida.

CSS zoom2 **no es zoom nativo**, ni Flutter TextScaler2. Dispositivos físicos, lectores y zoom nativo siguen UNKNOWN. La comparación Flutter usa referencias locales existentes y el mismo fixture ordinario; textos largos adicionales solo se prueban en Next. No igualdad pixel a pixel ni conformidad global de accesibilidad. No cerrar Fase5B, T-02/T-03 o preparación productiva.

Rollback: recuperar únicamente `notifications-list.tsx` y `app-shell.tsx` de las copias del inicio del bloque y retirar imports/uso de los dos CSS modules nuevos. Conservar pruebas/evidencia y todo cambio anterior, en particular guard de denegación/retención B5-N07. No revertir AppShell contra HEAD ni usar git reset global. No datos/infraestructura/migraciones afectados.

Los tres SKIP requieren bases desechables/variables `PHASE1_POSTGRES_URL`, `PHASE2_POSTGRES_URL` y `PHASE4_SIGNER_POSTGRES_URL`; no se cuentan como PASS de migraciones. No hay migraciones nuevas en este bloque. Warnings existentes: seis de SQLAlchemy noload y uno de Firebase MulticastMessage.tokens. Vitest avisa sobre futuro configLoader native; no se modifica configuración ni se trata como fallo actual.

**B5-N09 = PARTIAL: correcciones técnicas DONE en tamaños/estados probados y gate integrado final PASS; validación nativa UNKNOWN. FASE5B PARTIAL.** UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL. Sin commit.


## Continuación — B5-N10 estados de error y fallos de lectura de notificaciones

**Causas raíz.** El audit S10 estaba desactualizado para varios puntos ya solucionados: Next ya separa error/empty y retiene datos solo en fallos transitorios; Flutter ya tiene error y retry. La comparación de código detectó dos gaps actuales: la mutación `markNotificationRead` no declaraba `onError` en Next y el catch en Flutter dejaba escapar la excepción sin feedback visible. Además, Flutter conservaba lista/contador ante cualquier error de GET, a diferencia de Next, incluso tras 401/403/otros4xx o cancelación.

**Solución.** Flutter ahora muestra un mensaje seguro al fallar marcar como leída; conserva el comportamiento anterior de no navegar cuando falla el marcado al abrir una notificación. Next student/admin muestran el mismo mensaje mediante toast en `onError`. En el provider Flutter, GET conserva datos previos ante fallo de red sin status,429 y5xx; borra datos/contador ante cancelación o status HTTP distinto, alineándose con el guard de retención Next. No se cambian APIs, permisos, destinatarios, FCM ni sesión.

**Archivos.** `frontend/lib/features/shared/presentation/screens/notifications_screen.dart`; `frontend/lib/features/shared/presentation/providers/notification_provider.dart`; `frontend/test/core/phase5b_notification_errors_test.dart`; `frontend-next/src/app/student/notifications/page.tsx`; `frontend-next/src/app/admin/notifications/page.tsx`; `frontend-next/src/components/__tests__/phase5b-notification-refresh.test.tsx`; `docs/ui/phase5-parity-matrix.md`.

**Pruebas.** Nuevo test Flutter de 403 retenido → lista y contador vacíos; nuevo widget test de fallo de marcado → snackbar seguro, notificación sigue no leída y excepción privada no visible. Suite focal Flutter **13 PASS**; Next student/admin en `phase5b-notification-refresh.test.tsx`: **36 PASS**. Flutter suite completa final **409 PASS**, analyze **PASS**, Dart format check **0 cambios**. Next suite completa **530 PASS / 3 SKIP**; lint, typecheck y webpack build **PASS**. Los tres skips existentes corresponden a gates que requieren bases de migración separadas; no se presentan como PASS.

**Diferencia inicial y causa raíz.** Al abrir una notificación no leída, Flutter esperaba la confirmación de marcado y permanecía en la lista ante un fallo; Next disparaba una mutación de tipo `void` sin esperar el resultado y navegaba inmediatamente. El audit asumía una posible decisión institucional, pero el criterio funcional ya estaba establecido: Flutter es la referencia de comportamiento para paridad de Fase5A/5B.

**Continuación — secuencia de abrir notificación.** `NotificationsList` acepta ahora un callback que devuelve el resultado de marcado. Las páginas student/admin llaman `mutateAsync`, conservan el toast seguro ya existente y devuelven éxito/fallo; la tarjeta navega solo tras éxito y se queda en la lista tras fallo. El botón hermano “Marcar como leída” mantiene su acción independiente y nunca dispara navegación.

**Pruebas de esta continuación.** `phase5b-notifications.test.tsx`: éxito demorado no navega hasta confirmar y fallo no navega; `phase5b-notification-refresh.test.tsx`: ambas páginas, student/admin, prueban rechazo del API, toast seguro y ausencia de navegación. Suite focal: **47 PASS**. Suite Next completa: **534 PASS, 3 SKIP** (tres gates PostgreSQL sin URL configurada); lint, `node node_modules/typescript/bin/tsc --noEmit` y build de producción `next build --webpack`: **PASS**. No se modificó backend/API/permisos/Flutter; no requiere E2E de API porque el cambio coordina la promesa existente y se prueba la página/cliente.

**Estado/límites.** Diferencia de navegación corregida en Next con mocks de API para ambos roles. Confirmación real de entrega al backend está cubierta por el contrato existente, no se repitió aquí contra PostgreSQL. Lector/dispositivo físico sigue UNKNOWN; S10/R04/Fase5B permanecen PARTIAL por cobertura integral restante. `git diff --check` y revisión de whitespace final: **PASS**; no commit.

**Riesgo/rollback.** Los códigos no-Dio sin status siguen tratados como transitorios para no ocultar contenido ante errores de red no tipados; las excepciones de cancelación se descartan. Revertir solo las funciones de feedback y `_canRetainNotifications` en provider/pantalla, los `onError` de las dos páginas Next y sus tests nuevos; conservar el resto de historial del árbol y tests de retención. Sin migraciones. `git diff --check` pendiente de revisión final. Sin commit.

Evidencia final de reflow: [36 capturas y hashes](../ui/evidence/phase5b/notification-reflow/capture-index.json), [mediciones](../ui/evidence/phase5b/notification-reflow/measurements.json). Índices recalculados después del gate integrado final; se verifican también referencias Flutter intactas.36 escenarios,12 checks de pintura (36 muestras RGB), acciones separadas por Tab y mínima separación medida de la fila al header36 px. La muestra de RGB es control local del badge, no análisis integral de contraste. Inspección visual de oscuro ampliado, texto largo claro320 y escritorio oscuro: alert completo y contador sin pintura decorativa superpuesta; filas translúcidas todavía muestran decoración de fondo, detrás del contenido.

Revisión final del bloque: cuatro archivos de presentación (dos TSX modificados y dos CSS modules nuevos), un archivo de8 tests nuevo y un runner ampliado; tres documentos actualizados.38 artefactos nuevos (36 PNG/mediciones/índice),105 PNG existentes regenerados por los cinco runners y hashes de los índices de notificaciones actualizados. SHA-256 incremental frente al inicio: cero archivos eliminados, sin cambios de backend, Flutter/capturas/goldens, lib/API/auth/BFF, manifests/lockfiles/dependencias ni migraciones. Función open, callback de marcado y consulta shell exactamente iguales a copia inicial. `git diff` revisado, archivos nuevos incluidos en revisión incremental, `git diff --check` PASS. Links, hashes, nueva línea y whitespace PASS; escaneo limitado de patrones de secretos de alta confianza cero hallazgos, no auditoría integral. Sin commit.


## Continuación — dashboard estudiante, B5-D01 a B5-D04

Alcance acotado al dashboard estudiantil y sus pruebas pareadas. Se leyeron AGENTS.md y las skills locales ui-parity, quality-gates y security-health; se inspeccionaron StudentDashboardScreen, SchemeState/notifier, la página Next, QueryError, AppShell y tests existentes. Flutter conserva su papel de referencia; **todos los contadores y señales de estado proceden de FastAPI**, sin inferir certificabilidad, completitud ni al día. No cambios funcionales backend, API, auth/BFF, proveedores/cache, reglas clínicas, PDF/QR, UI-16/UI-17, Maps, Azure ni migraciones. No nuevas dependencias.

### Causas, solución y estado

| ID / prioridad | Causa raíz, función/archivo | Solución / evidencia | Estado |
|---|---|---|---|
| B5-D01 / P1 | StudentDashboard, frontend-next/src/app/student/page.tsx: `is_up_to_date ?? false` representaba Requiere atención antes de recibir respuesta. El retorno anticipado por error eliminaba bienvenida y navegación. | Badge solo con data exitosa, error dentro de estadísticas y accesos siempre disponibles. Ante cualquier error de refresh se ocultan contadores y badge anteriores; no nueva retención clínica. Tests iniciales fallaban antes de cambiar la página. | DONE en componentes, E2E específico y suite integrada final. |
| B5-D02 / P2 | Misma página: Denegadas solo aparecía si >0 y faltaba refresh explícito presente en Flutter. | Cinco contadores backend, incluido cero; región nombrada/aria-busy y botón Actualizar estadísticas disabled durante GET, refetch cancelRefetch:false. Doble invocación comparte un GET; éxito actualiza señal y contadores. No recalcular sobre vacunas, no mutaciones clínicas. | DONE en componentes y Chrome específico. |
| B5-D03 / P2 | Flutter StudentDashboardScreen: _QA pintaba textos con colores de acento de bajo contraste; _StudentStatCard truncaba título a una línea; IconButton de notificaciones no tenía tooltip. | Texto de accesos con colorScheme.onSurface; conservar acentos de iconos/bordes. Etiquetas estadísticas multilínea; nombre Notificaciones para el mismo botón/ruta. Antes: contraste mínimo2,12 claro y truncamiento Aprobadas en texto2×; después:17,06 claro/12,98 oscuro. | DONE en25 pruebas nuevas,122 PASS sin actualización de goldens; dispositivos/lectores UNKNOWN. |
| B5-D04 / P2 | Hero, título+badge+refresh y tarjetas Next comparten filas con elementos fijos; con CSS zoom2× el espacio resulta insuficiente. Fondo decorativo del shell también requiere aislar las superficies de esta ruta. | CSS module exclusivo del dashboard: container query22rem, reflow de hero/título/accesos y texto largo, capa local de contenido. No modificar brand/AppShell/globals ni rutas vecinas. Range checks en Chrome: títulos/labels dentro de cajas y scrollWidth=viewport. | DONE en24 escenarios controlados; zoom nativo y validación física UNKNOWN. |

### Archivos y pruebas nuevas

Presentación: frontend-next/src/app/student/page.tsx; nuevo frontend-next/src/app/student/student-dashboard.module.css; frontend/lib/features/student/presentation/screens/student_dashboard_screen.dart. Sin cambio de callbacks/rutas Flutter; la consulta Next conserva endpoint, key y DTO originales.

Pruebas: frontend-next/src/components/__tests__/phase5b-student-dashboard.test.tsx (12 casos: loading sin señal inventada, cinco contadores, ceros, flags independientes,403/404/500/503, refresh/doble solicitud, datos ocultos tras403 y retry); frontend/test/core/theme/phase5b_student_dashboard_reference_test.dart (25 casos:20 capturas pareadas de estados/temas/TextScaler, refresh/retry, navegación, tooltip y dos checks de etiquetas ampliadas); backend/tests/test_phase5b_student_dashboard_browser.py y frontend-next/tests/e2e/phase5b-student-dashboard-browser.mjs (un E2E con harness existente, FastAPI/Next/Chrome/PostgreSQL reales y respuestas GET controladas para estados visuales).

Fixture compartido: docs/ui/fixtures/phase5b-student-dashboard.json. **Agregados sintéticos de presentación, no dataset clínico reconciliado**: vacunas vacías permiten probar que el cliente no recuenta ni infiere flags. No datos institucionales. El E2E primero compara los cinco contadores contra respuesta real y comprueba403 administrativo real; luego controla datos/cero/loading/503/403/401 para reproducibilidad. Controlar401 ejercita la redirección de auth existente, no demuestra una nueva expiración criptográfica. La prueba de ausencia de mutación inspecciona solicitudes al endpoint de esquema; no se presenta como auditoría universal de red.

Fuentes Inter locales y MaterialIcons/logo reales existentes, sin fetch de fuentes ni assets nuevos.40 PNG antes,40 nuevos goldens Flutter y48 PNG Next. Flutter20 escenarios (390×844, claro/oscuro, TextScaler1/2, datos/cero/loading/error/offline), Next24 (390 CSS zoom1/2 y1280 zoom1, claro/oscuro manual opuesto al SO, datos/cero/loading/error). El test normal verifica referencias sin --update-goldens; esa opción se usó una vez únicamente para crear las referencias nuevas del dashboard. No actualizar goldens de otras pantallas. CSS zoom no equivale a TextScaler ni a zoom nativo. Offline Flutter conserva el aviso existente, sin implementar cache/offline web.

### Ejecución y límites

Entorno existente: Python3.12.15, PostgreSQL18 local sintético, Node22.22.1, Next16.3.6, Vitest4.1.11, Flutter3.41.6/Dart3.11.4 y Chrome headless. No instalar/actualizar paquetes.

| Gate / directorio | Comando | Resultado |
|---|---|---|
| Next completo/BFF PostgreSQL, frontend-next | BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test |226 PASS,33 archivos,8,35 s. |
| Next lint | npm run lint |PASS. |
| Next typecheck | node node_modules/typescript/bin/tsc --noEmit |PASS. |
| Flutter completo, frontend | FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache /tmp/immuno-miguel-tools/flutter/bin/flutter test --no-pub --reporter expanded |122 PASS,11 s; sin actualizar goldens. |
| Flutter analyze | mismo entorno + flutter analyze --no-pub |PASS después de añadir llaves a dos if del nuevo test. |
| Flutter format | dart format --output=none --set-exit-if-changed lib/features/student/presentation/screens/student_dashboard_screen.dart test/core/theme/phase5b_student_dashboard_reference_test.dart |PASS,0 cambios. |
| Ruff nuevo wrapper, backend | .venv/bin/ruff check tests/test_phase5b_student_dashboard_browser.py |PASS. |
| E2E específico, backend | PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a .venv/bin/python -m pytest -q -rs --tb=short --show-capture=no tests/test_phase5b_student_dashboard_browser.py |1 PASS final,22,64 s, después del build final y corrección del encuadre; previo1 PASS,17,22 s. |
| Backend/PostgreSQL/E2E completo | mismo entorno + .venv/bin/python -m pytest -q -rs --tb=short --show-capture=no |391 PASS,3 SKIP,7 warnings,187,78 s; seis E2E incluidos. |
| Build webpack final | node node_modules/next/dist/bin/next build --webpack |PASS,compilación3,0 s,TypeScript y26 páginas. |

Evidencia inicial FAILED conservada: Next9 FAILED/3 PASS antes del ajuste; Flutter2 PASS/23 FAILED antes del ajuste (20 contraste, tooltip,2 truncamiento). El primer E2E falló por legibilidad ampliada y pasó después del CSS local. Los fallos previos de harness (scroll de ListView lazy/cast de botón y localización del aviso offline después de salir del viewport) se corrigieron en los tests, no en el provider. Primer analyze señaló dos if sin llaves y format detectó nuevo test sin formato; ambos corregidos. Restricción de sockets del sandbox requirió ejecución autorizada externa; no se presenta como fallo clínico. No ocultar estos intentos como PASS.

### Riesgos, rollback y pendientes

La paridad es de datos/acciones/estados, no de composición exacta: Flutter conserva tarjetas centradas y shell nativo, Next usa enlaces con descripción y shell web. Flutter texto2× puede envolver títulos/palabras a varias líneas; no se rediseña su hero. No verificación integral de contraste de hero/avisos offline/error/iconos ni conformidad WCAG global. Navegación profunda de todos los accesos/teclado virtual/lector físico/otros navegadores/zoom nativo **UNKNOWN**; pruebas de navegación existentes siguen siendo gates de regresión. Dashboard administrativo y otras pantallas del bloque5 siguen pendientes. UI-16/UI-17 BLOCKED por alcance. T-02/T-03 y Fase3B PARTIAL; almacenamiento real pendiente; no producción lista.

Riesgo CSS: selectores locales dependen de estructura actual de UccHeroPanel/CardHeader/BrandSectionTitle; tests de geometría previenen regresión en tamaños ensayados. Historial/cache/auth no se modifican; los accesos no otorgan permisos, los endpoints siguen imponiendo FastAPI/BFF. No se añaden URLs/logs con PII/PHI, tokens ni analytics. Solo identidad sintética de pruebas en capturas.

Rollback: restaurar únicamente ambas páginas funcionales frente a /tmp/immuno-miguel-tools/phase5b-student-dashboard/backup y retirar import/uso del CSS module nuevo conjuntamente; conservar evidencia y tests preventivos para revisar si se revierte. No revertir fases anteriores ni usar git reset global. Sin rollback de datos/infraestructura/migraciones. **FASE5B PARTIAL**, sin commit.


### Verificación final de esta continuación

**B5-D01/D02/D03/D04 = DONE para las correcciones técnicas y escenarios probados. Dashboard integral = PARTIAL; FASE5B = PARTIAL.** Gates finales: backend/PostgreSQL391 PASS/3 SKIP, Next226 PASS/lint/typecheck/webpack PASS, Flutter122 PASS/analyze/format PASS;25 tests Flutter específicos vuelven a pasar tras corregir el formato, sin actualizar goldens. E2E final aislado1 PASS/22,64 s después de build y ajuste del runner. La suite integrada usa el runner anterior al ajuste exclusivo de encuadre; ninguna lógica funcional cambia posteriormente, y el runner final se verifica aisladamente.

Las tres pruebas omitidas son test_certificate_signer_migration (PHASE4_SIGNER_POSTGRES_URL), test_phase1_migration (PHASE1_POSTGRES_URL) y test_phase2_migration (PHASE2_POSTGRES_URL): requieren otras bases aisladas y vacías; **SKIP, no PASS**, no nuevas migraciones en este bloque. Concurrencia/permisos de la suite que usa PHASE1_INTEGRATION_URL sí se ejecutan. Warnings existentes SQLAlchemy noload y FCM MulticastMessage.tokens; no se corrigen fuera de alcance.

La revisión visual detectó que el scroll centrado de la primera captura dejaba parte de una tarjeta bajo el header. Se ajustó únicamente el runner para alinear títulos con la altura real del header y esperar fuentes antes de medir; sin modificar sticky header/AppShell ni comportamiento de la pantalla.24 checks de títulos de estadísticas y24 de acciones, separación mínima15,5 px. Se inspeccionaron capturas finales de estadísticas oscuras ampliadas, error claro y accesos claros, además de Flutter oscuro ampliado/accesos claros. El wrapping de títulos Flutter es visible y se conserva, sin prometer composición idéntica ni accesibilidad integral.

[128 PNG y SHA-256](../ui/evidence/phase5b/student-dashboard/capture-index.json), [mediciones Flutter](../ui/evidence/phase5b/student-dashboard/after-flutter-measurements.json), [mediciones Next](../ui/evidence/phase5b/student-dashboard/next-measurements.json). Índices de comparación/refresh/reflow de notificaciones recalculados tras la regeneración de capturas por la suite completa; referencias/goldens Flutter anteriores intactos.40 PNG before son diagnóstico y **no** baseline aprobado.

Revisión incremental SHA-256 frente a816 archivos al inicio: dos archivos funcionales existentes modificados y un CSS module nuevo; cuatro archivos nuevos de pruebas/runner, un fixture agregado; tres documentos actualizados;132 artifacts nuevos (128 PNG/4 JSON),48 PNG previos regenerados y tres índices actualizados. Cero archivos borrados. No cambios backend funcional, migraciones, clientes API, modelos/providers/cache, auth/BFF, dependencias/manifests/lockfiles o temas/componentes compartidos. Los siete enlaces rápidos Next y callbacks/rutas Flutter permanecen iguales. `git diff` y diff incremental revisados; `git diff --check` PASS. Revisión de whitespace/links/hashes y patrones de secretos de alta confianza: cero hallazgos; no auditoría universal de secretos. Sin commit.


## Continuación — dashboard administrativo, B5-A01 a B5-A05

Alcance: dashboards admin y app_admin, lectura/error/reintento, controles existentes, responsive y comparación por estados. Se leyeron AGENTS.md, skills ui-parity/quality-gates/security-health y las matrices/auditorías de Fase5. Se inspeccionaron AdminDashboardScreen/RegularAdminDashboard/AppAdminDashboard, modelos de estadísticas, providers, endpoint de estadísticas y tests afectados. **FastAPI continúa siendo autoridad de negocio, ámbito y permisos**. Sin cambios backend funcional, contratos, autenticación, reglas clínicas, providers/cache, migraciones, PDF/QR, UI-16/UI-17, Maps, Azure o stores. Sin dependencias nuevas ni commit.

### Hallazgos, causas y soluciones

| ID / prioridad | Archivo / función y causa raíz | Solución y pruebas | Estado |
|---|---|---|---|
| B5-A01 / P1 | frontend-next/src/app/admin/page.tsx, RegularAdminDashboard: guard de error solo en estadísticas, mientras `data &&` mantenía SchemeBreakdown después de fallar refresh. El QueryClient conserva data anterior, incluso tras403. | Exigir !isError también para gráfico. Todas las estadísticas/agrupaciones antiguas desaparecen al fallar lectura; navegación existente se conserva. Prueba inicial de403 con datos falla antes del cambio y pasa después; E2E comprueba vacunas, Completo y campus ausentes tras403 en ambos roles. | DONE en componentes y gate integrado final. |
| B5-A02 / P2 | Misma página, ambos roles: faltaba refresh explícito presente en Flutter; link Totales omitía semestre mientras otras cuatro tarjetas lo incluían. | Botón Actualizar estadísticas disabled durante GET, cancelRefetch:false, región nombrada/aria-busy y retry bloqueado durante solicitud. Link Totales conserva semestre. Nombre accesible Exportar reporte CSV para función sin cambios. Tests: petición retrasada/doble click, nuevos datos, cinco enlaces con filtros y permisos de UI por rol. | DONE en19 tests nuevos/Chrome específico. Persistencia del semestre resuelta en continuación B5-A06, documentada abajo. |
| B5-A03 / P2 | frontend/lib/features/admin/presentation/screens/admin_dashboard_screen.dart: ambos errores de stats interpolaban $err y no ofrecían retry; exportación interpolaba $e. Notificaciones sin tooltip. | _StatisticsError con mensaje seguro, Card/Semantics liveRegion y Reintentar mediante invalidación del provider existente; disabled mientras carga. Exportación falla con mensaje genérico, sin excepción; mismo callback/provider. Tooltip Notificaciones. Pruebas por rol/tema/escala, recuperación, solicitud pendiente, export fallida y destino existente. | DONE en38 tests nuevos y suite Flutter160 PASS. |
| B5-A04 / P2 | Hero/admin ranking/acciones y grids implícitos en Next no permitían encoger el contenido ampliado. Chrome390 CSS zoom2 autoampliaba viewport a536; tras reflow inicial persistían445 por mínimo de tarjeta/grid, confirmado por geometría. Decoración pintaba encima de nav. | admin-dashboard.module.css: container query22rem, hero/acciones/reflow, grid minmax(0,1fr), min-width0, encabezado ranking adaptable. AppShell crea capa relativa z0 también **solo en /admin**, manteniendo otras rutas y el observador de notificaciones intactos. Sin overflow:hidden sobre texto para ocultar el fallo. | DONE E2E específico48 escenarios; zoom nativo/otros navegadores/dispositivos UNKNOWN. |
| B5-A05 / P2 | VaccineComplianceRanking: Ver mas/menos cambiaba estado sin aria-expanded/controls. | useId + aria-controls y aria-expanded para la misma lista y acción; conservar límites, orden y cálculos. Componentes verifican3/4 filas iniciales según cliente web/rol,5 al expandir y colapso; Enter real en Chrome. | DONE en lo probado; lectores físicos UNKNOWN. |

### Archivos y contratos preservados

Funcionales: frontend-next/src/app/admin/page.tsx; nuevo frontend-next/src/app/admin/admin-dashboard.module.css; frontend-next/src/components/app-shell.tsx (solo condición de capa del dashboard, sin cambio de consultas/acciones/observer); frontend/lib/features/admin/presentation/screens/admin_dashboard_screen.dart.

Nuevos tests: frontend-next/src/components/__tests__/phase5b-admin-dashboard.test.tsx (19), frontend/test/core/theme/phase5b_admin_dashboard_reference_test.dart (38), backend/tests/test_phase5b_admin_dashboard_browser.py y frontend-next/tests/e2e/phase5b-admin-dashboard-browser.mjs (un E2E opt-in reutilizando harness existente). Fixture común: docs/ui/fixtures/phase5b-admin-dashboard.json, **agregados sintéticos de presentación; no dataset institucional ni validación de T-02/T-03**.

Se conservan GET /admin/statistics y su parámetro semester, keys de consulta, descarga CSV/callback/progreso, destinos y capacidades de cada rol, refresco Flutter/notification timer, modelos/providers/auth/BFF y todos los cálculos de gráficos. Los porcentajes representan contadores backend, no nueva determinación clínica individual. No copiar estados/al día/completitud/certificabilidad de Flutter. No añadir capacidad administrativa para estudiante:403 de estadísticas real y403/200 de administración de cuentas según rol real en E2E.

### Estados y evidencia

Flutter:32 escenarios (admin/app_admin × claro/oscuro × TextScaler1/2 × datos/cero/loading/error),64 capturas diagnósticas anteriores y64 nuevas referencias. Las referencias se inicializaron únicamente para este archivo; suite normal sin --update-goldens pasa. Inter local, MaterialIcons y logo reales existentes, sin red para fuentes. Pruebas adicionales:2 retry éxito,2 retry pendiente, error exportación y tooltip/destino. Datos/error controlados a nivel provider; no E2E móvil físico ni transporte real. Ambos roles mantienen sus acciones incluso con error. Appbar Flutter puede truncar su título y ranking nombres largos sigue con ellipsis: no se declara legibilidad integral de esos textos.

Next:48 escenarios (admin/app_admin × claro/oscuro manual opuesto al SO × datos/cero/loading/503 ×390 CSS zoom1/2 y1280 zoom1),96 PNG finales. El runner primero usa FastAPI/Next/Chrome/PostgreSQL reales para verificar cinco contadores de admin y permisos; luego intercepta exclusivamente GET de estadísticas para estados reproducibles. Petición retenida/doble refresh comparten un GET, cambia UI al éxito,403 oculta datos/gráficos anteriores y retry recupera, Enter expande ranking y401 controlado usa auth existente.401 sintético no demuestra una nueva expiración criptográfica. No mutaciones al endpoint de estadísticas. Header real medido para encuadrar capturas, separación mínima15,5 px. CSS zoom no equivale a TextScaler ni a zoom nativo.

Diagnóstico Next conservado: before-next-diagnostic-admin-light-390-csszoom2.png y diagnostic-layout.json reflejan intento intermedio445, **no PASS ni baseline aprobada**. El primer536 queda registrado en fallo real del E2E. Las64 capturas before Flutter incluyen errores sintéticos sin filtrar para demostrar el fallo; no datos institucionales ni secretos reales.

### Gates y resultados

Entorno existente: Python3.12.15, PostgreSQL18 sintético local, Node22.22.1, Next16.3.6, Vitest4.1.11, Flutter3.41.6/Dart3.11.4 y Chrome headless. No instalar/actualizar herramientas o paquetes. Tests con sockets reales ejecutados mediante autorización fuera del sandbox.

| Gate / directorio | Comando | Resultado |
|---|---|---|
| Next completo/BFF, frontend-next | BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test |245 PASS,34 archivos,9,01 s. |
| Next lint | npm run lint |PASS. |
| Next typecheck | node node_modules/typescript/bin/tsc --noEmit |PASS. |
| Build producción webpack | node node_modules/next/dist/bin/next build --webpack |PASS final,compilación2,7 s,TypeScript/26 páginas. |
| Flutter completo, frontend | FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache /tmp/immuno-miguel-tools/flutter/bin/flutter test --no-pub --reporter expanded |160 PASS,14 s; sin actualizar goldens. |
| Flutter analyze | mismo entorno + flutter analyze --no-pub |PASS,3,4 s; primer intento señaló2 if sin llaves, corregidos. |
| Formato Flutter | dart format --output=none --set-exit-if-changed lib/features/admin/presentation/screens/admin_dashboard_screen.dart test/core/theme/phase5b_admin_dashboard_reference_test.dart |PASS,0 cambios. |
| Ruff nuevo wrapper, backend | .venv/bin/ruff check tests/test_phase5b_admin_dashboard_browser.py |PASS. |
| E2E específico, backend | PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a .venv/bin/python -m pytest -q -rs --tb=short --show-capture=no tests/test_phase5b_admin_dashboard_browser.py |1 PASS,41,15 s. |
| Backend/PostgreSQL/E2E completo | mismo entorno + .venv/bin/python -m pytest -q -rs --tb=short --show-capture=no |392 PASS,3 SKIP,7 warnings,227,89 s; siete E2E incluidos. |

Fallos iniciales: Next10 FAILED/7 PASS antes de corregir; Flutter24 PASS/11 FAILED después de corregir capitalización del selector del test (8 exposición de error,2 retry ausente,tooltip); primer harness Flutter había usado Crear estudiante en vez de Crear Estudiante y se corrigió sin cambiar producto. La primera inicialización de goldens obtuvo34 PASS/1 FAILED porque el test esperaba que push cambiara routeInformationProvider; se comprueba pantalla de destino real, manteniendo callback. Override export tenía Future<void> en vez del Future<Null> inferido por provider; se corrigió solo el mock. Tests de shell requirieron mock de useRouter del UserMenu, no modificarlo. E2E FAILED con536,445 y445; se midió geometría, ajustó minmax del grid y luego PASS. No relajar checks de ancho solicitado, labels visibles, permisos, datos ocultos ni GET único. Inicial intento de crear test Next usó ruta relativa con cwd incorrecto: no se creó archivo ni ejecutó tests en ese intento; corregido al trabajar desde raíz.

### Riesgos, rollback y pendientes

**B5-A06 / P2 — PARTIAL en este bloque histórico; DONE en la continuación de contexto abajo:** semestre de Next sigue en useState y se reinicia al recargar/desmontar dashboard; no URL propia/deep link persistente. Flutter mantiene filtro mientras vive el State al volver de lista. Se corrigió el enlace Totales, no toda esta persistencia. Próximo bloque: contrato de contexto de dashboard y regresiones back/reload/deep-link usando helpers existentes sin PII. No atribuir esta persistencia como DONE al pasar pruebas de enlaces.

**B5-A07 / P2 = UNKNOWN en política de opciones:** UI Flutter ofrece1–10, Next1–12 y FastAPI valida1–20. Valores y validación son hechos comprobados; falta confirmar si las opciones de pantalla deben enumerar todo el rango API o un catálogo institucional. No homogeneizar a ciegas ni modificar reglas clínicas. Ranking global Flutter inicialmente3 filas frente a4 en Next; Flutter filtra total0, Next lo incluye; empate ordenado distinto. Se conservan estas diferencias y no se presenta paridad exacta de ranking. Significado/rotulación clínica de aprobado/Esquema100%/Completo no se decide en esta continuación.

**UNKNOWN:** contraste integral de gráficos/iconos/pie/hero, lector de pantalla, zoom nativo, dispositivos y teclado virtual, archivos CSV en dispositivo físico, respuesta tardía después de cambio de cuenta en estadísticas Flutter (provider existente sin cambios; no cobertura nueva de sesiones). No se declara conformidad WCAG global ni se invoca Azure/Maps/PDF/QR para cumplir gates fuera de alcance. Datos controlados prueban representación, no aprobación institucional ni T-02/T-03.

CSS depende de estructura actual de UccHeroPanel/ActionCard/SectionHeader y grids de esta página; tests de Chrome previenen desbordamiento en tamaños ensayados. La capa de AppShell afecta /admin según pathname, independiente de query; otras rutas conservan condición previa. Flutter reintento invalida el provider existente, no modifica auth/cache/rate limit; no ampliación de permisos. Error genérico pierde detalle técnico en UI intencionalmente, sin log nuevo.

Rollback: restaurar solo admin/page.tsx y admin_dashboard_screen.dart frente a /tmp/immuno-miguel-tools/phase5b-admin-dashboard/backup; retirar import/uso del CSS module conjuntamente. En AppShell, retirar únicamente pathname==='/admin' de condición de capa y conservar corrección previa de notificaciones. Mantener pruebas/evidencia preventivas para revisión. Sin rollback de datos/infraestructura ni git reset global. **FASE5B PARTIAL**, UI-16/UI-17 BLOCKED por alcance; T-02/T-03/Fase3B PARTIAL y almacenamiento real pendiente. No producción lista; sin commit.


### Verificación final del bloque administrativo

**B5-A01/A02/A03/A04/A05 = DONE para las correcciones técnicas y escenarios probados. Dashboard integral = PARTIAL; B5-A06 quedó PARTIAL en este cierre histórico y se resuelve abajo, B5-A07 UNKNOWN. FASE5B = PARTIAL.** Backend/PostgreSQL final392 PASS/3 SKIP/227,89 s, incluidos siete E2E; Next245 PASS/lint/typecheck/webpack PASS; Flutter160 PASS/analyze/format PASS. Después del gate Flutter se añadieron mediciones de contraste a las mismas8 muestras de error:38 tests específicos PASS sin actualizar goldens y analyze final PASS,1,8 s. Contraste del nuevo botón Reintentar17,06 claro/12,98 oscuro contra Card Theme real; no medir ni certificar WCAG para el resto de gráficos.

Las tres omisiones requieren otras bases aisladas: test_certificate_signer_migration/PHASE4_SIGNER_POSTGRES_URL; test_phase1_migration/PHASE1_POSTGRES_URL; test_phase2_migration/PHASE2_POSTGRES_URL. **SKIP, no PASS**; no nueva migración. Concurrencia/permisos cubiertos por tests sobre PHASE1_INTEGRATION_URL sí ejecutados. Warnings existentes SQLAlchemy noload/FCM MulticastMessage.tokens, sin cambios fuera de alcance.

Evidencia: [225 PNG y hashes](../ui/evidence/phase5b/admin-dashboard/capture-index.json):64 Flutter antes+64 Flutter después+96 Next finales+1 diagnóstico Next intermedio. [48 mediciones Next](../ui/evidence/phase5b/admin-dashboard/next-measurements.json), [8 mediciones del reintento Flutter](../ui/evidence/phase5b/admin-dashboard/flutter-measurements.json). En48 escenarios: viewport solicitado intacto, scrollWidth≤viewport,0 labels/títulos con recorte, separación mínima de título/control capturado al header15,5 px. No afirmar que ello valida nombres largos con ellipsis ni lectores nativos. Se inspeccionaron PNG de admin oscuro CSS zoom2 y app_admin error oscuro, además del diagnóstico previo. Las referencias before son diagnóstico, no baseline aprobada.

Revisión incremental SHA-256 frente a954 archivos iniciales: tres archivos funcionales existentes modificados y un CSS module nuevo; cuatro archivos nuevos de pruebas/runner y un fixture agregado; tres documentos actualizados;229 artifacts nuevos (225 PNG/4 JSON),45 PNG anteriores regenerados por suite E2E y cuatro índices anteriores recalculados. Cero archivos eliminados. Backend funcional/migraciones/API/auth/BFF, modelos/providers/cache, dependencias/manifests/lockfiles y goldens Flutter anteriores intactos. Comparación de código prueba _StatGrid/_ChartsSection y todo el resto de gráficos Flutter, función CSV Next y cálculo/orden/límites del ranking Next exactamente iguales a copia inicial. Solo presentación/lectura segura, sin decisión clínica nueva.

`git diff` y diff incremental revisados, incluyendo archivos nuevos; `git diff --check` PASS. Whitespace/links/hashes verificados. Escaneo limitado de patrones de secretos de alta confianza:0 hallazgos; credencial de E2E exclusivamente sintética, ya definida por fixture local; no usar cuentas institucionales ni registrar tokens/cookies. Sin commit ni producción lista. Pendientes siguientes: contexto de semestre del dashboard, decisiones de opciones/rotulación, otras pantallas y validación nativa.


## Continuación — B5-A06 contexto de semestre del dashboard

Fecha:2026-10-13, America/Bogota. **B5-A06 DONE en opciones actuales; FASE5B PARTIAL.** Se leyeron AGENTS.md y las skills locales ui-parity, quality-gates y security-health; se inspeccionaron dashboards, helpers de navegación/lista, contratos de estadísticas, AuthGate y pruebas. Referencia Flutter: AdminDashboardScreen._semesterFilter/_openStudents conserva el State al hacer push/pop y vuelve a consultar el mismo filtro. FastAPI mantiene dominio y autorización.

### Hallazgo / causa / solución

**B5-A06 / P2:** frontend-next/src/app/admin/page.tsx, RegularAdminDashboard guardaba semestre únicamente en useState vacío. Al desmontar o recargar perdía selección; abrir /admin?semester=3 consultaba Todos. Sin observar search params, back/forward tampoco actualizaba consulta/links/export. Esto era una pérdida de contexto de plataforma, no una regla clínica.

La selección se deriva ahora de useSearchParams; router.push escribe /admin?semester=N o /admin para Todos, sin desplazar el scroll. Suspense se limita a RegularAdminDashboard para permitir build estático con search params. Keys de React Query, endpoint/payload/CSV, callbacks de refresh, roles/permisos y cálculos de gráficos permanecen iguales. URL es fuente del filtro; no almacenamiento persistente adicional ni sincronización por efectos que pudiera escribir encima de back/forward.

Nuevo helper frontend-next/src/lib/ui/admin-dashboard-location.ts: opciones existentes1–12 extraídas a una constante inmutable, usada por selector/parser/generador; ninguna opción añadida/eliminada. Un valor único exacto del selector es aceptado. Ausencia, duplicados, formatos no canónicos y opciones no ofrecidas actualmente se representan como Todos; no se reenvían como parámetros API. No canonicalizar la URL al entrar automáticamente; al cambiar selección se escribe únicamente semester, sin copiar search/returnTo/campus/documento ni parámetros arbitrarios. Generador produce solo ruta local fija /admin y números permitidos, sin redirects externos. El backend continúa admitiendo1–20; el helper **no define política académica/institucional ni altera esa validación**. B5-A07 sigue UNKNOWN: Flutter10/Next12/API20, pendiente de decisión para homogeneizar opciones. Deep links fuera de opciones Next no adquieren soporte silencioso en esta corrección.

### Archivos y pruebas

Funcionales: frontend-next/src/app/admin/page.tsx y nuevo frontend-next/src/lib/ui/admin-dashboard-location.ts. No CSS/visual, backend funcional, migraciones, Flutter funcional, API/auth/BFF, modelos/providers/cache, Google Maps, Azure, PDF/QR o stores. No commit.

Pruebas nuevas:

- frontend-next/src/components/__tests__/phase5b-dashboard-context.test.tsx:12 casos con QueryClient real y location observable de test. Deep link sin petición inicial de Todos, remount/recarga, navegación de historial, cinco links, cambio de opción/Todos, URL mínima, CSV con semestre restaurado, global app_admin sin filtro, cuatro entradas no soportadas/duplicadas, respuesta y403 retrasados de query anterior sin sobreescribir la selección actual.
- frontend-next/src/lib/__tests__/phase5b-dashboard-location.test.ts:29 casos,12 opciones round-trip,14 entradas no soportadas, duplicados, URL fija sin parámetros arbitrarios y constante inmutable. Esto prueba contrato de navegación actual, no una nueva política clínica/academia.
- frontend/test/core/theme/phase5b_admin_dashboard_reference_test.dart:1 test nuevo con pantalla real que selecciona Semestre3, abre cada una de las5 estadísticas, comprueba parámetros del destino y vuelve conservando filtro/consulta; sin actualizar referencias visuales. Las38 pruebas anteriores quedan intactas en sus criterios/goldens.
- backend/tests/test_phase5b_dashboard_context_browser.py + frontend-next/tests/e2e/phase5b-dashboard-context-browser.mjs:1 E2E con harness existente, FastAPI/Next production webpack/Chrome/PostgreSQL real, cuentas/datos sintéticos. Enlace3, recarga, listado/regreso, cambio1/3/back/forward, Todos, respuesta de semestre1 retenida, app_admin global y estudiante rechazado con403 real. GET de consulta anterior se sustituye por agregado sintético777 para distinguir respuesta tardía; consulta/cinco contadores vigentes se comparan contra API real. No escribir datos clínicos ni afirmar una caída/latencia institucional. Mutaciones al endpoint de estadísticas:0.

Prueba existente frontend-next/src/components/__tests__/phase5b-admin-dashboard.test.tsx adaptada para mock observable de useSearchParams/router.push, con limpieza por test; conservar sus19 casos/expectativas. No se modifica QueryError, AuthGate, helpers de listas ni protocolo de sesiones.

### Entorno recuperado sin actualizar el proyecto

El reinicio de entorno eliminó herramientas/servidores de /tmp. backend/.venv conservaba paquetes, pero su enlace Python apuntaba a /tmp/immuno-miguel-tools/python/... inexistente; primer E2E no pudo iniciar: `.venv/bin/python: No such file or directory`. pg_isready en55544 devolvió no response. SDK/cache Flutter temporales ausentes. Python de sistema3.14.4 no se usó para sustituir la versión del proyecto.

Se restauró Python3.12.15 con uv0.13.0 temporal en /tmp y se reutilizó el venv/paquetes existentes (FastAPI0.141.1,pytest9.1.1,SQLAlchemy2.1.1,Pydantic2.13.5,asyncpg0.31.0). No pip install/upgrade, no dependencia del proyecto nueva. uv anterior registrado0.12.19; uv temporal no es dependencia funcional.

Paquete/manifiesto oficiales Flutter devolvieron HTTP404, sin cambiar versión a ciegas. Se obtuvo el tag oficial3.41.6 del repositorio flutter/flutter, commit db50e20168db8fee486b9abf32fc912de3bc5b6a, y sus componentes oficiales (engine425cfb54d0,Dart3.11.4). Checkout shallow/detached en /tmp reporta channel[user-branch]/unknown source; no se presenta como checkout de rama stable. La procedencia se verifica por remoto/tag/commit; no actualizar a otro SDK. flutter pub get --enforce-lockfile reconstruyó caché con el lockfile, sin cambiar sus hashes/versiones. Avisos de99 versiones nuevas no motivaron upgrades. Fuente de instalación/archivo: [Flutter oficial](https://docs.flutter.dev/install/archive).

PostgreSQL18: clúster nuevo y vacío en /tmp/immuno-miguel-tools/postgres, puerto55544, solo loopback/socket, trust local, localeC y timezoneAmerica/Bogota. Se crearon immuno_phase1_phase5a y tres bases separadas inicialmente vacías immuno_phase1_context_migration/immuno_phase2_context_migration/immuno_phase4_context_migration, tras inspeccionar las restricciones de los tests de migración. Solo datos sintéticos; no conexión a datos institucionales. No migraciones nuevas: se ejecutan pruebas de migraciones existentes. Los datos de estas bases se conservan para inspección; no ejecutar DROP/cleanup destructivo.

Node22.22.1/Next16.3.6/Vitest4.1.11/Chrome155.0.8059.39 existentes. No npm install ni modificación de lockfiles. Descargas/servidores/pruebas con sockets fueron autorizados fuera del sandbox cuando fue necesario.

### Ejecución

| Gate / directorio | Comando | Resultado |
|---|---|---|
| Focalizados Next, frontend-next | npm test -- src/components/__tests__/phase5b-dashboard-context.test.tsx src/lib/__tests__/phase5b-dashboard-location.test.ts src/components/__tests__/phase5b-admin-dashboard.test.tsx src/components/__tests__/phase5a-queries.test.tsx |78 PASS,4 archivos,3,81 s. |
| Next completo/BFF | BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test |286 PASS,36 archivos,9,55 s. |
| Next lint / typecheck | npm run lint; node node_modules/typescript/bin/tsc --noEmit |PASS ambos. |
| Next producción | node node_modules/next/dist/bin/next build --webpack |PASS,compilación8,8 s,TypeScript/26 páginas. |
| E2E contexto, backend | PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a .venv/bin/python -m pytest -q -rs --tb=short --show-capture=no tests/test_phase5b_dashboard_context_browser.py |1 PASS,5,78 s. |
| Flutter referencia | FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache /tmp/immuno-miguel-tools/flutter/bin/flutter test --no-pub --reporter expanded test/core/theme/phase5b_admin_dashboard_reference_test.dart |39 PASS,4 s, sin actualizar goldens. |
| Flutter completo/analyze final | mismo entorno + flutter test --no-pub --reporter expanded / flutter analyze --no-pub |161 PASS,10 s/analyze PASS,2,6 s; sin actualizar goldens. |
| Backend completo/integración/migraciones | Variables/comando reproducibles abajo |396 PASS,0 SKIP,7 warnings,237,94 s; ocho E2E,concurrencia y tres migraciones existentes ejecutadas. |
| Ruff nuevo wrapper | .venv/bin/python -m ruff check tests/test_phase5b_dashboard_context_browser.py |PASS. |

Comando backend integrado (bases locales sintéticas, desde backend/):

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_context_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_context_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_context_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

Estos tests de migración exigen DB vacías al comenzar, dejan resultados intactos y ejecutan upgrade/head repetido, sin DROP/downgrade. Para repetirlos preparar **otras DB nuevas** con sus prefijos, nunca borrar las anteriores automáticamente ni apuntar a producción.

Fallos conservados: pruebas de componente7 FAILED/5 PASS antes del cambio; E2E real previo FAILED con timeout semester3,13,76 s. Primer E2E posterior falló por acceso a main antes de que existiera en navegación entre roles,8,18 s; se añadió optional chaining al check de espera, sin relajar permisos/filtros/back/counters/race. Fallos de entorno descritos arriba no son fallos del dominio ni se cuentan como PASS. No actualizar goldens para pasar regresiones.

### Riesgos, rollback y límites

No storage adicional, datos de búsqueda, identidades o token en URL/log/artefacto. Solo semester académico de la lista ofrecida; el generador no conserva arbitrarios al cambiar selección. URL inicial inválida/no soportada sigue visible y se representa con selectorTodos; no afirmar que backend rechace13–20. Las opciones continúan UNKNOWN institucionalmente, no convertir el máximo del selector en política API. Nuevos deep links siguen requiriendo AuthGate/BFF/FastAPI existentes; estudiante no adquiere capacidades, app_admin no recibe filtro del admin normal.

Back de listado a dashboard usa historial del navegador. Enlace de shell directo /admin representa Todos como URL explícita; no nueva preferencia de usuario implícita ni promesa de filtro persistente entre logout/usuarios. Races probadas son de queries de semestre de la misma sesión, **no** nueva validación de respuestas después de cambio de identidad; protocolo de Fase2 sin cambios. CSV restaurado se comprueba en componentes, no nueva descarga móvil/nativa. Reader/zoom/dispositivos continúan UNKNOWN. Sin rediseño ni nueva captura visual: referencias existentes pasan, runner nuevo produce solo metadatos de navegación numéricos/booleanos.

Rollback: restaurar únicamente admin/page.tsx frente a /tmp/immuno-miguel-tools/phase5b-dashboard-context/backup y retirar su import/uso del helper nuevo en conjunto; conservar pruebas/evidencia preventiva. No revertir correcciones de dashboards anteriores ni git reset global. La recuperación de runtimes/clúster solo afecta /tmp; para parar el servidor de pruebas usar pg_ctl stop, conservando bases, sin borrar/migrar datos institucionales ni modificar despliegue. Proyecto/dependencias/migraciones no requieren rollback de datos. B5-A07 UNKNOWN, Fase5B PARTIAL, UI-16/UI-17 BLOCKED, T-02/T-03 PARTIAL. No producción lista ni commit.


### Resultado final y revisión incremental

**B5-A06 = DONE dentro de las opciones actuales de Next. FASE5B = PARTIAL. B5-A07 = UNKNOWN.** Next286 PASS/lint/typecheck/webpack PASS; Flutter161 PASS/analyze/format PASS; backend/PostgreSQL396 PASS,0 SKIP,237,94 s. Tres migraciones anteriormente omitidas pasan en bases sintéticas separadas inicialmente vacías; no nueva migración y no validación institucional de T-02/T-03. Ocho E2E incluidos, contexto específico1 PASS/5,78 s. Los7 warnings existentes SQLAlchemy noload/FCM MulticastMessage.tokens no se corrigen en este alcance. Runtime y caché recuperados, versiones/manifiestos/lockfiles del proyecto intactos.

[8 casos de navegación y semestres solicitados](../ui/evidence/phase5b/dashboard-context/results.json), [índice/hash](../ui/evidence/phase5b/dashboard-context/evidence-index.json). Solo booleanos/códigos/semestres, sin identidades/cookies/tokens/PII. Ninguna captura o golden nueva. Se recalcularon únicamente hashes de evidencia anterior que fue regenerada por la suite completa, manteniendo metadata de su origen. Referencias Flutter anteriores intactas.

Revisión incremental frente a1189 archivos al comienzo: una página funcional Next modificada y un helper nuevo; dos tests nuevos Next, un wrapper/runner E2E nuevos, un test Flutter añadido y adaptación del mock de19 tests Next existentes; tres documentos actualizados y dos JSON de evidencia nuevos. No se alteran UI/CSS, backend funcional, migraciones, Flutter funcional, API/auth/BFF, modelos/providers, dependencias o lockfiles. No archivos eliminados. Se revisaron git diff y diff contra copia inicial, incluidos nuevos archivos; git diff --check PASS. Links/hashes/formato/whitespace verificados, sin patrones de secretos de alta confianza en cambios de código; escaneo limitado, no auditoría universal.

El contexto de una URL persistente no amplía permisos ni es una preferencia guardada entre identidades. Las42 pruebas nuevas de clientes demuestran contrato/race/navegación sin evaluar clínica. UI-16/UI-17 siguen BLOCKED por alcance, T-02/T-03 PARTIAL y almacenamiento real pendiente. Otras pantallas, opciones/ranking/rotulación y validación nativa siguen pendientes. No commit ni producción lista.

## Continuación — B5-C01 interlocutor de comunicaciones

Fecha:2026-10-13, America/Bogota. Alcance: representación del interlocutor de una conversación autorizada en lista y detalle Next. **FASE5B PARTIAL**; no cierre visual integral de comunicaciones.

### Hallazgo y causa raíz

**B5-C01 / P2:** frontend-next/src/components/thread-row.tsx, ThreadRow elegía recipient ?? created_by ?? student sin consultar userId. Si el usuario conectado era recipient, la fila mostraba su propio nombre/initials como interlocutor. ThreadDetail imprimía student y recipient juntos; incluía al usuario conectado o repetía su identidad en conversaciones administrativas. Es un defecto de representación, no una vulnerabilidad demostrada del permiso API.

Flutter CommunicationsScreen._ThreadTile._participant y CommunicationDetailScreen._ThreadHeader._participant buscan primero un participante distinto del usuario conectado entre recipient, created_by y student. La inspección de CommunicationService.create_thread y _ensure_access demuestra que esas propiedades son relaciones autorizadas de FastAPI: student también puede referenciar al administrador normal en una conversación administrativa. No interpretar ese nombre como rol de negocio ni resolver destinatarios nuevos en el cliente.

### Solución y archivos

Nuevo frontend-next/src/lib/ui/communication-peer.ts: selector de presentación sobre los participantes ya recibidos, mismo orden y fallback legacy Flutter. ThreadRow observa userId del store y usa ese participante para nombre/initials; ThreadDetail usa el mismo selector en su encabezado. Se conserva name ?? email y el placeholder existente. No cambiar campos API, semántica de student, búsqueda/asignación de destinatarios, navegación, polling, fechas, marcado de lectura, send/status, confirmations, auth/BFF, autorización o regla clínica.

Archivos funcionales: dos componentes Next y un helper de presentación. Sin backend funcional ni Flutter funcional. Sin CSS, dependencias/lockfiles, migraciones nuevas, PDF/QR, Google Maps, Azure o stores. Documento/matriz actualizados sin declarar validación institucional de T-02/T-03.

### Pruebas nuevas y evidencia

- docs/ui/fixtures/phase5b-communications-peer.json: diez casos sintéticos compartidos. Cuatro direcciones student→admin, admin→student, admin→app_admin, app_admin→admin, vistas desde cada participante; caso sin recipient y otro sin created_by con interlocutor conocido. No datos institucionales ni credenciales reales.
- frontend-next/src/components/__tests__/phase5b-communications-peer.test.tsx: veinte casos con QueryClient real. Lista/detalle muestran el mismo otro participante, no muestran al viewer en ese encabezado, preservan ruta por rol y no invocan addMessage/updateThreadStatus al representar. Comprobación de marcado de lectura existente. Estos mocks no prueban permisos de servidor.
- frontend/test/core/phase5b_communications_peer_test.dart: veinte pruebas de las pantallas reales CommunicationsScreen/CommunicationDetailScreen sobre el mismo fixture; providers/datasource sustituidos, timers dispuestos. No modificar widgets productivos ni regenerar goldens.
- backend/tests/test_phase5b_communications_peer_browser.py y frontend-next/tests/e2e/phase5b-communications-peer-browser.mjs: harness existente con Chrome/Next production webpack/FastAPI/PostgreSQL real, perfiles y cuentas sintéticas. Cuatro conversaciones creadas mediante API BFF autenticada; ocho perspectivas lista→detalle→reload, comparadas con participantes de API. Estudiante recibe403 en GET y PUT status de conversación administrativa ajena, con CSRF válido, sin cambiar estado. El harness comprueba además que la dosis sigue in_review: no acción clínica desde comunicaciones.
- Capturas Next390×844, tema light explícito: lista y detalle de estudiante. Se inspeccionó el nombre del interlocutor. **No** son prueba de paridad visual Flutter ni de contraste/reflow integral. [Resultados](../ui/evidence/phase5b/communications-peer/results.json) solo exportan roles/booleanos/códigosHTTP y eventual Retry-After; no IDs, cookies, tokens, payloads clínicos o nombres en JSON. Imágenes contienen únicamente datos sintéticos.

Fallos previos registrados: primer import del fixture en el test apuntaba un nivel fuera del repo; se corrigió. Primera versión del matcher no tenía en cuenta texto combinado con categoría; se corrigió antes de aceptar la regresión. Baseline con expectativas correctas: **12 FAILED/8 PASS**, veinte tests; posterior **20 PASS**, más siete tests existentes de comunicaciones=27 PASS. No presentar esos fallos de montaje como defectos productivos.

Primer E2E:403 porque fetch de prueba no obtenía CSRF,6,48 s. Se corrigió solo el runner para usar /api/auth/csrf, token mantenido dentro del navegador y no exportado. Segundo E2E: timeout de login,16,25 s; cuatro logins de navegador más los dos del harness alcanzan RATE_LIMIT_LOGIN=5/minute. Runner final observa429 y espera Retry-After real una sola vez, con máximo60 s; no cambia límite, IP/proxy, auth o fixtures de seguridad. E2E específico final **1 PASS/65,08 s**, ocho perspectivas y permisos reales,18 warnings noload existentes. Nunca simular éxito del control ni ignorar el429.

### Gates

| Gate / directorio | Comando | Resultado |
|---|---|---|
| Next focalizado / frontend-next | npm test -- src/components/__tests__/phase5b-communications-peer.test.tsx src/components/__tests__/phase5a-communications.test.tsx |27 PASS,2 archivos,1,46 s. |
| Next completo/BFF | BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test |306 PASS,37 archivos,10,04 s. |
| Next lint / typecheck | npm run lint / node node_modules/typescript/bin/tsc --noEmit |PASS ambos. |
| Next producción | node node_modules/next/dist/bin/next build --webpack |PASS,compilación3,2 s,TypeScript/26 páginas. |
| Flutter referencia / frontend | FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache /tmp/immuno-miguel-tools/flutter/bin/flutter test --no-pub --reporter expanded test/core/phase5b_communications_peer_test.dart |20 PASS. |
| Flutter completo | mismo entorno + flutter test --no-pub --reporter expanded |181 PASS,8 s,sin actualizar goldens. |
| Flutter analyze / formato | mismo entorno + flutter analyze --no-pub / dart format --output=none --set-exit-if-changed test/core/phase5b_communications_peer_test.dart |PASS;analyze6,9 s;formato0 cambios. |
| E2E específico / backend | PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a .venv/bin/python -m pytest -q --tb=short --show-capture=no tests/test_phase5b_communications_peer_browser.py |1 PASS,65,08 s. |
| Ruff / sintaxis runner | .venv/bin/python -m ruff check tests/test_phase5b_communications_peer_browser.py / node --check tests/e2e/phase5b-communications-peer-browser.mjs |PASS. |
| Backend/PostgreSQL completo | Comando reproducible siguiente |397 PASS,0 SKIP,19 warnings,305,88 s; nueve E2E,concurrencia y tres migraciones existentes. |

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_communications_peer_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_communications_peer_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_communications_peer_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

Mismo entorno del bloque anterior: Python3.12.15/venv existente,PostgreSQL18 en loopback55544,Node22.22.1,Next16.3.6,Chrome155.0.8059.39,Flutter3.41.6/Dart3.11.4. No instalar/actualizar paquetes. Se crearon tres DB locales nuevas inicialmente vacías, con los prefijos requeridos, porque las pruebas de migración conservan sus resultados. No borrar bases anteriores ni ejecutar migraciones sobre datos institucionales. Primer test Flutter fue bloqueado por socket del sandbox; se repitió fuera del sandbox con autorización y pasó. pg_isready del sandbox no podía confirmar disponibilidad; pg_ctl autorizado confirmó servidor activo. Esas limitaciones no se cuentan como PASS ni como fallos de negocio.

### Límites, riesgos y rollback

**B5-C02 UNKNOWN:** hilo sin destinatario y sin otro participante identificable (p.ej. estudiante creado por sí mismo, recipient null). Se preserva el fallback legacy Flutter; no asignar un administrador por UI ni usar al último remitente para inventar destinatario. Requiere definir qué texto representa una conversación dirigida al ámbito sin persona identificada. Las ocho perspectivas explícitas no validan este caso ni una política institucional nueva.

**B5-C03 PENDING / P2:** captura del detalle390 claro muestra círculo decorativo superpuesto al compositor. AppShell solo aplica relative/z-0 a /admin y notificaciones; comunicaciones queda fuera de ese contexto. No modificar shell/CSS en este bloque de interlocutor. Requiere bloque independiente con prueba de capas, captura y reflow; no etiquetar la imagen como PASS visual completo. Contraste de burbujas, loading/empty/error en ambos temas, retry de read sync, lectores/zoom nativo/dispositivos y demás pantallas siguen sin cierre integral. B5-A07 UNKNOWN permanece.

Riesgo: cambiar una etiqueta de participantes puede confundirse con cambiar el destinatario; el helper no muta ni busca usuarios y consume solo relaciones autorizadas por API. No más PII que la ya recibida: fallback de correo previo conservado, no datos nuevos en URLs/logs. Es una representación del hilo, no una regla de acceso. No afirmar que una página aislada o tests de fixture prueben invalidación de sesión para todas las pantallas; gates existentes de Fase2/5A quedan como regresión.

Rollback: restaurar únicamente thread-row.tsx y thread-detail.tsx desde /tmp/immuno-miguel-tools/phase5b-communications-peer/backup, retirando imports/uso del helper conjuntamente. Conservar pruebas/evidencia preventiva y no git reset global ni revertir fases anteriores. No rollback de datos requerido: sin nuevas migraciones/cambios de negocio. Baseline incremental1358 archivos permite separar este trabajo del árbol previo. **FASE5B PARTIAL**, UI-16/UI-17 BLOCKED, T-02/T-03 PARTIAL, almacenamiento real pendiente. Sin commit ni declaración de producción lista.

### Resultado final y revisión incremental

**B5-C01 DONE para representación del interlocutor conocido. FASE5B PARTIAL.** Backend/PostgreSQL397 PASS,0 SKIP,305,88 s; nueve E2E incluidos y tres migraciones existentes en bases separadas, sin migración nueva. Next306 PASS/lint/typecheck/webpack PASS; Flutter181 PASS/analyze/formato PASS. Las pruebas existentes de comunicaciones por rol, comentario/revisión separados, sesiones, permisos, concurrencia y contexto siguen pasando. Los19 warnings son deprecaciones existentes noload y FCM, ahora también ejecutadas en el nuevo E2E; no corregidas en este bloque.

Revisión frente al baseline de1358 archivos: dos componentes Next modificados, helper de presentación nuevo; fixture compartido, un archivo de tests Next, uno Flutter y wrapper/runner E2E nuevos; tres documentos actualizados y evidencia nueva (dos capturas, resultados e índice). Otros artefactos sintéticos existentes se regeneran al ejecutar la suite E2E completa; sus hashes se actualizan solo cuando cambia el archivo referenciado. Ninguna golden/fixture Flutter anterior modificada, ni archivo eliminado. Ningún cambio funcional de backend/Flutter, API, permisos, autenticación, clínica, dependencias o migraciones en esta continuación.

Se revisaron git diff, diffs de los dos componentes frente a sus copias al inicio, todos los archivos de código nuevos y git diff --check (PASS). Escaneo limitado de patrones de secretos de alta confianza en código incremental:0 coincidencias; no auditoría universal. Capturas inspeccionadas, solo datos sintéticos, tema explícito y sin imagen de firma/certificados. [Índice de evidencia](../ui/evidence/phase5b/communications-peer/evidence-index.json) conserva hashes y deja la superposición decorativa como pendiente, no como paridad alcanzada. **B5-C02 UNKNOWN; B5-C03 PENDING.** UI-16/UI-17 BLOCKED, T-02/T-03 PARTIAL y almacenamiento real pendiente. No commit ni producción lista.

## Continuación — B5-C03 capas de comunicaciones

Fecha:2026-10-19, America/Bogota. El estado PENDING de B5-C03 en el bloque anterior es histórico; esta continuación documenta su corrección acotada. **FASE5B PARTIAL**. B5-C02 permanece UNKNOWN; no asignar destinatarios ni inventar una política de representación para conversaciones sin interlocutor identificado.

### Causa raíz y diseño

**B5-C03 / P2:** frontend-next/src/components/app-shell.tsx, AppShell. UccBrandBackground contiene una capa absoluta decorativa antes del contenido. Sin contexto de apilamiento para el contenido, la decoración puede pintarse sobre las superficies normales de las tarjetas/compositor. AppShell solo aplicaba relative/z-0 a /admin y notificaciones. Las rutas de comunicaciones quedaban fuera de esa corrección; la captura previa muestra el círculo sobre el pie del compositor y la navegación.

Se detecta la página de comunicaciones mediante coincidencia exacta /student/communications o /admin/communications, o sus descendientes con barra. Aplicar el mismo relative/z-0 a su contenedor de contenido. No hacer startsWith sin delimitador: communications-old/communications-extra quedan fuera. No cambiar UccBrandBackground, el recorte de decoración, aria-hidden, pointer-events-none, tamaños, colores, espaciado, fuentes, estados o jerarquía de formularios. No overflow nuevo sobre contenido. El fondo sigue visible detrás de superficies transparentes; no quitar la decoración como solución.

Referencia Flutter inspeccionada: CommunicationDetailScreen.build usa Scaffold, Column, listado y _Composer sobre su superficie; CommunicationsScreen conserva tarjetas y navegación. No hay una capa decorativa encima de su compositor. Veinte tests de pantallas reales del bloque anterior pasan dentro de la suite181. La matriz compara la separación funcional de contenido/controles; **no hay una nueva golden Flutter pareada de comunicaciones ni se afirma composición idéntica o paridad visual completa**.

### Archivos y pruebas

- Funcional: únicamente frontend-next/src/components/app-shell.tsx; una condición local de ruta de tres líneas y una línea reemplazada para ampliar la condición de apilamiento. Ningún backend funcional, Flutter funcional, API, contrato, permiso, auth/BFF, estado clínico, catálogo o migración alterado.
- Nuevo frontend-next/src/components/__tests__/phase5b-communications-layers.test.tsx:17 casos. Seis rutas de comunicaciones (listas/detalles/barra final), dashboard y notificaciones; siete rutas fuera del alcance preservan la política anterior, incluidos prefijos parecidos. Contenido fuera del recorte/aria-hidden; feedback/compositor alcanzable por teclado, edición y activación del botón independiente. JSDOM no prueba píxeles: las clases se complementan con navegador real.
- Nuevos backend/tests/test_phase5b_communications_layers_browser.py y frontend-next/tests/e2e/phase5b-communications-layers-browser.mjs: harness existente, Next production webpack, FastAPI y PostgreSQL real con cuentas/conversaciones sintéticas. Tres roles×lista/detalle×claro/oscuro×390/320/768/1440=48 escenas. Cada escena comprueba57 píxeles del interior opaco de la tarjeta, área visible, ausencia de overflow horizontal y de ancestros decorativos ocultos/recortados. Total2736 píxeles,0 diferencias tras corregir. También comprueba position/z-index reales; no simular una capa correcta inyectando CSS.
- Teclado en cada detalle/tema: escribir borrador, Tab al botón Enviar y conservar texto; no enviar por recorrer controles. Observador de red exige0 mensajes/estados/revisiones mutados desde esa interacción. Las únicas altas son conversaciones sintéticas preparadas por API autenticada y CSRF válido. Harness verifica que la dosis sigue in_review, sin transición clínica desde esta presentación.
- Evidencia: [antes](../ui/evidence/phase5b/communications-layers/before-admin-detail-light-390.png), [después claro](../ui/evidence/phase5b/communications-layers/after-admin-detail-light-390.png), [estudiante oscuro](../ui/evidence/phase5b/communications-layers/after-student-detail-dark-390.png). Doce capturas posteriores390, una previa y mediciones antes/después. No exportar IDs de hilo, cookies, tokens, nombres de personas o información clínica en JSON; imágenes solo sintéticas. No añadir fotografías/firmas/certificados.

### Evidencia del fallo y ejecución

Antes de modificar código funcional: test de componente **6 FAILED/11 PASS**,2,39 s. Build de producción anterior ejecutado. Primer E2E previo falló por position=static frente a relative,3,68 s; su primer muestreo solo del textarea no cubría el círculo situado sobre el pie de la tarjeta. Se corrigió el instrumento de prueba para muestrear el panel opaco completo en57 posiciones, manteniendo la aserción de fondo. Segundo E2E previo falló por **4 píxeles distintos de57** en compositor admin/claro390. Captura y mediciones se conservan; no ocultar un fallo relajando la aserción ni presentar el primer muestreo limitado como cobertura completa.

Tras la corrección: focalizados46 PASS (17 nuevos+20 interlocutor+7 comunicaciones+2 fondo),1,97 s. E2E específico **1 PASS,11,14 s**,48 escenas,14 warnings noload existentes. Las capturas/muestras son sobre el build real corregido, sin esconder temporalmente la decoración ni sustituir respuestas de lectura con fixtures en el navegador. No se promete que57 puntos prueben todos los píxeles de una pantalla; capturas inspeccionadas y aserción de capas complementan el muestreo.

| Gate / directorio | Comando | Resultado |
|---|---|---|
| Next completo / frontend-next | BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test |323 PASS,38 archivos,11,15 s. |
| Next lint/typecheck | npm run lint / node node_modules/typescript/bin/tsc --noEmit |PASS ambos. |
| Next producción | node node_modules/next/dist/bin/next build --webpack |PASS,compilación3,2 s,TypeScript2,2 s/26 páginas. |
| Flutter analyze / frontend | FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache /tmp/immuno-miguel-tools/flutter/bin/flutter analyze --no-pub |PASS,3,1 s. |
| Flutter completo | mismo entorno + flutter test --no-pub --reporter expanded |181 PASS,9 s,sin actualizar goldens. |
| E2E específico / backend | PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a .venv/bin/python -m pytest -q --tb=short --show-capture=no tests/test_phase5b_communications_layers_browser.py |1 PASS,11,14 s. |
| Ruff / sintaxis runner | .venv/bin/python -m ruff check tests/test_phase5b_communications_layers_browser.py / node --check tests/e2e/phase5b-communications-layers-browser.mjs |PASS. |
| Backend/PostgreSQL integrado | Comando siguiente |398 PASS,0 SKIP,27 warnings,332,82 s; diez E2E,concurrencia y tres migraciones existentes. |

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_communications_layers_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_communications_layers_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_communications_layers_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Entorno y reinicio

La limpieza de /tmp había eliminado Python/Flutter/PostgreSQL temporales. Se restauró uv0.13.0 en /tmp, Python3.12.15 en su ruta original y se reutilizó backend/.venv con sus paquetes, sin pip install/upgrade. Flutter3.41.6 del tag oficial, commit db50e20168db8fee486b9abf32fc912de3bc5b6a, Dart3.11.4; bootstrap de componentes oficiales. Checkout detached informa channel[user-branch]/unknown source, igual que el bloque anterior; no afirmar checkout de stable. flutter pub get --enforce-lockfile reconstruyó caché:101 avisos de versiones nuevas ignorados, sin actualizar proyecto. Node22.22.1, Next16.3.6 y Chrome existentes. No instalaciones globales ni dependencias nuevas.

PostgreSQL18 se inicializó en /tmp con localeC/timezoneAmerica/Bogota, solo loopback/socket55544 y trust local para pruebas. Cuatro bases nuevas: integración y tres migraciones inicialmente vacías. No datos institucionales, eliminación de bases previas o despliegue. Para repetir las migraciones preparar otras DB vacías con sus prefijos; no borrar resultados existentes.

Build inicial dentro del sandbox falló al analizar TypeScript --showConfig; se repitió autorizado fuera del sandbox y pasó. Un reinicio del servidor de herramientas interrumpió la ejecución: se comprobó disco/logs antes de continuar, sin repetir altas/migraciones ya terminadas. pg_ctl dentro del sandbox no veía el servidor; un intento de arranque rechazó arrancar un duplicado, y pg_ctl/SELECT1 autorizados confirmaron el proceso original activo. Sin reinit ni pérdida de bases. La tarea pub get anterior seguía ejecutándose; el intento adicional produjo salida compartida temporal. Al comprobar PID y solicitar detener la segunda tarea, esta ya había terminado (No such process); no se terminó ningún proceso. La tarea observable terminó0 y ambos mensajes Got dependencies quedaron en el log temporal. No tomar procesos invisibles al sandbox como evidencia de que no existen. No modificar dependencias a ciegas por errores de entorno.

### Riesgos, límites y rollback

Nuevo contexto de apilamiento puede afectar superposiciones/sticky dentro de comunicaciones. No añadir overflow al shell; el header mantiene sus clases y el fondo queda debajo. Gate integrado cubre los flujos existentes de menú, tema, catálogo/modales, comunicaciones, contexto y permisos. No afirmar pruebas de todos los overlays posibles, lectores de pantalla, zoom nativo/dispositivos físicos o teclado virtual. Anchos320/390/768/1440 son mediciones de reflow, no una nueva política institucional de soporte. Estados loading/empty/error/sesión expirada no reciben aquí una comparación visual completa en cada tema.

Rollback: restaurar solo frontend-next/src/components/app-shell.tsx frente a /tmp/immuno-miguel-tools/phase5b-communications-layers/backup, conservando pruebas/evidencia preventiva; no revertir el selector de interlocutores ni correcciones previas de dashboard/notificaciones. Si el backup temporal desaparece, retirar únicamente la nueva variable communicationPage y su término `|| communicationPage` de la condición de clase; las condiciones anteriores quedan intactas. Ninguna migración nueva ni datos productivos requieren rollback. Baseline incremental1060 archivos (sin __pycache__) separa el bloque del árbol sucio previo. Sin cambios de FastAPI/Flutter funcional, clínica, autenticación, contratos, PDF/QR, Maps, Azure o stores. Sin commit. B5-C02/B5-A07 UNKNOWN; UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL; almacenamiento real pendiente. **FASE5B PARTIAL**, sin producción lista.

### Resultado final y revisión incremental

**B5-C03 DONE para las capas de comunicaciones comprobadas. FASE5B PARTIAL.** Backend/PostgreSQL398 PASS,0 SKIP,27 warnings,332,82 s; diez E2E y tres pruebas de migración existentes ejecutadas. Next323 PASS/lint/typecheck/build webpack PASS; Flutter181 PASS/analyze PASS, sin actualizar goldens. E2E específico1 PASS:48 escenas,2736 puntos de muestreo sin superposición. La comparación de todos los estados y la paridad visual integral no quedan cerradas.

Revisión incremental frente al baseline1060 archivos: un único archivo funcional modificado, app-shell.tsx, con la condición de rutas de comunicaciones y su término en la clase; tres archivos de pruebas nuevos. Tres documentos actualizados; quince artefactos de captura/medición nuevos y su índice. La suite completa regenera además evidencia sintética previa: se actualizan los hashes de referencias cuyo archivo cambió, sin reescribir su procedencia. Ningún archivo eliminado ni cambio de backend funcional, Flutter funcional, APIs, permisos, auth/BFF, dominios clínicos, nuevas migraciones, dependencias/lockfiles o configuraciones de plataformas. Las goldens Flutter anteriores conservan sus hashes.

Se revisaron git diff y diff del único componente frente a su copia inicial; archivos de pruebas nuevos, enlaces de esta sección y whitespace/newlines; git diff --check PASS. Escaneo limitado de patrones de secretos de alta confianza en código incremental:0 coincidencias, no auditoría universal. Capturas antes/después inspeccionadas, nombres/cuerpos sintéticos y sin datos institucionales. [Índice/hash](../ui/evidence/phase5b/communications-layers/evidence-index.json). Los27 warnings corresponden a deprecaciones existentes noload/FCM, ahora también ejercidas por el nuevo E2E; sin corregir en este alcance.

**B5-C02 UNKNOWN** (representación sin interlocutor identificado), **B5-A07 UNKNOWN** (opciones institucionales de semestre); estados visuales completos, contraste de burbujas, lectores/zoom/dispositivos pendientes. UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL y almacenamiento real pendiente. Sin commit ni preparación productiva declarada.

## Continuación — B5-C04/C05 recuperación de lectura y contraste de mensajes

Fecha:2026-10-19, America/Bogota. Alcance funcional: coordinación de marcado de lectura en el detalle Next; representación de reintentos/estado vacío; texto de mensajes propios en Flutter y Next. **FASE5B PARTIAL**; B5-C02/B5-A07 UNKNOWN conservados. El estado consolidado del [plan](phase5b-plan.md#estado-consolidado--2026-10-19) evita recontar pendientes históricos como correcciones nuevas.

### Causas raíz

**B5-C04 / P2:** ThreadDetail tenía dos rutas independientes para markCategoryRead: useEffect automático y callback manual. El callback de retry no tenía inFlight/pending ni guardas de ciclo de vida. Un doble clic podía emitir varios PUT; una respuesta manual antigua podía borrar un error de sincronización posterior. El efecto automático protegía parcialmente setReadError con alive, pero podía invalidar notifications después de desmontarse/cambiar de hilo. No era una transición clínica ni una ampliación de permisos.

**B5-C05 / P2:** Bubble de Next y _MessageBubble de Flutter forzaban blanco sobre cian#00AFC6. Contraste observado2,642:1 para nombre/cuerpo y2,166:1 para fecha Flutter con alfa0,8. En Next oscuro el cian también cambia por tema y el blanco fijo no consume un primer plano compatible. No copiar el defecto de Flutter como referencia normativa.

**B5-C06 / P2, alcance parcial:** las consultas Next ya distinguían carga/vacío/error/success, pero faltaba evidencia completa de sus estados y feedback de reintento con datos anteriores. La respuesta válida messages=[] dejaba una lista sin texto. No inventar un estado de negocio: el schema FastAPI permite lista vacía; se añade solo su representación. La captura equivalente de carga/vacío/error de Flutter sigue pendiente.

### Implementación y archivos

- Nuevo frontend-next/src/lib/query/communication-read-sync.ts: una sola operación por marcador de la vista (userId/threadId/last_message_at); ref inFlight cierra el doble clic antes del siguiente render. Error permanece visible y retry disabled/aria-busy hasta terminar. Cada efecto conserva su propia vigencia; cambio de mensaje, hilo, usuario o unmount invalida sus resultados para UI/cache. Antes/después de cada await se comprueba vigencia, evitando un PUT que aún no salió o invalidaciones obsoletas. StrictMode no emite una escritura del efecto ya sustituido.
- Mantener exactamente markCategoryRead("communication"), cancelQueries notifications antes/después y invalidateQueries notifications solo tras éxito vigente. **No cambiar el marcado por categoría a marcado por hilo**, alcance del endpoint, permisos, DTOs, estados de conversación o protocolo de sesión. No cancelar retroactivamente un HTTP ya aceptado por el servidor ni prometer exclusión entre distintas pestañas/vistas. El hook coordina únicamente esta instancia y no sustituye AuthGate/apiClient de Fase2.
- frontend-next/src/components/thread-detail.tsx consume el hook; elimina callbacks duplicados. QueryError de consulta usa isFetching y refetch({cancelRefetch:false}); sin datos, React Query vuelve a LoadingState al reintentar, como antes. Con datos anteriores, el error/control permanece ocupado hasta resolver; no conservar lista/hilo visible tras403. messages=[] muestra No hay mensajes y conserva el compositor. Mensaje propio usa text-black con el mismo fondo/forma/alineación. No modificar send/status ni sus confirmaciones.
- frontend-next/src/components/communications-page.tsx incorpora solo isFetching/cancelRefetch:false en retry de la lista. Formularios, destinatarios, búsqueda, permisos, categorías y mutación de creación intactos. Un fallo de lista no borra un formulario sin enviar; se prueba el comportamiento existente.
- frontend/lib/features/shared/presentation/screens/communication_detail_screen.dart cambia únicamente tres colores de mensajes propios: nombre, cuerpo y fecha/indicador a negro opaco. Mantener fondo#00AFC6, Opacity0,72 de envío optimista, layout, fechas y handlers. Eliminar alfa0,8 del texto de fecha propio para que también sea legible durante esa opacidad. Mensajes ajenos sin cambios. No tocar providers/cache, datasource/auth ni reglas.

No backend funcional ni nuevas migraciones/dependencias/lockfiles. FastAPI continúa autorizando destinatarios y acciones. Ningún cambio de dosis, certificado, PDF/QR, Google Maps, Azure o stores.

### Pruebas y comparación visual

- Nuevo frontend-next/src/components/__tests__/phase5b-communications-recovery.test.tsx:27 casos con QueryClient real. Retry doble por los tres roles, error/draft retenidos, recuperación; éxito antiguo automático/manual frente a un error nuevo, cambio de hilo/usuario, unmount y StrictMode. Solo invalidar notifications; no enviar mensaje ni actualizar estado por retry. Consultas de lista/detalle en loading, seis erroresHTTP401/403/404/429/500/503, mensajes seguros, recuperación a empty/success, retry con cache anterior, vacío de mensajes válido y formulario sin enviar conservado. Interacciones/mocks no demuestran autorización del servidor por sí solos.
- Nuevo frontend/test/core/phase5b_communication_contrast_test.dart:dos widget tests de la pantalla real, ambos temas390×844, AppTheme/Inter y MaterialIcons locales, sin red. Estado enviado y envío optimista real iniciado por el usuario con datasource sintético retenido. Comprobar nombre/cuerpo/fecha o Enviando... con composición de alpha sobre scaffoldBackgroundColor. Antes, dos tests FAILED por contraste; después2 PASS y cuatro nuevas goldens verificadas sin update en la suite normal. Ninguna golden anterior se actualiza.
- Flutter: enviado7,947:1 en ambos temas; pendiente4,558 claro/4,578 oscuro, Opacity0,72 intacta. Negro frente al mismo cian en Next claro7,947:1; tema oscuro medido por CSS real. Los fondos oscuros de ambas plataformas no se homogeneizan en este bloque. No afirmar identidad pixel a pixel, contraste de todos los controles/avatares/iconos, lector o zoom nativo.
- Nuevo backend/tests/test_phase5b_communications_recovery_browser.py y frontend-next/tests/e2e/phase5b-communications-recovery-browser.mjs. Harness existente con Chrome/Next production/FastAPI/PostgreSQL sintético.47 casos:4 contrastes (admin/student×temas),40 estados de consulta (roles×temas×lista/detalle×loading/empty/403/404/503),2 retries de lectura y1 permisos/expiración. Errores/empty/loading y401 final son respuestas controladas; el retry y la recuperación continúan contra backend real. No presentar el403 controlado como prueba de autorización: además se comprueba403 real de GET administrativo desde estudiante.
- Retry de lectura: dos clics en el mismo turno de JS, exactamente un PUT retenido, botón disabled/aria-busy, error y borrador visibles. Liberar el PUT hacia FastAPI; desaparece el error, se conserva borrador y GET notifications confirma categoría leída. Recorrer estados no envía respuestas ni cambia estado/revisa dosis (0 escrituras no previstas); altas/mensaje de preparación se hacen fuera de la interceptación, con sesión/CSRF reales y datos sintéticos. Harness conserva comprobación de dosis in_review.
- [Antes Flutter](../ui/evidence/phase5b/communications-recovery/before-flutter-detail-light-sent-390.png), [después Flutter](../ui/evidence/phase5b/communications-recovery/after-flutter-detail-light-sent-390.png), [después Next](../ui/evidence/phase5b/communications-recovery/after-next-admin-messages-light-390.png), [retry retenido](../ui/evidence/phase5b/communications-recovery/after-next-student-read-retry-pending-light-390.png).53 PNG sintéticos y4 JSON de medidas, más índice. JSON solo casos/roles/colores/ratios/booleanos/códigos; no IDs/tokens/cookies/nombres o información clínica. [Índice/hash](../ui/evidence/phase5b/communications-recovery/evidence-index.json).

### Gates y fallos conservados

| Gate | Comando / directorio | Resultado |
|---|---|---|
| Next focalizado | npm test -- src/components/__tests__/phase5b-communications-recovery.test.tsx src/components/__tests__/phase5a-communications.test.tsx src/components/__tests__/phase5b-communications-peer.test.tsx, frontend-next |54 PASS,3 archivos,2,90 s. |
| Next completo/BFF | BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test |350 PASS,39 archivos,9,33 s finales (incluido StrictMode con cache);10,98 s ejecución anterior. |
| Next lint/typecheck | npm run lint / node node_modules/typescript/bin/tsc --noEmit |PASS. |
| Next build | node node_modules/next/dist/bin/next build --webpack |PASS,compilación3,4 s,TypeScript2,0 s/26 páginas. |
| Flutter completo | FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache /tmp/immuno-miguel-tools/flutter/bin/flutter test --no-pub --reporter expanded, frontend |183 PASS,12 s,sin update de goldens. |
| Flutter analyze/formato | mismo entorno + flutter analyze --no-pub; dart format --output=none --set-exit-if-changed test/core/phase5b_communication_contrast_test.dart lib/features/shared/presentation/screens/communication_detail_screen.dart |PASS;analyze2,0 s;formato0 cambios. |
| Flutter contraste regular | mismo entorno + flutter test --no-pub --reporter expanded test/core/phase5b_communication_contrast_test.dart |2 PASS;cuatro goldens existentes en ese momento verificadas sin update. |
| E2E específico | PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a .venv/bin/python -m pytest -q --tb=short --show-capture=no tests/test_phase5b_communications_recovery_browser.py, backend |1 PASS,40,58 s,30 warnings noload existentes. |
| Ruff | .venv/bin/python -m ruff check tests/test_phase5b_communications_recovery_browser.py |PASS. |
| Backend/PostgreSQL completo | Comando siguiente |399 PASS,0 SKIP,51 warnings,350,54 s;once E2E,concurrencia y tres migraciones existentes. |

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_communications_recovery_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_communications_recovery_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_communications_recovery_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

Entorno conservado del bloque anterior:Python3.12.15/venv,Node22.22.1/Next16.3.6,PostgreSQL18/loopback55544,Chrome155.0.8059.39,Flutter3.41.6/Dart3.11.4 con fuentes/cache locales. Sin instalaciones/actualizaciones. Tres nuevas DB locales vacías para repetir migraciones existentes; no borrar las DB anteriores. Para otra repetición crear otras bases vacías con los prefijos requeridos. No datos institucionales.

Fallos conservados, no declarados PASS: primera versión del archivo (25 casos) dio22 FAILED/3 PASS; una espera de notificación asíncrona se corrigió y las expectativas de retry sin cache se ajustaron al LoadingState real de React Query, no a un botón ya desmontado. Se añadieron2 casos con cache para comprobar de verdad el control disabled; resultado final27 PASS, más los27 previos=54. El caso StrictMode se reforzó con datos ya presentes al montar para ejercitar su repetición de efectos desde el primer render. Races de lectura/doble clic fueron corregidas en la aplicación, no relajadas en el test. Antes Flutter2 FAILED por contraste y antes Next E2E FAILED con2,642:1 sobre build anterior. Inicialización de goldens limitada exclusivamente al nuevo archivo de test; posterior ejecución normal PASS. Analyze inicial avisó de2 if sin braces en el nuevo test, corregidos sin tocar criterios. Primer E2E posterior falló5,10 s por intentar serializar un nodo DOM mediante CDP; until ahora evalúa Boolean, manteniendo sus condiciones. Reejecución1 PASS,40,58 s. No cambiar dependencias por esos fallos de prueba.

### Riesgos, límites y rollback

Coordinación es por instancia/marcador; no prometer exclusión global entre pestañas ni cancelar un PUT que backend ya aceptó. Cambios de identidad usan las defensas existentes de apiClient/AuthGate; el hook solo evita emitir/invalidation/estado de su contexto obsoleto. No ampliar permisos ni usar rol como sustituto de autorización FastAPI. Refetch HTTP con cache sigue ocultando datos ante error; sin cache se muestra loading durante retry. No se introduce retención de datos clínicos ni se cambia la política offline.

**B5-C06 PARTIAL:** estados básicos Next probados, pero Flutter carga/vacío/error/recuperación no tiene comparación visual pareada completa. Su lista/detalle tienen polling y tratamientos propios de error; no presentarlos como iguales a Next ni corregirlos sin pruebas. Contraste de mensajes propios corregido, pero controles/iconos/avatares y pantalla completa siguen fuera de esa afirmación. Textos largos/reflow con zoom nativo, lectores y dispositivos pendientes; no extrapolar métricas390 a todas las plataformas.

Rollback independiente: restaurar ThreadDetail y CommunicationsPage desde /tmp/immuno-miguel-tools/phase5b-communications-recovery/backup y retirar uso/import del hook en conjunto, conservando los cambios de interlocutor/capas previos. El color se revierte restaurando únicamente las tres expresiones de color de mensajes propios Flutter y text-black de Next; no restaurar otros archivos antiguos ni hacer git reset global. Conservar pruebas/evidencia preventiva. No hay rollback de datos o nuevas migraciones. Baseline1084 archivos incluye contratos/dependencias y las referencias anteriores.

B5-C02/B5-A07 UNKNOWN; UI-16/UI-17 BLOCKED; T-02/T-03 PARTIAL, almacenamiento real pendiente. Fase5A permanece DONE, **FASE5B PARTIAL**. Sin commit ni producción lista.

### Resultado final y revisión incremental

**B5-C04 DONE. B5-C05 DONE dentro del texto de mensajes propios. B5-C06 PARTIAL. FASE5B PARTIAL.** Backend/PostgreSQL399 PASS,0 SKIP,51 warnings,350,54 s; once E2E y tres migraciones existentes ejecutadas. Next350 PASS/lint/typecheck/build webpack PASS; Flutter183 PASS/analyze/formato PASS; cuatro referencias nuevas de mensajes enviando/enviados verificadas sin regenerar ninguna referencia anterior. E2E específico1 PASS/40,58 s,47 casos. Los51 warnings son deprecaciones noload/FCM existentes, también ejercidas por el nuevo flujo, no errores omitidos ni dependencias actualizadas.

Baseline1084 archivos: tres archivos funcionales existentes modificados (ThreadDetail, CommunicationsPage y el detalle Flutter), un hook nuevo; cuatro archivos nuevos de pruebas (Next, Flutter y wrapper/runner E2E). Tres documentos actualizados, con tabla de pendientes activos al comienzo del plan.53 PNG sintéticos,4 JSON de medidas y un índice nuevos. Se refrescan hashes de evidencia web anterior regenerada por la suite completa, conservando procedencia; no archivos eliminados. Contratos/backend funcional/migraciones/dependencias/lockfiles y goldens Flutter anteriores conservan sus hashes.

Se revisaron git diff y diffs incrementales contra las copias iniciales; archivos de código nuevos, enlaces de la matriz, whitespace y git diff --check PASS. Escaneo limitado de patrones de secretos de alta confianza en código incremental:0 coincidencias, no auditoría universal. Capturas Flutter y Next antes/después inspeccionadas. No agregar datos institucionales, tokens o información clínica a artefactos; medidas numéricas solo de UI/roles/códigos.

Quedan B5-C06 (paridad completa de estados Flutter), B5-C02/B5-A07 UNKNOWN, otras pantallas y validación nativa. Contraste global/control/icono/avatar no se declara validado por la corrección del texto propio. UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL, almacenamiento real pendiente. **No cerrar Fase5B ni declarar producción lista. Sin commit.**

## Continuación — B5-C06 estados y recuperación de comunicaciones Flutter

Fecha:2026-10-19 America/Bogota. **C06 DONE únicamente en los estados y recorridos demostrados; FASE5B PARTIAL.** Las filas históricas anteriores conservan sus resultados originales. Skills locales aplicadas:ui-parity,quality-gates,security-health; AGENTS.md y código/tests inspeccionados antes de editar. No se añade lógica clínica, endpoint, permiso o protocolo de sesión. No cambios de Next ni backend funcional en este bloque.

### Causas y solución

| Hallazgo | Causa raíz | Solución y prueba |
|---|---|---|
| Lista/detalle sin recuperación | El error sustituía el contenido por un Text sin botón; vacío de mensajes no tenía representación. | CommunicationQueryError con reintento y liveRegion; mensajes=[] muestra No hay mensajes y conserva el compositor. Carga/reintento usan el spinner existente. Tres roles y dos temas. |
| Error de refresco silencioso | Detalle solo mostraba error cuando _thread==null: un403 posterior dejaba texto, compositor y cambio de estado visibles. | Ocultar contenido/acciones previos en cualquier error de consulta, con mensajes seguros por status. Conservar internamente el borrador para retry; no inferir permisos. Prueba403 tras éxito comprueba retirada de contenido y controles, recuperación y borrador sin emitir mensajes ni cambiar estados. |
| Reintento bloqueado por cache | La frescura TTL se conservaba tras GET fallido; un fallo de creación también podía dejar error con cache reciente. | Invalidar frescura ante GET fallido y no aplicar TTL cuando existe error. Retry normal conserva la deduplicación existente; forceRefresh de polling/mutaciones permanece como antes. Dos pruebas específicas: fallo de refresh y fallo de creación seguido de retry dentro del TTL. |
| Respuesta antigua sustituye error/estado reciente | Catch de GET en detalle no comparaba su secuencia; enviar un mensaje ya invalida un GET anterior. | Aplicar en catch la misma comprobación mounted/secuencia que en éxito. GET anterior fallido no sustituye un envío confirmado. No cambiar el POST ni comportamiento optimista. |
| Fallo de marcado de lectura oculto | GET y markCategoryRead compartían try/catch; fallar la escritura de notificaciones se ignoraba si existía hilo. | Error/retry independiente de lectura conservando hilo y borrador; marca communication, como antes. Deduplicar reintento síncronamente; no enviar mensajes, cerrar/reabrir ni revisar por reintentar. No cambiar NotificationNotifier ni semántica de categoría. |
| Polling invalida un retry de lectura vigente | Primera implementación vinculó resultado de lectura a la secuencia de GET; otro GET del mismo hilo descartaba un éxito válido. | Vigencia por usuario/hilo/last_message_at y ausencia de error de consulta. Polling del mismo marcador no invalida el éxito; resultado de otro contexto no actualiza el marcador/error local. Regresión reproducida FAILED y luego PASS. No exclusión entre pestañas ni cancelación retroactiva de HTTP aceptados. |

Los mensajes de401/403/404/429/500/503 son los mismos textos seguros de QueryError Next; fallback de conexión para otros errores. Nunca renderizar el body/message diagnóstico del backend. El401 de widget simula DioException, **no demuestra por sí mismo logout real**: interceptor/API/AuthGate existentes no se modifican y la expiración web permanece cubierta por el E2E anterior.

### Archivos y contratos

- frontend/lib/features/shared/presentation/communication_error.dart: mapeo de error seguro, sin depender de widgets.
- frontend/lib/features/shared/presentation/widgets/communication_query_error.dart: presentación de error/retry reutilizada por lista, detalle y lectura; controles nativos con colores onSurface existentes y liveRegion.
- frontend/lib/features/shared/presentation/providers/communication_provider.dart: frescura TTL/error. Sin cambios de DTOs, endpoints, roles ni paginación.
- frontend/lib/features/shared/presentation/screens/communications_screen.dart: reintento de consulta; crea, busca destinatarios, navega y actualiza con los mismos contratos.
- frontend/lib/features/shared/presentation/screens/communication_detail_screen.dart: error explícito en refresh, retry, vacío de mensajes y lectura independiente. Timer3s/lista8s, envío optimista, POST/PUT y permisos permanecen; solo se retiran acciones mientras la consulta está en error. No estado clínico nuevo.
- frontend/test/core/phase5b_communications_states_test.dart:30 pruebas nuevas (12 errores/retry,2 TTL,1 contenido denegado/borrador,1 respuesta antigua tras envío,2 lectura/polling,12 recorridos visuales con cinco estados cada uno). Fixtures reservados example.invalid, fechas fijas, AppTheme/Inter/MaterialIcons offline. Roles exactos student/admin/app_admin; fixture app_admin conversa con admin, sin estudiante.
- Tres documentos:este informe,plan y matriz.60 PNG nuevos,parity-cases.json y evidence-index.json en docs/ui/evidence/phase5b/communications-states.

**Migraciones:ninguna.** Dependencias,lockfiles,backend,Next,clínica,certificados/PDF/QR y autenticación de Fase2 sin cambios funcionales. No datos institucionales, Maps,Azure,stores ni commit.

### Evidencia visual y límites

[Índice con SHA-256](../ui/evidence/phase5b/communications-states/evidence-index.json) y [60 casos anotados](../ui/evidence/phase5b/communications-states/parity-cases.json). Flutter12 combinaciones de pantalla/rol/tema×5 estados=60 referencias390×844,DPR1. Inicializar únicamente las nuevas referencias de este archivo; después suite normal sin --update-goldens. Ninguna referencia Flutter anterior se regenera. Se revisaron capturas de error oscuro, vacío claro y éxito app_admin, comparadas con los estados web existentes.

Las capturas pareadas reutilizan Chrome anterior de comunicaciones-recovery y communications-layers. Estados HTTP web controlados se distinguen del éxito real sobre PostgreSQL. No hay una nueva captura web por cada app_admin/estado ni de cada query-retry pendiente; parity-cases registra null y la limitación correspondiente. La prueba Next de retry de lectura sí recorre los tres roles; los estados generales usan el componente compartido. No afirmar igualdad de píxeles, todos los estados app_admin de navegador, dispositivos nativos, lectores, zoom, teclado virtual, responsive completo o contraste global. Estos límites no se sustituyen por capturas sintéticas.

### Ejecución real

Entorno sin instalaciones ni actualizaciones:Python3.12.15/venv,Node22.22.1/Next16.3.6,PostgreSQL18/loopback55544,Chrome155.0.8059.39,Flutter3.41.6/Dart3.11.4. Datos solo sintéticos. Para las tres migraciones existentes se crearon bases nuevas vacías immuno_phase1_communications_states_migration,immuno_phase2_communications_states_migration,immuno_phase4_communications_states_migration; no borrar/reutilizar como vacías las anteriores.

| Gate | Comando / resultado |
|---|---|
| Flutter focalizado antes | PHASE5B_SKIP_GOLDENS=1 + flutter test --no-pub --reporter expanded test/core/phase5b_communications_states_test.dart:1 PASS/27 FAILED; faltaban mensajes de error/retry/vacío y frescura. |
| Regresión de lectura antes | flutter test --no-pub --reporter expanded test/core/phase5b_communications_states_test.dart --plain-name 'polling the same thread':1 FAILED antes de corregir vigencia; ahora incluido en suite PASS. |
| Referencias nuevas | flutter test --no-pub --update-goldens --reporter expanded test/core/phase5b_communications_states_test.dart:29 PASS al inicializar únicamente referencias nuevas; el test30 de TTL de creación no crea imágenes. |
| Flutter final | flutter test --no-pub --reporter expanded:213 PASS,10 s,sin update. |
| Flutter analyze | flutter analyze --no-pub:PASS,2,8 s. Aviso inicial de braces corregido; no silenciar lint. |
| Formato | dart format --output=none --set-exit-if-changed sobre los seis archivos Dart nuevos/modificados:PASS,0 cambios. |
| Next tests/BFF | BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test:350 PASS,39 archivos,11,20 s. |
| Next lint/typecheck | npm run lint; node node_modules/typescript/bin/tsc --noEmit:PASS. |
| Next webpack | node node_modules/next/dist/bin/next build --webpack:PASS,26 páginas; ejecución después de finalizar E2E para no modificar .next mientras se sirve. |
| Backend/PostgreSQL/E2E | Comando siguiente:399 PASS,0 SKIP,51 warnings,360,26 s;once E2E y tres migraciones existentes sobre nuevas bases vacías. |

Los comandos Flutter usan FLUTTER_SUPPRESS_ANALYTICS=true y PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache; ejecutable /tmp/immuno-miguel-tools/flutter/bin/flutter. Logs locales del bloque en /tmp/immuno-miguel-tools/phase5b-communications-states; no publicar logs del servidor ni secretos. Al repetir Python usar las variables del comando siguiente, creando previamente otras tres bases vacías si las migraciones ya corrieron:

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_communications_states_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_communications_states_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_communications_states_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos, rollback y pendientes

Un error de consulta oculta el hilo aunque sea transitorio; no lo representa como verificado ni borra el borrador. Los datos permanecen en memoria de la vista para recuperación; no se añade cache persistente. La coordinación de lectura es local a esta vista y conserva marcado por categoría. No prometer cancelación en servidor, exclusión global ni nueva política offline/sesión. No se cambia el estado de conversación/dosis por reintentar.

Rollback:restaurar únicamente los tres archivos existentes de /tmp/immuno-miguel-tools/phase5b-communications-states/backup y retirar conjuntamente sus imports/usos de los dos archivos nuevos de presentación. Conservar pruebas y evidencia preventiva; no git reset global, no revertir C01/C03/C04/C05 ni fases anteriores. Sin rollback de datos/migraciones. Baseline1147 archivos para revisión incremental.

C02/A07 UNKNOWN; otras pantallas y accesibilidad nativa PARTIAL/UNKNOWN; UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL y almacenamiento real pendiente. **FASE5B PARTIAL; ninguna declaración de producción lista. Sin commit.**

### Revisión final C06

Gates finales completos:backend/PostgreSQL399 PASS/0 SKIP,51 warnings,360,26 s;Next350 PASS/lint/typecheck/webpack PASS;Flutter213 PASS/analyze/formato PASS. Los51 warnings corresponden a deprecaciones existentes de noload/FCM; no se ocultaron ni cambiaron dependencias. El E2E existente de recuperación conserva47 casos web; no se presenta como integración nativa Flutter.

Comparación contra baseline1147 archivos:solo tres archivos funcionales Flutter existentes modificados;dos auxiliares Dart y un archivo de30 tests nuevos. No cambios de fuente backend/Next,contratos,migraciones,dependencias/lockfiles ni goldens Flutter anteriores. Sin archivos anteriores eliminados. Revisados git diff y diff incremental de los tres archivos;git diff --check PASS. Escaneo limitado de patrones de secretos de alta confianza en los seis Dart:0 coincidencias; no sustituye una auditoría universal. Enlaces de la sección/matriz comprobados.

Se guardaron60 nuevas referencias Flutter y dos JSON de casos/índice. La suite integrada volvió a producir capturas web anteriores;se actualizaron ocho índices de hashes preservando procedencia y límites.660 referencias SHA-256 comprobadas,0 ausentes. No cambiar PNG Flutter anteriores para hacer pasar regresiones. La primera generación del test corrigió un alias de rol erróneo del fixture(admin_app→app_admin) y su interlocutor;los20 PNG nuevos con alias incorrecto se descartaron antes de generar las referencias finales. Ninguna referencia anterior afectada.

**C06 DONE en estados/recuperación demostrados. FASE5B PARTIAL.** Siguiente trabajo:inventario restante por pantalla y validación nativa;C02/A07 UNKNOWN,UI-16/UI-17 BLOCKED,T-02/T-03 PARTIAL,almacenamiento real pendiente. No commit ni producción lista.

## Continuación — perfil estudiante S08 P01/P02

Fecha:2026-10-19 America/Bogota. Alcance:arranque del perfil Flutter y lectura/reflow/recuperación inicial del perfil del estudiante Next. **FASE5B PARTIAL.** AGENTS.md,skills locales ui-parity/quality-gates/security-health,plan/matriz y código/tests inspeccionados antes de editar. Firma administrativa,certificados,UI-16/UI-17,backend,contratos,clínica y autenticación de Fase2 fuera del bloque.

### Causas y correcciones

| ID / prioridad | Causa raíz | Solución / alcance |
|---|---|---|
| B5-P01 / P2 | ProfileState inicial tiene isLoading=false/profile=null; initState agenda loadProfile en microtask, pero build anterior llega a _buildBody y profile!. | Considerar carga el estado sin perfil ni error. Un cambio de condición de representación; mismo ProfileNotifier,GET,permisos y señales de dominio. El error con perfil ausente sigue teniendo su reintento. |
| B5-P02a / P2 | Hero/InfoTile/LockedTile Next usan truncate; correo se representa como texto sin posibilidad de romper una cadena larga dentro de flex. | Eliminar truncado de valores y nombre,poner correo en span flexible y aplicar overflow-wrap:anywhere exclusivamente al perfil estudiante. Conservar todos los datos y acciones,gradient/colores/tipografía y campos autorizados. |
| B5-P02b / P2 | Media queries sm/md miran viewport; con CSS zoom2 y768px el shell mantiene barra lateral/cabecera de escritorio, dejando el contenido casi sin ancho. La primera corrección local no bastaba. | Container queries locales:perfil reorganiza hero/grillas por espacio disponible; /student/profile tiene shell con contenedor nombrado,nav móvil y cabecera compacta cuando falta espacio. Ninguna otra ruta recibe estas clases. Elevar el contenido de esa ruta sobre la decoración,como las rutas ya verificadas de comunicaciones. No cambiar rutas,enlaces,menú,sesiones ni notificaciones. |
| B5-P02c / P2 | QueryError del perfil no pasaba isFetching y refetch usaba cancelRefetch=true por defecto; con cache/error dos clics reemplazaban el GET pendiente. | retrying=isFetching y refetch({cancelRefetch:false}),mismo patrón verificado en comunicaciones. No cambiar QueryError global ni políticas de API. |

**Antes real:** Flutter10 FAILED por null check en primer build; E2E web1 FAILED a320px,innerWidth/scrollWidth672 y2 textos recortados; captura antes conservada. Primer componente Next10 PASS/1 FAILED por GET duplicado. Tras corregir primero la superficie,Chrome detectó todavía scrollWidth811 en768/CSSzoom2 y24 textos recortados:se conservó la condición y se corrigió el shell acotado,no se eliminó el escenario. E2E final1 PASS/19,99s,46 registros. Nuevas escenas de datos y edición:32,0 recortes/overflow en los anchos probados.

El fixture inicial del test Flutter tuvo un problema de implementación del setter late-final de ApiClient y luego del scheduling de interceptores Dio en FakeAsync. Se corrigió el doble de prueba con mocktail declarado y futuro controlado,usando ProfileNotifier real; no actualizar SDK/dependencias ni confundir esos fallos de harness con los del producto. El null check fue reproducido antes de cambiar la condición de la pantalla. Las referencias se inicializaron únicamente cuando el recorrido pasó.

### Archivos

- frontend/lib/features/student/presentation/screens/profile_screen.dart:únicamente condición de loading. Aunque la pantalla sea compartida,no se modifica la carga/subida de firma ni el formulario administrativo.
- frontend-next/src/app/student/profile/page.tsx:retry de consulta,correo/nombre/valores completos,clases locales y wrap de acciones. No cambia PUT ni sus cuatro campos,mutación segura,validación de API,datos académicos bloqueados o fecha de calendario.
- frontend-next/src/app/student/profile/student-profile.module.css:nuevo reflow del perfil por contenedor;sin reglas globales.
- frontend-next/src/components/app-shell.tsx y student-profile-shell.module.css:clases de contenedor/layout/cabecera/nav exclusivamente para pathname exacto /student/profile; no activar en /admin/profile,rutas de certificados,prefijos parecidos u otros módulos.
- frontend-next/src/components/__tests__/phase5b-student-profile.test.tsx:11 casos nuevos,QueryClient real:loading,perfil null,401/403/404/429/500/503 seguros,retry con cache/doble clic,cuatro campos de contacto/payload sin campos administrativos,un solo guardado confirmado y borrador/cancelar tras PUT fallido con GET posterior exitoso.
- frontend-next/src/components/__tests__/phase5b-student-profile-shell.test.tsx:6 casos nuevos de alcance exacto/clases,acciones/navegación conservadas. CSS/píxeles se verifican en Chrome,no en JSDOM.
- frontend-next/src/components/__tests__/phase5b-communications-layers.test.tsx:incluir la nueva ruta de perfil entre las elevadas y mantener prueba negativa con /student/profile-old.18 casos ahora,antes17; no relajar los de comunicaciones.
- frontend/test/core/theme/phase5b_student_profile_reference_test.dart:10 pruebas nuevas con pantalla y ProfileNotifier reales,Dio controlado,fuentes Inter/MaterialIcons offline,AppTheme y TextScaler1/2.24 referencias nuevas;ninguna referencia anterior regenerada.
- backend/tests/test_phase5b_student_profile_browser.py y frontend-next/tests/e2e/phase5b-student-profile-browser.mjs:nuevo wrapper/harness existente y runnerCDP. No backend funcional nuevo.
- docs/ui/fixtures/phase5b-student-profile.json:datos sintéticos example.invalid,nombres explícitos de prueba,fechas fijas y textos largos compartidos;no datos institucionales.
- Documentos:este informe,plan y matriz. Artefactos:docs/ui/evidence/phase5b/student-profile.

### Verificación visual y E2E

[Índice/hash](../ui/evidence/phase5b/student-profile/evidence-index.json),[14 pares anotados](../ui/evidence/phase5b/student-profile/comparison-cases.json),[medidas antes](../ui/evidence/phase5b/student-profile/before-next-measurements.json),[46 registros después](../ui/evidence/phase5b/student-profile/after-next-measurements.json).

Flutter24 PNG:dos temas×loading/error/retry/ausencias y datos/detalle para320/390×TextScaler1/2. El loading es anterior a resolver GET; perfil con profile:null muestra valores No registrado sin inventar información. Correo/textos completos sin ellipsis en los widgets inspeccionados; desplazamiento vertical para llegar a programa y demás datos. Revisión manual de claro320 y pares Next antes/después; no igualar avatar/composición de ambas plataformas.

Next44 PNG posteriores y1 anterior:dos temas×8 combinaciones de ancho/ampliación×datos/edición=32;dos temas×loading/ausencias/403/404/429/503=12. Medir innerWidth,clientWidth,scrollWidth y rectángulos de texto; conservar condición de viewport sin autoescalado y cero recortes en datos y bloqueados/labels. CSS zoom y TextScaler **no equivalen a zoom nativo**,reader ni teclado virtual. No se afirma contraste integral del gradient/iconos ni conformidad global de accesibilidad.

El harness usa PostgreSQL/FastAPI/Next production/Chrome reales con usuarios sintéticos locales. Primero restaura identidad con GET real; solo la consulta de representación del perfil se controla para estados/textos largos. Los errores/ausencias/control de transporte no se presentan como respuestas clínicas reales. Los reintentos liberan GET hacia backend real; verifica403 real al acceder a administradores,cuatro campos editables y0 escrituras al recorrer estados. Al final ejecuta guardado real de teléfono sintético:dos clics=un PUT,GET confirma el valor.401 controlado retira contenido y usa redirección de sesión existente. No seleccionar firmante ni tocar datos clínicos/certificados.

### Gates y comandos

Entorno conservado:Python3.12.15/venv,Node22.22.1/Next16.3.6,PostgreSQL18/loopback55544,Chrome155.0.8059.39,Flutter3.41.6/Dart3.11.4,fuentes/cache locales. Sin instalaciones ni actualizaciones de manifiestos/lockfiles. Directorio de logs y baseline1212 archivos:/tmp/immuno-miguel-tools/phase5b-student-profile. Tres nuevas bases vacías immuno_phase1_student_profile_migration,immuno_phase2_student_profile_migration,immuno_phase4_student_profile_migration para repetir las migraciones existentes;no borrar/reutilizar como vacías las anteriores.

| Gate | Comando / resultado |
|---|---|
| Next focalizado antes/después | npm test -- src/components/__tests__/phase5b-student-profile.test.tsx:antes10 PASS/1 FAILED;después11 PASS. |
| Next completo/BFF | BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test:368 PASS,41 archivos,11,06s. |
| Next lint/typecheck | npm run lint / node node_modules/typescript/bin/tsc --noEmit:PASS. |
| Next build webpack | node node_modules/next/dist/bin/next build --webpack:PASS,26 páginas,compilación2,7s/TypeScript1,849s. Repetido tras finalizar backend/E2E;no modificar .next mientras se sirve. |
| Flutter completo | flutter test --no-pub --reporter expanded:223 PASS,9s,sin update de referencias. |
| Flutter referencias | flutter test --no-pub --reporter expanded test/core/theme/phase5b_student_profile_reference_test.dart:10 PASS sin update,tras inicializar exclusivamente las24 referencias nuevas. |
| Flutter analyze/formato | flutter analyze --no-pub:PASS;dart format --output=none --set-exit-if-changed sobre los dos archivos tocados:PASS,0 cambios. |
| E2E específico | PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a .venv/bin/python -m pytest -q --tb=short --show-capture=no tests/test_phase5b_student_profile_browser.py:1 PASS,6 warnings,19,99s. |
| Ruff / Node | .venv/bin/python -m ruff check tests/test_phase5b_student_profile_browser.py y node --check tests/e2e/phase5b-student-profile-browser.mjs:PASS. |
| Backend/PostgreSQL completo | Comando siguiente:400 PASS,0 SKIP,51 warnings,370,59s. Doce E2E y tres migraciones existentes en bases nuevas vacías. |

Flutter usa FLUTTER_SUPPRESS_ANALYTICS=true,PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache y ejecutable /tmp/immuno-miguel-tools/flutter/bin/flutter. npm focalizado necesitó ejecución fuera del sandbox tras bloqueo de proceso;no se instalaron paquetes. No publicar logs del servidor ni tokens. Para repetir migraciones crear otras tres bases vacías,con prefijos requeridos:

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_student_profile_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_student_profile_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_student_profile_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Límites y siguiente comprobación P03

**B5-P03 PARTIAL:** este bloque no cierra refresh de perfil con datos anteriores ni PUT→GET posterior fallido. Por inspección,Flutter muestra error principal solo si profile==null y conserva el mapa anterior al fallar una recarga;Next sustituye ProfileView por QueryError y desmonta su estado local si la consulta falla. Falta probar explícitamente401/403/503 durante edición/refresco y tras escritura,el aviso seguro correspondiente y conservación del borrador sin presentar datos como recién verificados. No afirmar fallo entre usuarios ni filtración:autenticación/interceptores y propietario de cache de Fase2 no se modifican. Estos recorridos requieren un bloque con pruebas específicas;un PUT confirmado o un error inicial no los demuestra.

No declarar paridad integral de S08/S22 ni del perfil administrativo/firmas. UI-16/UI-17 permanecen BLOCKED;lectores,zoom real,teclado/dispositivos y contraste global UNKNOWN. C02/A07 UNKNOWN;T-02/T-03 PARTIAL y almacenamiento real pendiente. No producción lista ni commit.

### Riesgos y rollback

Las container queries cambian disposición únicamente cuando falta espacio en el perfil estudiante;la cabecera compacta conserva logo,botón de tema y menú con aria-label,las mismas rutas y controles. Otros módulos conservan sus clases anteriores;tests de rutas parecidas protegen el alcance. Retirar truncado aumenta altura:debe poder desplazarse hasta los campos y acciones. No ocultar contenido con overflow:hidden ni achicarlo para hacer pasar una medida.

Rollback:restaurar ProfileScreen,student/profile/page.tsx y AppShell desde /tmp/immuno-miguel-tools/phase5b-student-profile/backup;retirar conjuntamente imports/usos de los dos módulos CSS nuevos. Si se revierte la nueva ruta elevada,restaurar también el test de capas desde su copia,conservando pruebas/evidencia preventiva. No git reset global,ni revertir C01–C06/fases anteriores. **Migraciones nuevas:ninguna**;sin rollback de datos productivos. Pruebas/artefactos solo sintéticos locales.

### Revisión final P01/P02

**P01 DONE;P02 DONE en estados/reflow/retry probados;P03 PARTIAL;S08/FASE5B PARTIAL.** Backend/PostgreSQL400 PASS,0 SKIP,51 warnings,370,59s;Next368 PASS/lint/typecheck/webpack PASS;Flutter223 PASS/analyze/formato PASS. La suite incluye doce E2E,el nuevo perfil con46 registros y las tres pruebas de migración existentes. Los51 warnings son deprecaciones noload/FCM existentes;no se ocultaron ni cambiaron dependencias. No omisiones ni fallos críticos presentados como PASS.

Baseline1212 archivos:solo tres fuentes funcionales existentes modificadas(FlutterProfileScreen,NextProfilePage,AppShell),un test existente actualizado de manera explícita para la nueva ruta elevada;dos CSS locales y cinco archivos nuevos de pruebas. Fixture de perfil sintético compartido,tres documentos actualizados. No cambios de backend funcional,contratos,migraciones,dependencias/lockfiles,autenticación de Fase2,PDF/QR o clínica;ningún archivo anterior eliminado. Se revisaron git diff,diffs incrementales,fuentes nuevas,formato y git diff --check(PASS). Escaneo limitado de patrones de secretos de alta confianza en los once archivos de código/test nuevos o tocados:0 coincidencias;no auditoría universal. Enlaces nuevos comprobados.

69 PNG nuevos(24 Flutter,44 Next posteriores,1 Next anterior),dos JSON de mediciones y casos/índice. La ejecución integrada volvió a producir evidencia web anterior;actualizados sus hashes conservando procedencia y limitaciones.732 referencias SHA-256 verificadas,0 ausentes/desajustes;ninguna referencia Flutter anterior modificada. La evidencia anterior conserva el fallo de autoescalado672 frente a320;la ejecución final conserva todas las condiciones de reflow y espera al transporte retenido antes de comprobar deduplicación.

P03 sigue pendiente de regresiones para GET fallido con datos previos/edición y PUT→GET posterior fallido;no se infiere cierre desde el guardado exitoso. S22 no validado por este bloque. Lectores/zoom real/teclado/dispositivos y contraste global UNKNOWN;C02/A07 UNKNOWN;UI-16/UI-17 BLOCKED;T-02/T-03 PARTIAL y almacenamiento real pendiente. Sin producción lista ni commit.

## Continuación — P03 recuperación de perfil y borrador

Fecha:2026-10-19 America/Bogota. **P03 DONE en recorridos probados;FASE5B PARTIAL.** E2E finales de perfil sobre build final:2 PASS/37,52s. Skills locales ui-parity,quality-gates y security-health,AGENTS.md,matriz/plan y código/tests inspeccionados antes de editar. No backend funcional,contratos,reglas clínicas,autorización ni protocolo de sesión de Fase2. No cerrar S22/firmas ni UI-16/UI-17 por este bloque.

### Causas demostradas

| Hallazgo / prioridad | Causa raíz | Solución |
|---|---|---|
| P03a / P2 — refresh silencioso Flutter | El error principal solo se mostraba cuando profile==null. GET fallido con datos anteriores dejaba cuerpo/editar visibles. | Mostrar error y retirar cuerpo/acciones ante error de consulta;guardar controllers en memoria de la vista para recuperación del borrador. Códigos401/403/404/429 tienen texto seguro;otros fallos mantienen Error al cargar perfil. Nunca renderizar diagnóstico del response body. |
| P03b / P2 — borrador perdido Next | ProfilePage devolvía QueryError antes de ProfileView;su desmontaje eliminaba editing/form y callbacks activos. | Con cache conservar ProfileView montado/key=user.id,pero devolver solo feedback y QueryError cuando falla GET. No datos/formulario/editar visibles hasta recuperar consulta. Sin cache conservar LoadingState/QueryError existentes. |
| P03c / P2 — PUT confirmado confundido con GET fallido | Flutter descartaba response PUT,await GET y luego copyWith(isSaving:false) borraba el error. Next emitía toast success pese a fallo del refetch y volvía a invalidar redundante. | Distinguir recepción exitosa de PUT del resultado de GET. Flutter conserva User de PUT y saveConfirmed,error/saveError separados;no borrar error al terminar. Next observa el resultado del refresh existente de useSafeMutation y muestra aviso explícito si falló. Retirar solo invalidación duplicada local;helper global intacto. Retry de consulta nunca repite PUT. |
| P03d / P2 — PUT fallido sin feedback persistente | Flutter reutilizaba error de consulta que quedaba oculto con profile previo. Next usaba solo toast y podía desmontar el borrador durante GET de onError. | saveError separado Flutter y writeError local Next,mensaje seguro visible;mantener borrador tras GET recuperado y exigir Guardar explícito. Sin almacenar draft fuera de la vista ni exponer body de error. |
| P03e / P2 — carreras de lectura/escritura | GET anterior podía seguir ocupando la ranura de lectura después de iniciar PUT;en PUT fallido persistía isLoading de esa lectura. | Invalidar secuencia/ranura de GET al iniciar PUT,liberar loading en fallo y coalescer retry normal;afterWrite inicia lectura nueva. Respuestas antiguas y provider disposed no aplican datos. No cancelar retroactivamente HTTP aceptados. |
| P03f / P2 — borrador cancelado reaparece con profile:null | _populateFields no hacía nada si la nueva respuesta ya no tenía perfil;los controllers retenían datos de una edición abandonada. | Al iniciar una edición explícita rellenar todos los controllers con datos actuales o vacíos. No rellenarlos en background mientras el usuario edita. Regresión FAILED antes/PASS después;no enviar campos ni inferir datos borrados. |

Datos de API inspeccionados:GET /users/me y PUT /users/me/profile declaran UserResponse;PUT exitoso ya devuelve User. No endpoint ni campo contractual nuevo. Los nuevos flags son estado de representación local. Los cuatro campos de contacto del estudiante y first_name/last_name/job_title administrativos condicionales conservan payload/permisos existentes;firma y selección de firmante no se modifican.

### Implementación

- frontend/lib/features/student/presentation/screens/profile_screen.dart:ProfileState añade saveError/saveConfirmed opcionales;notifier conserva errores de lectura,resultado recibido de PUT,coalescencia y secuencia;body/error/editar/feedback no presenta datos como verificados ante GET fallido. Cancelar bloqueado durante escritura y _saveProfile comprueba formulario,busy,owner y mounted antes de callbacks. Rellenado al iniciar edición limpia ausencias. Flujo de firma sin cambios,helper de mensajes de firma existente intacto.
- frontend-next/src/app/student/profile/page.tsx:ProfileView persiste con error de lectura conservando hooks/draft;feedback de PUT separado,QueryError mantiene retrying/cancelRefetch:false,Alert de fallo de escritura. No cambia API,safe-mutation global,cache de sesión ni CSS del bloque previo.
- El aviso Next se vincula a dataUpdateCount del estado de query existente:una lectura exitosa lo retira incluso cuando structural sharing devuelve el mismo objeto. No mostrar aviso antiguo ante un fallo posterior independiente. Un efecto inicial que llamaba setState fue rechazado por lint y eliminado,sin desactivar la regla. El contador pertenece a la versión instalada de TanStack,no al contrato FastAPI ni a una regla de dominio.
- Sin nombre/correo/contacto en URLs,logs o metadatos de capturas. Solo memoria de la vista/cache ya existente;sin nueva persistencia. Un cambio de propietario conserva los controles existentes de useSafeMutation/provider por identidad;no extender derechos por UI.

### Pruebas nuevas y evidencia

- frontend-next/src/components/__tests__/phase5b-profile-recovery.test.tsx:12 casos. GET401/403/503 con datos previos×lectura/edición,datos/acciones retirados y borrador recuperado;PUT confirmado+GET403/503 sin reenviar al reintentar;PUT fallido+GET fallido con guardado posterior explícito;retiro del aviso tras lectura de datos idénticos;GET anterior descartado;cambio de owner no aplica resultado/toast/cache del anterior. QueryClient y helper de mutación reales,API controlada.
- frontend/test/core/theme/phase5b_profile_recovery_test.dart:17 casos con pantalla/ProfileNotifier reales y Dio controlado. GET401/403/503×lectura/edición,borrador+deduplicación de retry;PUT confirmado/GET403/503 en ambos temas;PUT fallido/GET denegado en ambos temas;profile:null tras cancelar;datos PUT y error conservados;GET previo/PUT fallido y loading liberado;respuesta antigua no retira denegación;dispose ignora pendientes. Cancelar deshabilitado durante PUT. Seis nuevas referencias aisladas390×844;ninguna referencia anterior actualizada.
- backend/tests/test_phase5b_profile_recovery_browser.py y frontend-next/tests/e2e/phase5b-profile-recovery-browser.mjs:harness de FastAPI/PostgreSQL/Next production/Chrome existente.11 registros:dos temas×GET403/503 con borrador;dos temas×PUT real confirmado seguido de GET403/503;dos temas×PUT503 controlado/GET403 y posterior PUT real explícito;401 final usa expiración existente. Verificar403 administrativo real,cuatro claves de contacto,GET retry sin PUT,doble submit y lectura posterior confirmada. Solo datasets sintéticos locales.

[Seis pares anotados](../ui/evidence/phase5b/profile-recovery/comparison-cases.json),[11 registros web](../ui/evidence/phase5b/profile-recovery/next-measurements.json),[índice/hash](../ui/evidence/phase5b/profile-recovery/evidence-index.json).16 PNG nuevos(6 Flutter,10 Next),un JSON de medidas más casos/índice. Mismo resultado de guardado recibido y error seguro;no igualdad de píxeles. Revisadas capturas oscuras de PUT confirmado+GET403 y correspondencia web/nativa.

Antes:Next7 FAILED/4 PASS en11 casos iniciales,Flutter12 FAILED en12 casos iniciales;no se cuentan como PASS. Tras corrección primera ejecución focalizada22 PASS Next(11 nuevos+11 anteriores) y12 PASS Flutter. Se añadieron pruebas de concurrencia,profile:null y retiro de aviso;totales finales12 nuevas Next/17 Flutter. Flutter tuvo una activación fuera de pantalla en el harness;se añadió ensureVisible/pump antes de pulsar Guardar,no warnIfMissed:false ni relajación de criterios. Alias setter de ApiClient/fuentes ya resueltos en bloque previo,no nuevas dependencias. Los avisos de braces/import innecesario de analyze se corrigieron,sin suprimir reglas.

### Gates ejecutados

Entorno conservado:Python3.12.15/venv,Node22.22.1/Next16.3.6,PostgreSQL18/loopback55544,Chrome155.0.8059.39,Flutter3.41.6/Dart3.11.4. Sin instalaciones ni actualizaciones de SDK/manifiestos/lockfiles. Baseline1293 archivos/logs/copias del bloque:/tmp/immuno-miguel-tools/phase5b-profile-recovery. Tres nuevas bases vacías para migraciones existentes;no eliminar/reutilizar como vacías las anteriores.

| Gate | Comando / resultado |
|---|---|
| Next tests/BFF | BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test:380 PASS,42 archivos,12,81s. |
| Next lint/typecheck | npm run lint / node node_modules/typescript/bin/tsc --noEmit:PASS. Lint inicial detectó setState en efecto;estado derivado corrige el problema. |
| Next webpack | node node_modules/next/dist/bin/next build --webpack:PASS,compilación2,8s/TypeScript1,864s,26 páginas;después de terminar backend para no alterar .next durante E2E. |
| Flutter completo | flutter test --no-pub --reporter expanded:240 PASS,10s,sin actualización de referencias. |
| Flutter analyze/formato | flutter analyze --no-pub:PASS,2,9s;dart format --output=none --set-exit-if-changed sobre los dos archivos:PASS,0 cambios. |
| Flutter nuevas referencias | Inicializar solo este archivo:4 imágenes nuevas,después solo el filtro failed PUT is visible para2 imágenes adicionales;posterior suite normal240 PASS verifica las seis y todas las anteriores. |
| E2E específico inicial | PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a .venv/bin/python -m pytest -q --tb=short --show-capture=no tests/test_phase5b_profile_recovery_browser.py:1 PASS,17,70s,6 warnings. |
| Backend/PostgreSQL completo | Comando siguiente:401 PASS,0 SKIP,51 warnings,396,91s;trece E2E y tres migraciones existentes. |
| E2E final | Mismas variables del E2E específico + .venv/bin/python -m pytest -q --tb=short --show-capture=no tests/test_phase5b_profile_recovery_browser.py tests/test_phase5b_student_profile_browser.py:2 PASS,6 warnings,37,52s sobre build final del aviso derivado. |
| Ruff / Node | .venv/bin/python -m ruff check tests/test_phase5b_profile_recovery_browser.py y node --check tests/e2e/phase5b-profile-recovery-browser.mjs:PASS. |

Los comandos Flutter usan FLUTTER_SUPPRESS_ANALYTICS=true,PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache y ejecutable /tmp/immuno-miguel-tools/flutter/bin/flutter. Inicialización de referencias limitada al archivo nuevo;no cambiar referencias de P01/P02/C06 para aceptar regresiones. Los51 warnings de la suite son deprecaciones noload/FCM existentes,no ocultadas ni resueltas cambiando dependencias.

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_profile_recovery_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_profile_recovery_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_profile_recovery_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos,límites y rollback

Conservar borrador significa mantenerlo en memoria de la misma vista/sesión mientras un error de consulta se resuelve. No prometer recuperar borrador tras logout,expiración real,cambio de cuenta,recarga de página o cierre de app. Las pruebas unitarias401 omiten interceptores para aislar representación;el E2E401 sí demuestra retirada de contenido/redirección con Fase2 existente. Provider disposed/owner distinto ignoran finalizaciones,no cancelan retroactivamente una escritura aceptada por FastAPI. No se incorpora idempotency key ni nuevo protocolo de auth.

Confirmado significa respuesta exitosa de PUT recibida;un timeout sin respuesta no permite demostrar qué ocurrió en servidor. No declarar no aplicado en base de datos por un fallo de transporte. Reintentar una consulta sigue siendo solo GET,para evitar repetir escrituras por fallo de recarga. No dar por actual la cache ante denegación aunque PUT haya sido confirmado antes.

Flutter comparte pantalla/notifier entre roles:los cambios de errores/busy/rellenado se aplican a esa implementación;la firma visual y sus endpoints no se modifican. Next administrativo permanece fuera del bloque. S22,lectores/zoom real/teclado/dispositivos y contraste global no se cierran por estas pruebas de estudiante. Tampoco UI-16/UI-17,T-02/T-03,almacenamiento real,C02/A07 ni otras pantallas pendientes.

Rollback:restaurar únicamente ProfileScreen Flutter y student/profile/page.tsx Next desde /tmp/immuno-miguel-tools/phase5b-profile-recovery/backup;conservar las pruebas/evidencia como prevención y no revertir correcciones P01/P02/C01–C06 ni fases anteriores. Sin git reset global. **Migraciones nuevas:ninguna**;sin rollback de datos productivos. No Maps,Azure,PDF/QR,stores ni commit. Fase5B sigue PARTIAL,no producción lista.

### Revisión final P03

**P03 DONE en recorridos documentados;FASE5B PARTIAL.** Backend/PostgreSQL401 PASS,0 SKIP,51 warnings,396,91s;trece E2E y tres migraciones existentes. Next380 PASS/lint/typecheck/webpack PASS;Flutter240 PASS/analyze/formato PASS. Después del ajuste del aviso a estado derivado y del build final,se repitieron el E2E P03 y el anterior P01/P02:2 PASS,37,52s. La suite completa de backend había usado el build anterior del aviso;el refuerzo final comprueba ambas rutas de perfil afectadas sobre el artefacto final,sin atribuirlo a una repetición completa innecesaria de migraciones/backend. Código backend y el resto de páginas sin cambios.

Baseline1293 archivos:dos fuentes funcionales existentes modificadas(Next perfil estudiante y Flutter pantalla/notifier compartido);cuatro archivos nuevos de tests(componentes Next,Flutter,wrapper Python,runnerCDP),tres documentos y19 artefactos nuevos(16 PNG,mediciones/casos/índice). Ningún archivo anterior borrado. Sin cambios de contratos,backend funcional,migraciones,dependencias/lockfiles,auth de Fase2,CSS,AppShell,PDF/QR,Maps,Azure o firmas. Revisión de git diff,diffs incrementales y fuentes nuevas;git diff --check PASS,formato0 cambios. Escaneo limitado de patrones de secretos de alta confianza en los seis archivos de fuente/test:0 coincidencias;no auditoría universal.

750 referencias SHA-256 comprobadas,0 ausentes/desajustes;se actualizaron índices de evidencia web anterior regenerada por las suites,preservando procedencia/límites. Ninguna golden Flutter anterior modificada. Referencias P01/P02 y C06 pasan sin regeneración. Capturas de error confirmado/denegación y sus pares revisadas;datos únicamente sintéticos,metadatos sin identificadores/cookies/tokens/contactos.

S08 sigue PARTIAL como paridad integral y S22 no se cierra. Lectores/zoom real/teclado/dispositivos/contraste global UNKNOWN;C02/A07 UNKNOWN;UI-16/UI-17 BLOCKED;T-02/T-03 PARTIAL y almacenamiento real pendiente. No restaurar borradores a otra cuenta ni después de expiración real. Sin producción lista ni commit.

## Continuación — E01 selección y envío de evidencias

Fecha:2026-10-19,America/Bogota. **E01 DONE en recorridos probados;FASE5B PARTIAL.** Referencias:S06/selección de EvidenceUploadScreen Flutter y student/evidence Next,contratos FastAPI existentes. Leídos AGENTS y skills locales ui-parity,quality-gates,security-health. Sin reglas clínicas,backend funcional,contratos,auth de Fase2,PDF/QR,Maps,Azure,stores ni commit.

### Hallazgos y causa raíz

| ID / prioridad | Causa raíz / archivos / función | Impacto | Solución acotada |
|---|---|---|---|
| B5-E01a / P2 | student/evidence/page.tsx:EvidencePage renderiza File[] sin acción individual;la key name+size puede repetirse. Flutter ya permite quitar archivos. | Para quitar un archivo Next obliga a volver a seleccionar todos;dos archivos distintos con mismo nombre/tamaño comparten key. | Botón nativo Quitar por ocurrencia,fuera de la mutación;key por posición para estas filas sin estado propio. Reiniciar input nativo manteniendo File[] como borrador,para seleccionar nuevamente el mismo archivo. No deduplicar ni crear nuevas reglas de aceptación. |
| B5-E01b / P2 | Next solo deshabilitaba input/notas/enviar;dose/dropzone seguían activos. Flutter solo deshabilitaba enviar. Formularios de selección no estaban vinculados por completo a isPending/isUploading. | Ediciones durante POST pueden parecer parte de la carga y perderse al recibir éxito. | Congelar selector,quitar,asociación,notas y envío durante escritura. Next pasa copia de archivos/notas/dose como variables de mutación;Flutter copia lista al llamar al notifier. Se conservan guards de doble escritura existentes. |
| B5-E01c / P2 | evidence_upload_screen.dart:_pickFiles esperaba al plugin sin mounted,exclusión del picker ni generación del envío. | Respuesta tardía puede cambiar selección después de enviar,incluso con la carga ya terminada,o intentar setState tras dispose. | Picker único;mounted+epoch de selección+isUploading al retornar;epoch cambia al iniciar envío. Cancelación conserva borrador,fallo del plugin muestra mensaje fijo y finally libera el control. Sin volcar error/ruta del archivo. |
| B5-E01d / P2 | Input PDF Next carecía de nombre accesible;Flutter usaba GestureDetector sin semántica de botón y quitar sin tooltip. | Selección/retirada difíciles de identificar con ayudas técnicas. | aria-label,button nativo Quitar con nombre,Semantics+InkWell Flutter y tooltip. Caja Flutter conserva dimensiones,colores,tipografía y decoración existentes. No afirmar prueba de TalkBack/VoiceOver ni teclado nativo real. |

### Archivos y pruebas

Archivos funcionales:frontend-next/src/app/student/evidence/page.tsx y frontend/lib/features/student/presentation/screens/evidence_upload_screen.dart. Sin tocar datasources,providers,API ni validadores. FastAPI sigue validando PDF y permisos;el filtro del selector no sustituye validación de servidor. Imágenes históricas conservan su representación,no se elimina funcionalidad de descarga/borrado ni se altera reviewed.

- frontend-next/src/components/__tests__/phase5b-evidence-selection.test.tsx:6 casos nuevos;quitar la segunda ocurrencia de mismo nombre/tamaño conservando bytes de la primera;quitar último/reseleccionar;nombres accesibles;POST pendiente y éxito/fallo;borrador conservado tras fallo;drop reemplaza selección sin ejecutar mutación. QueryClient/useSafeMutation reales,API controlada. Los6 fallaron antes del cambio;tras corrección10 PASS al sumar4 tests de evidencia5A existentes.
- frontend/test/core/theme/phase5b_evidence_selection_test.dart:13 casos nuevos con pantalla/EvidenceNotifier reales y datasource/plugin controlados. Retirada/reselección;bloqueo de controles y doble submit;éxito/fallo;borrador;picker único/cancelación;resultado tardío durante/después de POST;dispose;error seguro del plugin;cuatro referencias nuevas de selección/envío×claro/oscuro. El plugin de pruebas no estaba inicializado y el finder de tooltip devolvía RawTooltip;se corrigió el harness,sin relajar el control funcional.
- backend/tests/test_phase5b_evidence_selection_browser.py + frontend-next/tests/e2e/phase5b-evidence-selection-browser.mjs:Chrome→build webpack→BFF→FastAPI→PostgreSQL local. Dos temas,Enter quita sin POST,doble submit escribe una vez,todos los controles congelados,drop tardío ignorado,lectura real confirma archivos/notas/asociación,POST503 controlado conserva borrador y reintento explícito llega al servidor. Consulta administrativa del estudiante403 real. El harness confirma que la dosis sigue in_review;no revisión ni aprobación implícita. Cuatro registros sin PII/tokens/IDs en metadatos. Son payloads PDF sintéticos mínimos para el contrato de upload existente,no prueba de renderizado/validez documental de un PDF institucional.

### Comparación visual

[Casos pareados](../ui/evidence/phase5b/evidence-selection/comparison-cases.json),[mediciones de flujo](../ui/evidence/phase5b/evidence-selection/next-measurements.json),[índice SHA-256](../ui/evidence/phase5b/evidence-selection/evidence-index.json). Cuatro referencias Flutter390×844;cuatro capturas web recortadas a la tarjeta completa de nueva carga con viewport390×844. Se conserva orden de controles de cada plataforma;no igualdad de píxeles. Flutter referencia con carga general y archivo de6 bytes;Next con dosis del catálogo sintético,archivo de33 bytes y paginación real;esas diferencias de fixture se declaran,no se consideran diferencias clínicas ni se ocultan como datos idénticos. Ningún archivo institucional usado.

### Gates

Entorno conservado:Python3.12.15/venv,Node22.22.1/Next16.3.6,PostgreSQL18/127.0.0.1:55544,Chrome155.0.8059.39,Flutter3.41.6/Dart3.11.4. Sin instalaciones ni cambios de dependencias/manifiestos/lockfiles. Baseline1316 archivos y copias del bloque:/tmp/immuno-miguel-tools/phase5b-evidence-selection/before. Tests y logs en ese mismo directorio temporal.

| Gate | Resultado observado |
|---|---|
| Next tests/BFF | 386 PASS,43 archivos,12,17s. BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test. |
| Next lint/typecheck | npm run lint;node node_modules/typescript/bin/tsc --noEmit:PASS. |
| Next producción | node node_modules/next/dist/bin/next build --webpack:PASS,compilación3,2s/TypeScript2,1s/26 páginas;artefacto usado por el E2E. |
| Flutter tests completos | 253 PASS,11s,sin regenerar referencias. |
| Flutter analyze/formato | analyze final:PASS,3,2s;formato de los dos archivos:0 cambios. Se corrigieron seis avisos iniciales,sin desactivar reglas. |
| Nuevas referencias Flutter | flutter test --no-pub --update-goldens test/core/theme/phase5b_evidence_selection_test.dart:13 PASS;solo cuatro goldens nuevas. Suite normal posterior valida todas las anteriores. |
| E2E específico inicial | 1 PASS,6 warnings,4,78s;ejecutado sobre build webpack real. Capturas iniciales de viewport no mostraban todos los controles;el runner final recorta tarjeta completa para la comparación. |
| Backend/PostgreSQL completo | 402 PASS,0 SKIP,51 warnings,394,93s;14 E2E,concurrencia y tres bases inicialmente vacías para migraciones existentes. Incluye runner final con captura de tarjeta completa,sobre el mismo build webpack verificado. |
| Ruff / Node | ruff check del wrapper Python / node --check del runner nuevo:PASS. |

Comandos Flutter con FLUTTER_SUPPRESS_ANALYTICS=true,PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache y ejecutable /tmp/immuno-miguel-tools/flutter/bin/flutter;tests --no-pub --reporter expanded y analyze --no-pub. Tests de Next/Flutter requieren ejecutar fuera del sandbox para descriptores/sockets locales;primera tentativa Next falló por ese límite y se repitió con permiso,no se contabiliza como éxito.

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_evidence_selection_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_evidence_selection_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_evidence_selection_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos,pendientes y rollback

E01 solo cierra selección local/controles durante envío en recorridos probados. No es una idempotency key;el reintento explícito tras error de transporte sin respuesta no demuestra si el servidor recibió la primera escritura. No cancelar retroactivamente una carga ya aceptada por backend. El borrador vive en memoria de la vista;sin persistencia entre logout,cuentas o recarga. Lector/teclado virtual/zoom/dispositivo nativos UNKNOWN;no cerrar accesibilidad global por aria-label o capturas.

**B5-E02 PARTIAL,pendiente funcional separado:** EvidenceNotifier.upload espera loadBatches y después copyWith(successMessage) puede limpiar el error de GET posterior al POST;la vista carece de recuperación independiente de esa lectura. La selección congelada no resuelve ese resultado ambiguo de refresco. Diseñar prueba POST confirmado→GET fallido→reintentar solo GET,sin volver a cargar archivos;distinguir error de consulta de fallo de escritura y mantener el contexto solo dentro de la misma sesión. No afirmar S06 completo. Otras combinaciones de estado/paginación/responsive/temas de evidencias siguen en inventario.

Rollback:restaurar exclusivamente las dos pantallas desde /tmp/immuno-miguel-tools/phase5b-evidence-selection/before,conservar pruebas como prevención y documentación de lo revertido. No git reset global ni revertir bloques previos. **Migraciones nuevas:ninguna**;solo bases sintéticas locales nuevas para verificar migraciones existentes. Sin operaciones sobre datos productivos. C02/A07 UNKNOWN,UI-16/UI-17 BLOCKED por alcance,T-02/T-03 PARTIAL y almacenamiento real pendiente. Fase5B PARTIAL,sin producción lista ni commit.


### Revisión final E01

**B5-E01a/E01b/E01c/E01d DONE en el alcance probado;FASE5B PARTIAL.** Backend/PostgreSQL402 PASS/0 SKIP,51 warnings,394,93s;14 E2E y tres migraciones existentes. Next386 PASS/lint/typecheck/webpack PASS;Flutter253 PASS/analyze/formato PASS. El gate integrado final incluye las capturas recortadas de tarjeta completa;se revisaron los pares claro/oscuro de selección/envío. Los51 warnings son deprecaciones existentes noload/FCM,no se ocultan ni se cambian dependencias para silenciarlos.

Frente al baseline de1316 archivos:solo dos fuentes funcionales modificadas,pantallas de evidencia Flutter y Next;cuatro nuevos archivos de tests,tres documentos actualizados y11 artefactos nuevos(8 PNG,casos,mediciones,índice). Las suites regeneraron evidencia web anterior y se refrescaron sus índices SHA-256 conservando procedencia/notas. Ningún archivo anterior eliminado,ninguna golden Flutter anterior modificada. Sin backend funcional,API,core/auth,migraciones,dependencias/lockfiles o ámbitos excluidos cambiados.

Revisados git diff y diff incremental frente a baseline;git diff --check PASS,formato0 cambios,Ruff y node --check PASS. Escaneo limitado de patrones de secretos de alta confianza en seis archivos fuente/test:0 coincidencias;no auditoría universal.760 referencias SHA-256 verificadas,0 ausentes/desajustes. Metadatos nuevos solo sintéticos,sin IDs de dosis/usuarios,cookies,tokens,nombres personales o rutas de archivos seleccionados.

**B5-E02 PARTIAL** requiere un bloque separado para lectura posterior a carga confirmada. S06 sigue PARTIAL como pantalla integral;C02/A07 UNKNOWN,lectores/zoom/teclado/dispositivos nativos UNKNOWN,UI-16/UI-17 BLOCKED por alcance,T-02/T-03 PARTIAL y almacenamiento real pendiente. No producción lista ni commit.

## Continuación — E02 resultado de carga y recuperación de evidencias

Fecha: 2026-10-19, America/Bogota. **E02 DONE en recorridos probados; FASE 5B PARTIAL.**

Alcance: separar la recepción exitosa de POST del resultado del GET posterior; recuperar la consulta sin volver a enviar archivos. FastAPI conserva negocio, validaciones, permisos y contratos. Leídos AGENTS.md y skills locales ui-parity, quality-gates y security-health. Sin cambios clínicos, backend funcional, autenticación, PDF/QR, Maps, Azure, stores ni commit.

### Hallazgos, causa raíz y solución

| ID / prioridad | Archivo / función | Causa raíz / impacto | Solución / estado |
|---|---|---|---|
| B5-E02a / P2 | Flutter evidence_provider.dart: EvidenceState, upload y loadBatches | error combinaba consulta y operaciones. Tras POST confirmado, loadBatches capturaba el fallo de GET y upload.copyWith limpiaba error al establecer éxito. La vista podía mostrar datos antiguos o vacío sin recuperación independiente. | loadError y uploadError separados, uploadConfirmed solo si POST fue recibido exitosamente y GET falló. Se conserva error como campo compatible para consumidores existentes. Error de lectura retira formulario/lista/acciones antiguas; retry solo GET, sin reenviar. |
| B5-E02b / P2 | Flutter evidence_upload_screen.dart: build y _upload | Snackbar de éxito no distinguía fallo del refresco; no había retry para esa lectura. | Aviso persistente y snackbar distinguen carga confirmada de lista no actualizada. Carga confirmada limpia selección/notas; carga sin confirmación conserva borrador. Error de consulta muestra mensaje seguro y control de recuperación, sin lista vacía falsa. |
| B5-E02c / P2 | Next student/evidence/page.tsx: upload.onSuccess y rama error | useSafeMutation ya esperaba la invalidación, pero el callback mostraba éxito incondicional y repetía invalidateQueries. Retry sin estado busy podía cancelar/reiniciar consultas repetidas. | Se consulta el estado de la query después del refresco existente, se elimina solo la invalidación redundante de upload y se conserva aviso confirmado/no confirmado. Retry con cancelRefetch:false e isFetching; no cambia helper global. |
| B5-E02d / P2 | Flutter loadBatches y Next aviso de confirmación | Retry concurrente podía crear varios GET; Flutter tomaba página de la última respuesta exitosa y perdía el destino fallido. Un aviso persistente sin versión de lectura podría reaparecer tras un fallo posterior independiente. | Flutter comparte GET de mismo destino, recuerda página solicitada y retira slot anterior al escribir; secuencia ignora respuestas antiguas. GET exitoso retira confirmación. Next vincula aviso a página+dataUpdateCount, incluyendo lecturas con objeto idéntico. No coordinación entre pestañas ni cambio de política clínica. |
| B5-E02e / P2 | Flutter upload.catch | Solo DioException finalizaba el estado de error; fallo local de preparación podía escapar sin liberar la representación de carga. | Capturar fallo local/HTTP sin diagnóstico crudo, liberar isUploading, conservar borrador y comunicar resultado no confirmado. Se mantienen mensajes de validación del contrato para400/409/422. No incorporar nueva validación de PDF. |

### Archivos

Funcionales:

- frontend/lib/features/student/presentation/providers/evidence_provider.dart: estado aditivo local, consultas coordinadas, resultado confirmado separado y mensajes seguros.
- frontend/lib/features/student/presentation/screens/evidence_upload_screen.dart: error de lectura independiente, recuperación GET, feedback y borrador.
- frontend-next/src/app/student/evidence/page.tsx: aviso versionado de confirmación, fallo de carga persistente y retry de consulta coordinado. Las mutaciones de borrado/descarga, estados y payloads clínicos no cambian.

Tests nuevos: frontend-next/src/components/__tests__/phase5b-evidence-recovery.test.tsx; frontend/test/core/theme/phase5b_evidence_recovery_test.dart; backend/tests/test_phase5b_evidence_recovery_browser.py; frontend-next/tests/e2e/phase5b-evidence-recovery-browser.mjs. En el runner E01 se retiró únicamente un helper button sin uso detectado por lint; sin modificar sus aserciones, peticiones o comportamiento.

### Pruebas y comparación visual

- Next:9 pruebas nuevas. POST confirmado+GET401/403/404/429/500/503, ocultación de datos previos/empty falso, retry doble comparte GET, misma página2/tamaño20 y cero POST de recuperación; POST fallido+GET fallido conserva borrador y resultado, siguiente upload requiere acción explícita; lectura idéntica retira aviso antiguo; respuesta anterior a escritura no reemplaza lectura nueva. QueryClient y useSafeMutation reales, API controlada. Antes8 FAIL/1 PASS; tras cambio19 PASS con10 regresiones de evidencia5A/E01.
- Flutter:15 pruebas nuevas con pantalla/EvidenceNotifier reales y datasource/FilePicker controlados. Seis códigos de GET, estado de confirmación, formulario/lista retirados ante error, borrador, retry compartido, página fallida conservada, slot previo a escritura, finalización tras dispose, aviso antiguo, error local seguro, validación400 conservada y dos nuevas referencias claro/oscuro. Antes8 FAIL/4 PASS en los12 casos iniciales; después se añadieron3 casos. Se corrigieron un constructor Semantics indebidamente const y un finder de retry cuyo texto cambia al cargar. Sin desactivar asserts, reglas ni actualizar referencias antiguas.
- E2E real: login estudiante;4 cargas reales (2 temas×GET403/503 controlado), doble submit produce una sola carga; error retira formulario y acciones; retry doble produce un solo GET, conserva page2 y no repite POST; consulta real acotada verifica archivo/asociación en PostgreSQL. Dos casos adicionales de POST503 controlado+GET403 conservan archivos/notas/dosis y permiten un POST real posterior solo por acción explícita. Consulta administrativa403 real; GET401 final usa expiración existente y retira contenido protegido. El harness comprueba que la dosis sigue in_review. No implica aprobación clínica.

[Dos pares anotados](../ui/evidence/phase5b/evidence-recovery/comparison-cases.json), [7 casos web](../ui/evidence/phase5b/evidence-recovery/next-measurements.json), [índice SHA-256](../ui/evidence/phase5b/evidence-recovery/evidence-index.json).8 PNG nuevos:2 Flutter y6 Next. Ambos viewports390×844, con shells y mensajes apropiados a cada plataforma; no igualdad de píxeles. Flutter recibe datos controlados; Next carga realmente sobre PostgreSQL local y controla solo los fallos indicados. Los dos pares de GET503 claro/oscuro fueron revisados. No copiar logo, colores o reglas clínicas por esta corrección.

La prueba nativa de POST sin confirmar provoca una lectura fallida posterior de forma explícita; Next conserva el refresco tras error de useSafeMutation. No afirmar idéntica secuencia de red: la paridad probada es el resultado observable y que el retry de lectura no reenvía archivos. Tampoco afirmar prueba del diálogo del SO, TalkBack/VoiceOver, zoom nativo o hardware.

### Gates y entorno

Entorno existente: Python3.12.15/venv, Node22.22.1/Next16.3.6, PostgreSQL18 local55544, Chrome155.0.8059.39, Flutter3.41.6/Dart3.11.4. Sin instalación ni actualización de dependencias. Baseline1331 archivos y copias en /tmp/immuno-miguel-tools/phase5b-evidence-recovery/before; logs en ese directorio temporal. La interrupción de la sesión dejó código/tests y build completos; la reanudación comprobó estado antes de ejecutar las referencias/gates faltantes. Primera tentativa npm desde raíz falló por cwd incorrecto; se corrigió el directorio sin instalar paquetes.

| Gate | Resultado |
|---|---|
| Next completo/BFF | 395 PASS,44 archivos,14,00s. BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test. |
| Next lint | npm run lint:PASS limpio tras retirar helper de pruebas sin uso. Primera ejecución tenía1 warning, no se considera lint limpio hasta la repetición final. |
| Next typecheck | node node_modules/typescript/bin/tsc --noEmit:PASS. |
| Build producción | node node_modules/next/dist/bin/next build --webpack:PASS,compilación2,8s/TypeScript2,0s,26 páginas. Artefacto real del E2E. |
| Flutter completo | flutter test --no-pub --reporter expanded:268 PASS,13s;sin regenerar referencias anteriores. |
| Flutter analyze/formato | analyze --no-pub:PASS,9,5s;dart format --output=none --set-exit-if-changed sobre3 archivos:PASS,0 cambios. |
| Nuevas referencias | flutter test --no-pub --update-goldens test/core/theme/phase5b_evidence_recovery_test.dart:15 PASS,3s;solo2 imágenes nuevas. |
| E2E específico | 1 PASS,6 warnings,14,50s con Chrome/BFF/FastAPI/PostgreSQL reales y respuestas fallidas controladas. |
| Backend completo | 403 PASS,0 SKIP,51 warnings,433,61s;concurrencia,15 E2E y3 bases locales inicialmente vacías para migraciones existentes. Artefacto webpack final y runner E01 sin helper sobrante. |
| Ruff/Node | ruff check del wrapper nuevo y node --check de ambos runners de evidencia:PASS. |

Flutter usa FLUTTER_SUPPRESS_ANALYTICS=true, PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache y ejecutable /tmp/immuno-miguel-tools/flutter/bin/flutter. Backend y navegador usan exclusivamente fixtures sintéticos, un esquema aislado y almacenamiento de pruebas. No dataset institucional ni validación institucional implícita.

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_evidence_recovery_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_evidence_recovery_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_evidence_recovery_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos, límites y rollback

Confirmado significa recepción exitosa de POST; un fallo de transporte sin respuesta no demuestra ausencia de escritura en el servidor. No añadir idempotency keys ni reintento automático de POST. El usuario puede consultar la lista antes de decidir enviar de nuevo. El borrador se conserva solo en memoria de la misma vista; no prometer recuperación tras recarga, logout, cambio de cuenta o expiración. Tests401 aislados de Flutter/Next no prueban sus interceptores; el E2E web401 sí verifica el cierre existente, sin cambiar auth.

error se conserva en EvidenceState por compatibilidad local; loadError y uploadError evitan pérdida de la causa original. No cambian DTOs ni enums de FastAPI. El borrado usa la misma carga coordinada; la regresión de última página se verifica con los tests existentes, sin cambiar permisos ni semántica de revisión/borrado. Descarga conserva su ruta y manejo actual.

Rollback: restaurar únicamente las tres fuentes funcionales desde /tmp/immuno-miguel-tools/phase5b-evidence-recovery/before; conservar pruebas/documentar reversión. No git reset global ni revertir E01/P03/fases anteriores. Helper retirado del runner E01 puede recuperarse desde el baseline de ese bloque, pero no tiene efecto funcional. **Migraciones nuevas:ninguna**; no rollback de datos productivos.

S06 y Fase5B siguen PARTIAL como paridad integral. C02/A07 UNKNOWN, validación nativa/contraste global UNKNOWN, UI-16/UI-17 BLOCKED por alcance; T-02/T-03 PARTIAL y almacenamiento real pendiente. No cerrar Fase3B ni declarar producción lista. Sin commit.


### Revisión final E02

**B5-E02a/E02b/E02c/E02d/E02e DONE en los recorridos documentados; FASE5B PARTIAL.** Backend/PostgreSQL403 PASS/0 SKIP,51 warnings,433,61s;15 E2E,concurrencia y3 migraciones existentes. Next395 PASS/lint limpio/typecheck/webpack PASS;Flutter268 PASS/analyze/formato PASS. El gate integrado usó el artefacto final. Los51 warnings son deprecaciones existentes noload/FCM,no nuevos fallos ocultados con configuración.

Revisión incremental frente a baseline1331: tres fuentes funcionales modificadas (página Next,pantalla y provider Flutter),un runner anterior con retiro de helper sin uso,cuatro archivos nuevos de tests,tres documentos y11 artefactos nuevos (8 PNG,casos,mediciones,índice). Ningún archivo previo eliminado ni golden Flutter anterior modificada. Sin backend funcional,contratos,auth,reglas clínicas,migraciones nuevas,dependencias/lockfiles,PDF/QR,Maps o Azure cambiados.

Revisados git diff e incremental de fuentes;git diff --check PASS.770 referencias SHA-256 verificadas,0 ausentes/desajustes;índices de evidencia web previa regenerada por las suites actualizados sin cambiar procedencia. Pares503 claro/oscuro revisados;metadatos sin IDs personales/clínicos,cookies,tokens o contenido de documentos. Escaneo limitado de patrones de secretos de alta confianza en8 archivos fuente/test:0 coincidencias;no auditoría universal.

El pendiente E02 descrito como PARTIAL en la sección histórica E01 queda resuelto por esta evidencia posterior. S06 continúa PARTIAL como paridad integral,al igual que el resto del inventario sin escenas/pruebas completas. Validación de lectores/zoom/teclado/hardware nativos UNKNOWN;C02/A07 UNKNOWN;UI-16/UI-17 BLOCKED por alcance;T-02/T-03 PARTIAL y almacenamiento real pendiente. No cierre de Fase3B ni producción lista. Sin commit.

## Continuación — H01 recuperación del historial

Fecha: 2026-10-21, America/Bogota. **H01 DONE en recuperación probada; S11/FASE5B PARTIAL.** Leídos AGENTS.md, skills locales ui-parity/quality-gates/security-health, plan/matrices y código actual. Referencia funcional inicial Flutter; FastAPI conserva la autoridad de negocio, permisos, contenido y visibilidad de eventos. Sin cambios de backend funcional, contratos, clínica, autenticación de Fase2, PDF/QR, Maps, Azure o stores. Sin commit.

### Causa raíz y cambios

| ID / prioridad | Archivo / función | Problema e impacto comprobado | Solución / estado |
|---|---|---|---|
| B5-H01a / P2 | Flutter audit_history_screen.dart:_load/build | Todos los fallos se mostraban como error genérico. La metadata del listado anterior mantenía navegación activa tras fallar la consulta. | Mensajes seguros diferenciados401/403/404/429/500/503; error visible y datos/paginador antiguos retirados. El mensaje no incluye diagnóstico crudo. No cambia qué registros permite FastAPI. |
| B5-H01b / P2 | Flutter _load/_goToPage | Clics repetidos iniciaban GET redundantes; dos acciones de paginación antes del siguiente frame podían incrementar página dos veces. | Future compartido por carga, guardia sincrónica de página, retry deshabilitado durante consulta y misma página al recuperar. Mounted protege inicio/finalización. Mantener error hasta recibir una lectura exitosa, sin vacío falso. |
| B5-H01c / P2 | Next student/history/page.tsx y admin/history/page.tsx | isLoading no describe refresco de datos existentes; paginador/actualizar seguían activos durante GET. Retry no exponía isFetching y refetch podía cancelar/reiniciar con cada clic. | Busy de paginación según isFetching; QueryError con retrying y cancelRefetch:false. Lista/metadata ya se ocultaban ante error y se conserva ese comportamiento. API y QueryError global sin cambios. |
| B5-H02 / P2 | Next admin/history/layout.tsx, admin/layout.tsx; Flutter app_router.dart; FastAPI audit/router.py | FastAPI permite /audit/admin/page a admin y app_admin; Next restringe la ruta a plain_admin y no ofrece historial en APP_ADMIN_NAV. Flutter acepta deep link administrativo por isAdminRole. E2E de app_admin recibía200 en API pero era redirigido por la UI. | **PARTIAL**, divergencia fuera de este bloque de recuperación. Guard/rutas/nav sin modificar. Motivo institucional de la restricción y disponibilidad deseada de historial web para app_admin: UNKNOWN; decisión de representación pendiente, sin decisión clínica nueva. Propuesta separada: si se confirma esa disponibilidad, alinear capacidad web con permiso ya existente en FastAPI, con pruebas de entrada/nav/retorno y aislamiento por rol. No conceder un permiso nuevo al servidor. |

Archivos funcionales: frontend/lib/features/shared/presentation/screens/audit_history_screen.dart; frontend-next/src/app/student/history/page.tsx; frontend-next/src/app/admin/history/page.tsx. Se conservan acción/actor/detalles/fechas, destinos de navegación, endpoints, payloads, page_size20 e include_self de Flutter. No se modifican AuditList, diccionarios de estado, reglas clínicas, guard, menú ni política de auditoría. S11 no se declara completa por estos cambios.

### Entorno recuperado

/tmp se había limpiado entre sesiones. Faltaban Python del venv, Flutter, caché pub y PostgreSQL local; Node/Chrome/node_modules y dependencias Python del workspace persistían. No atribuir los gates anteriores a esta sesión.

- Python3.12.15 restaurado con uv0.13.0 temporal; se reutiliza backend/.venv y sus dependencias existentes (FastAPI0.141.1/pytest9.1.1). Instalador oficial uv versionado, binarios solo bajo /tmp/immuno-miguel-tools; no paquetes globales ni cambio de requirements.
- Flutter3.41.6 recuperado del tag oficial flutter/flutter, commit db50e20168db8fee486b9abf32fc912de3bc5b6a; engine425cfb54d0/Dart3.11.4. Checkout detached/channel user-branch, no presentado como rama stable. Caché restaurada con flutter pub get --enforce-lockfile;103 avisos de versiones nuevas no motivaron upgrades. Lockfile/manifiestos conservados.
- PostgreSQL18 nuevo, trust solo local, host127.0.0.1/puerto55544 y timezoneAmerica/Bogota. initdb tomó el usuario local como rol inicial; primer createdb falló exactamente `FATAL: role "postgres" does not exist`. Se creó el rol postgres en este clúster vacío y las bases sintéticas; no se borró/reinicializó un clúster con datos. Sin conexiones institucionales.
- Node22.22.1, Next16.3.6, Chrome155.0.8059.39 conservados. Sin npm install, upgrades o cambios funcionales de despliegue.

Baseline1347 archivos, copias/logs en /tmp/immuno-miguel-tools/phase5b-history-recovery. El baseline anterior a restauración distingue toda esta continuación de fases previas. Las herramientas/DBs temporales pueden desaparecer otra vez; evidencia de UI y parche de rollback sí quedan en el workspace.

### Pruebas y evidencia

Nuevos archivos:

- frontend-next/src/components/__tests__/phase5b-history-recovery.test.tsx:16 pruebas. Dos ámbitos (me/admin)×6 fallos HTTP, datos previos/pager retirados, sin diagnóstico ni vacío falso, retry doble comparte GET y mantiene página2; refresco bloquea controles; loading inicial y vacío exitoso distintos. No renderiza RoleGuard: no implica acceso web de app_admin. Antes14 FAIL/2 PASS; después16 PASS.
- frontend/test/core/theme/phase5b_history_recovery_test.dart:29 pruebas con pantalla real y Dio controlado. Student/admin/app_admin×6 códigos, rutas/params correctos, metadata retirada ante error, retry compartido y misma página;3 casos loading/vacío,6 referencias nuevas por rol/tema, doble página en mismo frame y finalización tras dispose. Antes19 FAIL/10 PASS en ejecución sin goldens; después29 PASS y referencias inicializadas solo para este archivo.
- backend/tests/test_phase5b_history_recovery_browser.py + frontend-next/tests/e2e/phase5b-history-recovery-browser.mjs: fixtures sintéticos de45 eventos autorizados y1 fuera de ámbito, en esquema PostgreSQL aislado. Chrome→build webpack→BFF→FastAPI→PostgreSQL. Estudiante recibe403 en endpoint administrativo; admin200 sin evento fuera de ámbito; app_admin200 con ese evento, conforme a los filtros existentes. Next app_admin redirige por guard actual, sin datos del historial renderizados: H02 sigue pendiente.

E2E: student/admin×claro/oscuro×GET403/503, ocultación de contenido retenido y paginación, doble retry1 GET y página2/tamaño20 conservados. Refresco bloquea navegación mientras la petición está retenida. GET401 final activa expiración existente. Login/cookies del harness son sintéticos; no prueba de logout/FCM entre cuentas en producción ni cambio del protocolo de sesión. Son10 registros de medidas, sin IDs/cookies/tokens/PII reales.

Se corrigieron esperas del harness: navegación podía no tener main aún; después se esperaba explícitamente el frame busy en vez de comprobarlo al llegar el evento de red. Asserts de datos, controles, cantidad de peticiones y permisos conservados. Un tercer intento diagnosticó H02, sin retirar el control de acceso: el caso ahora verifica la restricción existente de forma negativa y no afirma recuperación de historial para app_admin web. No simular éxito de ese ámbito.

[Cuatro pares anotados](../ui/evidence/phase5b/history-recovery/comparison-cases.json), [10 registros web](../ui/evidence/phase5b/history-recovery/next-measurements.json), [índice SHA-256](../ui/evidence/phase5b/history-recovery/evidence-index.json).6 nuevas referencias Flutter y8 capturas Next. Pares student/admin×claro/oscuro para503; Flutter captura fallo inicial, Next fallo de refresco con datos previos reales. Mismo resultado seguro y control de recuperación; distintos shells/posición. Dos referencias Flutter app_admin no tienen par web por H02; no igualdad de píxeles ni cobertura nativa integral. Se revisaron los pares oscuro de estudiante y claro de administrador; los restantes temas/roles se verifican por golden/casos, sin declarar contraste global.

### Gates

| Gate | Resultado observado |
|---|---|
| Next completo/BFF | 411 PASS,45 archivos,18,32s. BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test. |
| Next lint/typecheck | npm run lint final / node node_modules/typescript/bin/tsc --noEmit:PASS. |
| Next producción | node node_modules/next/dist/bin/next build --webpack:PASS,compilación3,6s/TypeScript2,0s/26 páginas. Artefacto usado por E2E. |
| Flutter completo | flutter test --no-pub --reporter expanded:297 PASS,22s,sin regenerar referencias anteriores. |
| Flutter analyze/formato | analyze final:PASS,3,8s;dart format --output=none --set-exit-if-changed de2 archivos:PASS,0 cambios. Se corrigió1 aviso de braces del test, sin desactivar reglas. |
| Nuevas referencias | flutter test --no-pub --update-goldens test/core/theme/phase5b_history_recovery_test.dart:29 PASS,2s;6 imágenes nuevas únicamente. |
| E2E específico | 1 PASS,6 warnings,17,59s antes del gate integrado; tras reforzar observación del documento y posterior redirección de app_admin, repetición final1 PASS/6 warnings/17,43s. Intentos fallidos anteriores no cuentan como PASS. |
| Backend/PostgreSQL completo | 404 PASS,0 SKIP,51 warnings,452,11s;concurrencia,16 E2E y3 bases inicialmente vacías para migraciones existentes. |
| Ruff/Node | ruff check del wrapper nuevo y node --check del runner:PASS. |
| Rollback verificable | git apply --reverse --check --unidiff-zero docs/audits/patches/phase5b-history-recovery.patch:PASS;no se aplicó la reversión. |

Comandos Flutter con FLUTTER_SUPPRESS_ANALYTICS=true, PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache y SDK /tmp/immuno-miguel-tools/flutter/bin/flutter. Build/lint/typecheck/tests usan dependencias instaladas existentes. Backend completo:

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_history_recovery_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_history_recovery_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_history_recovery_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos, límites y rollback

La coordinación de peticiones es por instancia/página montada, no entre pestañas. El error retira contenido/paginador anteriores hasta GET exitoso; no modifica ni elimina datos del servidor. Unit/widget401 usa transporte controlado y no demuestra interceptores móviles; E2E web verifica la expiración existente sin cambiar auth. No se amplían permisos para app_admin por retirar un guard silenciosamente.

H02 permanece PARTIAL. S11 todavía carece de comparación integral de detalles largos, foco/retorno/deep links, datos/empty/loading en todos los temas y accesibilidad nativa. No cambiar títulos crudos o estados históricos para inferir dominio. Lectores/zoom/teclado/dispositivos nativos y contraste global UNKNOWN;C02/A07 UNKNOWN;UI-16/UI-17 BLOCKED por alcance;T-02/T-03 PARTIAL y almacenamiento real pendiente. No producción lista ni cierre de Fase3B.

Rollback de código: parche incremental persistente [phase5b-history-recovery.patch](patches/phase5b-history-recovery.patch), limitado a las tres fuentes funcionales de H01. Se validó `git apply --reverse --check --unidiff-zero` y no se aplicó. Ante cambios posteriores, revisar/revalidar antes de revertir; alternativa inmediata son copias en /tmp del bloque. No usar git reset/restauración global que revierta fases anteriores. **Migraciones nuevas:ninguna**. El clúster/base temporal solo contiene datos sintéticos, sin operación productiva que revertir. Conservar tests como prevención y documentar reversión. Sin commit.


### Revisión final H01

**B5-H01a/H01b/H01c DONE en recuperación probada; H02 PARTIAL; S11/FASE5B PARTIAL.** Backend/PostgreSQL404 PASS/0 SKIP,51 warnings,452,11s,16 E2E y3 migraciones existentes. Next411 PASS/lint/typecheck/webpack PASS;Flutter297 PASS/analyze/formato PASS. El refuerzo final del runner observa commit del documento /admin/history y posterior redirección a /admin para app_admin;E2E específico repetido1 PASS/17,43s. El build y fuentes funcionales no cambiaron tras el gate integrado;no atribuir el refuerzo a una repetición completa del backend. Warnings51 de noload/FCM existentes, sin ocultarlos con configuración.

Frente a baseline1347: tres fuentes funcionales existentes modificadas, cuatro archivos nuevos de tests, tres documentos actualizados y18 artefactos persistentes nuevos (6 PNG Flutter,8 PNG Next,casos/mediciones/índice y parche de rollback). Las suites regeneraron evidencia web anterior y se actualizaron sus índices preservando procedencia. Ningún archivo anterior eliminado ni golden Flutter anterior alterada. Sin backend funcional,API,guard/nav,contratos,dominio,auth,dependencias/lockfiles,migraciones nuevas o ámbitos excluidos modificados.


## Continuación — C07 búsqueda de destinatarios en comunicaciones Flutter

**Causa raíz.** `_RecipientSearchField._search` convertía cualquier fallo en `_options=[]` sin estado de error ni reintento; una respuesta vacía exitosa tampoco mostraba texto. Además, al bajar la query a menos de dos caracteres mientras había un GET pendiente, el request antiguo podía mantener `_loading=true` hasta completarse y dejar un spinner visible aunque ya no hubiera una búsqueda válida.

**Solución.** La búsqueda ahora distingue loading, empty, error seguro y retry. El texto de query cambia invalida requests anteriores, limpia opciones viejas y cancela visualmente loading cuando cae bajo el mínimo existente de dos caracteres. Respuestas exitosas/error solo modifican la vista si pertenecen al query/request vigente. Next ya presentaba los cuatro estados, con retry para errores, y no cambió.

**Archivos.** `frontend/lib/features/shared/presentation/screens/communications_screen.dart`; `frontend/test/core/phase5b_communications_states_test.dart`; matrices `docs/ui/phase5-parity-matrix.md` y `docs/ui/phase5b-parity-matrix.md`; registros `docs/audits/phase5b-plan.md`, `phase5b-remaining-work.md`.

**Pruebas.** Dos widget tests nuevos cubren GET 503 → mensaje seguro → retry mismo query → empty distinguible, y respuesta tardía después de reducir el query → sin opciones viejas ni spinner. Suite comunicacional `phase5b_communications_states_test.dart`: **32 PASS** con las referencias existentes; Flutter suite completa: **411 PASS**; `flutter analyze --no-pub`: **PASS**; formato **0 cambios** después de dar formato. Next `phase5b-communications-layers/recovery/peer`: **74 PASS** como verificación del contrato visual vigente, no hubo fuente Next modificada. No se ejecutó backend/PostgreSQL/E2E: no cambia API ni autorización.

**Diferencias/residuales.** Student Next permite enviar sin administrador explícito y FastAPI resuelve el destino de ámbito; Flutter exige elegir uno. La política de destinatario se conserva sin cambio y la diferencia queda documentada. Búsqueda de destinatario ahora queda alineada en errores/empty/retry. No se verificaron lectores/teclados/dispositivos físicos ni sesión expirada con formulario abierto; UNKNOWN.

**Riesgo/rollback.** Al cambiar texto, el resultado anterior se retira inmediatamente y se consulta el nuevo texto tras el debounce existente de280ms. Rollback: restaurar únicamente el estado local y las funciones `_onTextChanged/_search` de `_RecipientSearchField`, retirar los dos tests nuevos y revertir filas/documentación C07; no restaurar el archivo completo contra HEAD, que contiene otras fases. No migraciones ni datos. La revisión final posterior de `git diff --check` pasó. Sin commit.


## Continuación — S14 revalidación del detalle de conversación, 2026-10-26

**Causa raíz.** La fila S14 de `docs/ui/phase5-parity-matrix.md` conservaba observaciones previas a los trabajos de recuperación de comunicaciones: afirmaba que Next carecía de cierre/reapertura, retry, estado vacío, etiqueta del compositor y sincronización backend de lectura. El código actual de `ThreadDetail` y `useCommunicationReadSync` sí implementa esos comportamientos; la documentación estaba desactualizada.

**Solución.** Se actualizó la matriz para reflejar el comportamiento verificado. Se conservaron como diferencias reales el polling de detalle (Flutter 3 s; Next 5 s), el patrón de confirmación (solo Next), las notificaciones de error (SnackBar/toast) y los límites de accesibilidad/dispositivo que siguen UNKNOWN. Sin cambios funcionales, API, permisos, clínica o almacenamiento.

**Pruebas.** Next focal: `node node_modules/vitest/vitest.mjs run src/components/__tests__/phase5b-communications-recovery.test.tsx src/components/__tests__/phase5b-communications-peer.test.tsx`: **47 PASS**. Flutter focal: `FLUTTER_SUPPRESS_ANALYTICS=true /tmp/immuno-miguel-tools/flutter/bin/flutter test --no-pub --reporter expanded test/core/phase5b_communications_states_test.dart`: **32 PASS**. `git diff --check`: **PASS**. No se ejecutaron suites completas en este bloque documental.

**Estado/límites.** S14: documentación revalidada; diferencias de interacción descritas, con equivalencia de permisos dependiente de FastAPI. Anuncio accesible de mensajes entrantes, lector de pantalla, navegación física y expiración de sesión en navegador permanecen UNKNOWN. Fase 5B sigue PARTIAL. Sin migraciones ni commit.


## Continuación — S15 revalidación de filtros del dashboard admin, 2026-10-26

**Causa raíz.** La fila S15 de `docs/ui/phase5-parity-matrix.md` decía que Next ignoraba el semestre/filtro del dashboard al abrir el listado. Esa observación precedía al bloque B5-A06, que ya persistió el semestre del dashboard en URL, y al parser de filtros del listado.

**Verificación del código.** Flutter `AdminDashboardScreen._openStudents` envía `active`, `scheme` y `semester` como query params y `GoRouter` los transforma en filtros iniciales. Next `RegularAdminDashboard` preserva el semestre en sus cinco enlaces de estadísticas; `StudentsFromUrl` analiza los parámetros mediante `studentListFilters`, y `studentListUrl` mantiene los campos compatibles. El texto de búsqueda se excluye deliberadamente de URL/contexto por privacidad. No se modificó código.

**Pruebas ejecutadas.** `phase5b-dashboard-context.test.tsx`, `phase5b-admin-dashboard.test.tsx`, `phase5a-navigation.test.ts` y `phase5a-list-sync.test.tsx`: **39 PASS**. La evidencia anterior de B5-A06 incluye un E2E Chrome con PostgreSQL sintético PASS que recorre el enlace del dashboard, listado filtrado, back, reload, cambios de historial y filtro de semestre; no se repitió ese E2E en esta revalidación documental.

**Estado/límites.** Corregida la documentación obsoleta; filtros semestrales/active/scheme y restauración URL tienen evidencia existente. Diferencia de opciones sigue **A07 UNKNOWN** (Flutter1–10, Next1–12, FastAPI1–20), sin decisión institucional ni cambio. Equivalencia numérica de estadísticas con datos institucionales, lector/dispositivo físico y paridad visual integral siguen UNKNOWN. S15/R04/Fase5B permanecen PARTIAL. `git diff --check` se revisará al cierre de este bloque; sin commit.


## Continuación — S16 revalidación del dashboard app_admin, 2026-10-26

**Causa raíz.** La fila S16 de `docs/ui/phase5-parity-matrix.md` seguía describiendo una diferencia de comunicaciones ya resuelta: afirmaba que Next no adaptaba destinatarios al rol `app_admin`. También omitía que el contador web de conversaciones se presenta en la navegación, mientras Flutter lo ubica en AppBar y tarjeta del dashboard.

**Verificación del código.** Flutter `_buildAppAdminDashboard` muestra accesos a administradores, catálogo y comunicaciones, el contador de conversaciones, y estadísticas globales. Next `AppAdminDashboard` conserva esas capacidades existentes; `CommunicationsPage` configura `admins` como destino inicial para app_admin y no ofrece el selector reservado al admin normal. `AppShell` calcula y expone el contador por categoría de comunicación en su módulo de navegación. `Distribution` presenta `Sin datos.` cuando la colección exitosa está vacía; errores de estadísticas usan `QueryError` y conservan los accesos. No se modificó código ni se alteró ningún permiso.

**Pruebas ejecutadas.** `phase5b-admin-dashboard.test.tsx`, `phase5b-communications-peer.test.tsx`, `phase5b-notification-shell.test.tsx`, `phase5a-communications.test.tsx`: **53 PASS**. Cobertura incluye loading/cero/error/refresh por rol, capacidades disponibles, creación de comunicaciones por rol y contador de comunicación de app_admin en sus dos enlaces responsivos (desktop/móvil). La primera aserción nueva esperaba un único enlace; falló porque AppShell mantiene ambos navs en el DOM con clases responsivas. Se corrigió el test para comprobar los dos y la suite pasó. El test E2E Chrome→FastAPI→PostgreSQL sintético de dashboards referido en la evidencia anterior no se repitió; no se afirma validación productiva.

**Estado/límites.** La matriz S16 ahora identifica el ajuste real: contador en dashboard Flutter y navegación Next. Equivalencia numérica con datos institucionales, lectores/zoom/dispositivos y paridad visual completa permanecen UNKNOWN. S16/R04/Fase5B siguen PARTIAL; asignación de firma fuera del dashboard. `git diff --check` y revisión de whitespace: **PASS**; sin commit.


## Continuación — S06 revalidación de carga de evidencias, 2026-10-26

**Causa raíz.** La matriz S06 conservaba hallazgos anteriores a E01/E02: afirmaba que Next aceptaba imágenes de entrada, no permitía retirar archivos seleccionados, omitía confirmación de borrado y no separaba errores de lectura/subida. También indicaba tamaños de página y recuperación ya cambiados.

**Verificación del código.** Ambos clientes cargan PDF, permiten quitar cada archivo antes del envío, usan el endpoint `/evidence/page` con tamaño20 y confirman el borrado de lotes. Next refleja errores de esquema en un control de consulta separado. Flutter usa `schemeProvider` al poblar la lista de dosis, pero no representa un error independiente de esa consulta en esta pantalla; la equivalencia de ese escenario queda UNKNOWN. Se observaron etiquetas distintas para algunos estados legacy (`uploaded`, `under_review`, `pending`, `reviewed`); se documentan literalmente sin inferir su semántica ni cambiar clínica.

E02 ya separa POST confirmado de GET fallido: ambos ocultan lista/formulario antiguo, conservan aviso de resultado confirmado y ofrecen reintentar únicamente el GET; un POST no confirmado conserva el borrador. Las recuperaciones coordinan GET concurrentes y protegen de respuestas antiguas. Los controles de eliminación llaman a FastAPI; la autorización efectiva permanece en el servidor.

**Pruebas ejecutadas.** Next `phase5b-evidence-recovery.test.tsx` + `phase5a-evidence.test.tsx`: **13 PASS**. Flutter `phase5b_evidence_recovery_test.dart`: **15 PASS**. El primer intento Flutter fue bloqueado por el socket local del sandbox y pasó al repetir con permiso de ejecución. La evidencia histórica E02 incluye E2E de Chrome→BFF→FastAPI→PostgreSQL sintético y gates integrados; no se repitió el E2E/backend en esta revalidación documental.

**Estado/límites.** Se actualizó la matriz S06; no hubo cambios funcionales ni migraciones. Los labels legacy no se unifican por no contar con decisión explícita de normalización; la consulta auxiliar `schemeProvider` en Flutter permanece UNKNOWN. Pruebas físicas de picker, lector de pantalla, zoom y cambios de usuario durante multipart UNKNOWN. S06/R04/Fase5B continúan PARTIAL. `git diff --check` y revisión de whitespace: PASS; sin commit.


## Continuación — S08 revalidación del perfil estudiante, 2026-10-26

**Causa raíz.** La fila S08 en la matriz principal describía hechos ya resueltos en P01/P02/P03 como problemas vigentes: Next quedándose en loading tras fallo, labels desconectados, truncamiento y borrador desmontado/perdido. También omitía la distinción entre PUT confirmado y GET de refresco fallido.

**Verificación del código.** Flutter y Next ocultan contenido anterior mientras un GET protegido está en error, ofrecen retry y conservan el borrador de edición en memoria para recuperar la consulta. Ambas plataformas separan fallo de PUT de PUT confirmado+GET fallido; recuperación solo relee, no reenvía. Next labels asociados, campos bloqueados y layout container-query/reflow. Permisos/payload y FastAPI permanecen intactos.

**Pruebas ejecutadas.** Next `phase5b-student-profile.test.tsx` + `phase5b-profile-recovery.test.tsx`: **23 PASS**. Flutter `phase5b_profile_recovery_test.dart`: **17 PASS**. Flutter necesitó repetición fuera del sandbox por socket local bloqueado. No se repitieron las goldens P01/P02, build, E2E ni PostgreSQL; la evidencia anterior se conserva separada y enlazada en la matriz.

**Estado/límites.** Se actualizó la matriz S08 sin cambios funcionales/migraciones. P01/P02/P03 DONE en las dimensiones recorridas; S08/R04/Fase5B siguen PARTIAL por comparación visual integral y lector/zoom/teclado/dispositivo físico UNKNOWN. Expiración real de sesión en hardware no inferida de los tests HTTP controlados. `git diff --check` y revisión de whitespace: **PASS**; sin commit.


## Continuación — S04 revalidación del dashboard estudiante, 2026-10-26

**Causa raíz.** La matriz S04 conservaba diferencias ya resueltas/contradictorias: decía que Next mostraba ceros durante la carga y mostraba el badge antes de recibir respuesta; además omitía qué navegación se ubica en tarjetas, AppBar, shell y menú, y no distinguía cache offline de errores web.

**Verificación del código.** Flutter tiene cinco accesos rápidos, dos iconos con badges en AppBar y opciones de perfil/historial en menú; muestra cinco contadores DTO, y cuando presenta cache offline acompaña esos datos con “Información no verificada por falta de conexión.”. Next muestra elipsis durante carga, valores del DTO incluidos ceros válidos solo tras respuesta, y badge de estado únicamente con datos exitosos. Sus siete tarjetas conviven con shell/user menu y contadores de navegación; ante error oculta señales previas, conserva accesos y presenta QueryError. FastAPI sigue siendo autoridad de señales y permisos.

**Pruebas ejecutadas.** Next `phase5b-student-dashboard.test.tsx`: **12 PASS**. Flutter `phase5b_student_dashboard_reference_test.dart`: **25 PASS**. Flutter requirió repetir fuera del sandbox por el socket local del test runner. No se repitieron E2E/PostgreSQL ni se actualizaron goldens; la evidencia integrada D01–D04 y sus límites permanecen enlazados en `docs/ui/phase5b-parity-matrix.md`.

**Estado/límites.** Matriz S04 corregida; sin cambios funcionales, reglas clínicas o migraciones. Expiración real de sesión en dispositivo, lectores, zoom nativo, contraste global y equivalencia visual integral siguen UNKNOWN. El comportamiento offline es específico de Flutter; no se propone añadir cache clínica web en esta revalidación. S04/R04/Fase5B permanecen PARTIAL. `git diff --check` se revisará al cierre; sin commit.


## Continuación — S02 revalidación de recuperación de contraseña, 2026-10-26

**Causa raíz.** La matriz inicial describía como vigente el formulario Flutter sin scroll y los mensajes Next que exponían CORS/Render. La implementación se había corregido previamente en R02A, pero la fila principal no reflejaba ese estado.

**Verificación.** Flutter usa `LayoutBuilder` + `SingleChildScrollView` y anuncia errores como live region. Next enlaza el campo y errores con `aria-describedby`, expone busy y usa `accountFormError`, que no muestra cuerpo de respuesta ni infraestructura. Ambas conservan el correo para retry explícito y el éxito no revela si existe la cuenta. Los tests existentes ejercitan estados HTTP, doble submit, dispose y viewport controlado.

**Pruebas ejecutadas.** Next `phase5b-account-forms.test.tsx`: **32 PASS**. Flutter `phase5b_account_forms_test.dart`: **37 PASS**. El primer Flutter run en sandbox falló al abrir socket local; la repetición con permiso necesario pasó. No se realizaron envíos reales ni validación SMTP/entregabilidad.

**Estado/límites.** Actualizadas las filas S02 de `docs/ui/phase5-parity-matrix.md` y la evidencia de `docs/ui/phase5b-parity-matrix.md`. Sin código funcional, migraciones, reglas clínicas ni commit. E2E real de recuperación por correo, lectores/hardware y equivalencia visual integral siguen UNKNOWN; S02/R02/Fase5B PARTIAL. Rollback: revertir únicamente las adiciones documentales de esta revalidación.


## Continuación — S03 revalidación del reset de contraseña, 2026-10-26

**Causa raíz.** La matriz inicial afirmaba que cualquier error Next se mostraba como token inválido y que los campos no asociaban los mensajes de validación. El código actual usa el helper compartido de errores y relaciones `aria-describedby`; Flutter también distingue errores mediante su helper estático y conserva alias/deep links propios.

**Verificación.** Ante token ausente, Next no envía la mutación ni muestra el token, y ofrece pedir un enlace nuevo. Flutter presenta error seguro cuando recibe token vacío; soporta `/reset-password`, `/auth/reset-password` y esquema `immunoclinic`. Next está en `/reset-password`. Ambos muestran success con navegación a login. La diferencia de aliases no acredita qué links externos ya se distribuyeron.

**Pruebas ejecutadas.** Las suites de formularios ejecutadas en la revalidación S02 incluyen los casos reset: Next `phase5b-account-forms.test.tsx` (**32 PASS en la suite completa**) y Flutter `phase5b_account_forms_test.dart` (**37 PASS en la suite completa**). Incluyen token ausente/reset HTTP/timeout, validación, doble submit y respuestas tardías controladas. No se utilizó un enlace real ni se completó un reset contra correo.

**Estado/límites.** Solo documentación actualizada en `docs/ui/phase5-parity-matrix.md` y `docs/ui/phase5b-parity-matrix.md`. Compatibilidad de enlaces desplegados, lector real y transporte/correo quedan UNKNOWN; S03/R02/Fase5B PARTIAL. Sin código, migraciones, cambios de autenticación o clínicas, ni commit. Rollback: revertir las adiciones documentales de esta revalidación.


## Continuación — S01 revalidación del login, 2026-10-26

**Causa raíz.** Las notas R02D describían correctamente que Next había carecido de asociación semántica de errores, pero también retenían como estado actual “Flutter no disponible”. El código cambió antes en Next y el toolchain Flutter está disponible; la matriz no reflejaba ambos hechos.

**Verificación.** Next enlaza los errores email/contraseña usando `aria-describedby`, marca `aria-invalid` y expone `role=alert`. Se inspeccionó el formulario y la redirección por rol/contraseña obligatoria; no se alteran auth store, endpoints, permisos, ni sesión. Flutter conserva validadores y bloqueo de botón durante loading.

**Pruebas ejecutadas.** Next `phase5b-login-accessibility.test.tsx`, `auth-api.test.ts` y `phase1-auth.test.ts`: **8 PASS**. Flutter `login_screen_test.dart` y `auth_provider_test.dart`: **10 PASS**. El primer intento Flutter sandbox no pudo abrir socket local; la repetición autorizada pasó. No se ejecutaron login con cuentas reales, backend/PostgreSQL, E2E de sesión expirada o expiración de credenciales.

**Estado/límites.** Actualizados S01/R02D en las dos matrices UI. Sin cambio funcional, de autenticación, migración, ni commit. E2E autenticado real, estados completos de error, captura visual pareada, autofoco/teclado y lector/hardware siguen UNKNOWN; S01/R02/Fase5B PARTIAL. Rollback: revertir las anotaciones documentales de este bloque.


## Continuación — S05 revalidación del esquema estudiante, 2026-10-26

**Causa raíz.** Las correcciones R03B/R03F/R03H ya estaban documentadas: retry tras fallo inicial en Flutter, acordeón accesible Next y vacío con pull-to-refresh Flutter. Faltaba confirmar que dichas rutas siguen pasando y actualizar la cifra de evidencia focal sin presentar las pruebas históricas como recién ejecutadas.

**Verificación.** La UI muestra datos y estados del DTO backend; no se cambió la señal clínica. Flutter tiene botones/diálogos propios para registrar o limpiar datos y aviso de cache offline; Next usa acordeón y edición inline/refetch. No se compararon restricciones de fecha del selector con política clínica; siguen fuera de alcance y cualquier diferencia de timezone/“hoy” es UNKNOWN.

**Pruebas ejecutadas.** Flutter `scheme_detail_screen_test.dart`: **2 PASS** (retry y vacío/refresh). Next `phase5b-detail-scheme.test.tsx`: **7 PASS** (acordeón/teclado DOM y guardas de acción). No se ejecutaron suites completas, backend/PostgreSQL, E2E, analyze, build ni goldens en este bloque.

**Estado/límites.** Actualizadas las filas S05 en ambas matrices. Sin cambios de código, contrato, migración, regla clínica ni commit. Responsive integral, temas, selector de fecha, expiración real, lector/hardware y comparación visual completa permanecen UNKNOWN; S05/R03/Fase5B PARTIAL. Rollback: revertir solo las notas documentales añadidas.


## Continuación — S09 revalidación de cambio de contraseña, 2026-10-26

**Causa raíz.** La matriz inicial S09 conservaba un texto anterior que asociaba la contraseña temporal con la cédula y afirmaba que los errores Next no estaban enlazados a campos. El código actual de ambos clientes y los tests R02A ya sustituyen el copy, pero la matriz no lo había reflejado.

**Verificación.** Ambos clientes muestran “Usa la contraseña temporal recibida por correo. Debes cambiarla antes de continuar.”; no se habla de documento. Next usa asociaciones ARIA por campo y `accountFormError`; Flutter mantiene los tooltips de visibilidad y formulario con scroll. Tras un cambio confirmado, ambos ejecutan logout; Flutter muestra confirmación y ofrece volver por rol, Next inicia `replace('/login')`. El test web verifica secuencia, no persistencia visible del componente success tras la navegación.

**Pruebas ejecutadas.** Next `phase5b-account-forms.test.tsx`: **32 PASS**. Flutter `phase5b_account_forms_test.dart`: **37 PASS**. Incluyen cambio en flujos de formularios: validación, errores HTTP seguros, 400 vs 401, timeout, doble submit, controles durante espera, dispose y orden de logout. No se ejecutaron E2E autenticados contra servicio real ni cambio con cuentas reales.

**Estado/límites.** Actualizadas S09 en matrices primaria y de Fase5B. No se modificó código, auth, permisos, protocolo, reglas, ni migraciones. Teclado/lector/hardware, navegación física y visibilidad real del éxito Next siguen UNKNOWN; S09/R02/Fase5B PARTIAL. Rollback: revertir solo las notas documentales de este bloque.


## Continuación — S00 revalidación de inicio/restauración, 2026-10-26

**Causa raíz.** R02D mantenía UNKNOWN para timeout/respuesta tardía y registraba Flutter como no ejecutable. El entorno actual permite repetir suites focales; el loading accesible de Next y la protección de carreras estaban implementados antes, pero la evidencia debe distinguir esas pruebas de un timeout real del splash.

**Verificación.** Flutter Splash aplica timeout visual de 5 s, conduce a login en excepción y redirige por rol si restaura sesión; el provider descarta respuestas de una generación de sesión invalidada. Next Home espera hidratación y anuncia loading; el store valida `getMe`, borra identidad ante error y evita restauración después de logout concurrente. No se cambió el protocolo ni se agregó sincronización.

**Pruebas ejecutadas.** Next `home-loading-accessibility.test.tsx` + `phase1-auth.test.ts`: **7 PASS**. Flutter `session_redirect_test.dart` + `auth_provider_test.dart`: **9 PASS**. El runner Flutter dentro del sandbox falló por socket local; la repetición autorizada pasó. No hubo E2E de fallo/timeout del splash, respuesta tardía de esa pantalla ni prueba con servicio real.

**Estado/límites.** Matriz S00 actualizada con evidencia y límites; sin código, migraciones o cambios de autenticación. Timeout/transición real del splash, respuestas tardías de restauración, equivalencia temporal, lectores/hardware y comportamiento de red real siguen UNKNOWN. S00/R02/Fase5B PARTIAL. Rollback: revertir solo las notas documentales del bloque.


## Continuación — S18 revalidación de alta/importación, 2026-10-26

**Causa raíz.** La fila principal S18 conservaba el estado previo a R02B: botón desconectado del form, validación HTML ausente, copy de documento como contraseña y labels sin asociación. Además afirmaba límites 30/40 cuando el código actual pagina ambas vistas localmente a20.

**Verificación.** Next usa submit nativo externo asociado al formulario, Enter y required/email; labels tienen IDs; errores visibles seguros, bloqueo de tres operaciones y confirmación de preview consumida por intento. Flutter mantiene dropdowns `AcademicOptions`; Next programa/campus siguen texto libre. No invento vocabulario ni cambio alcance para normalizarlo. En resultados Flutter filtra `created` para dejar filas por revisar; Next muestra todas las filas retornadas. Preview/resultados paginan localmente a20 por página; no descargan páginas extra. Copy de acceso en ambos dice contraseña temporal enviada por correo.

**Pruebas ejecutadas.** Next `phase5b-student-create.test.tsx`: **11 PASS**. Flutter `phase5b_student_create_test.dart`: **18 PASS**. Primer Flutter intento sandbox bloqueó el socket local; la repetición autorizada pasó. Se cubren required, bloqueo/doble submit, cancelar/confirmar preview, archivo ilegible, errores y respuestas tardías controladas. No se repitió E2E PostgreSQL ni gates completos; el PASS integrado previo sigue marcado como evidencia histórica, no como ejecución actual.

**Estado/límites.** Actualizada fila S18 en matrices. Vocabulario del programa/campus, filas visibles en resultado y composición/lector/hardware integral permanecen diferencias/UNKNOWN. S18/R02/Fase5B PARTIAL. Sin cambios funcionales, permisos, opciones, API, clínica, auth, migraciones o commit. Rollback: revertir solo las notas documentales del bloque.


## Continuación — S22 revalidación de perfil administrativo base, 2026-10-26

**Causa raíz.** La matriz primaria de S22 mezclaba perfil base con firma y mantenía el error antiguo de Next quedándose en loading y sin recovery. R02C ya añadió estados/recuperación y documentó que firma no se tocaba; este bloque revalida solo el perfil base.

**Verificación.** Para admin y app_admin, Flutter/Next conservan lectura de ámbito, edición de nombre/cargo y guardado. Tests actuales comprueban GET 401/403/503, retry, esconder datos antiguos, conservar borrador, PUT confirmado con GET fallido y retry GET-only, PUT fallido y lifecycle. Diferencias del formulario/cargo vacíos documentadas en R02C se conservan sin nueva política. Firma/upload/metadata/blob y acceso a imagen no son objeto de estas suites y quedan UNKNOWN.

**Pruebas ejecutadas.** Next `phase5b-admin-profile.test.tsx`: **27 PASS**. Flutter `phase5b_admin_profile_test.dart`: **20 PASS**. Repetición Flutter fuera del sandbox por bloqueo del socket local. No se repitieron backend/PostgreSQL, E2E, build, analyze, goldens ni pruebas de firma.

**Estado/límites.** Matriz primaria S22 separa base de firma y se agrega nota en matriz de Fase5B. No se modificó código funcional, auth, permisos, firma, certificados o migraciones. Teclado/lector/dispositivo, contraste global, dimensiones completas y storage real UNKNOWN; S22/R02/Fase5B PARTIAL. Rollback: revertir solo notas documentales.


## Continuación — S17 revalidación del listado administrativo, 2026-10-26

**Causa raíz.** Aunque R03I ya había corregido la paginación, la matriz principal aún decía que los labels de filtros Next carecían de asociación. La implementación `Field` actual crea ID y `htmlFor`; además, se confirma que consulta normal sigue paginada y la exportación es la operación completa.

**Verificación.** Flutter provider conserva `page`, filtros y `totalPages` al cargar/refrescar; FastAPI es el origen del estado `approved/pending/denied`; Next representa denegado separado, conserva filtros/página por URL y `returnTo` en el detalle. Acciones activar/desactivar/eliminar listadas en Flutter no tienen equivalencia visible en Next; UI-09 sigue pendiente, sin inferir que deba ampliarse permiso web. No se descarga la lista completa para mostrar el listado.

**Pruebas ejecutadas.** Next `phase5a-list-sync.test.tsx` + `phase5b-admin-student-list-status.test.tsx`: **8 PASS**. Flutter `admin_provider_test.dart`: **4 PASS**. No se repitió E2E navegador/PostgreSQL, exportación real, toda la pantalla, build/analyze ni gates backend.

**Estado/límites.** Corregida fila de accesibilidad en matriz primaria y agregada revalidación en matriz Phase5B. La diferencia UI-09 es de ubicación: ciclo de vida en listado Flutter y detalle Next; no se identificó ausencia de capacidad en Next. Lectores/hardware, búsqueda completa, temas/viewports y E2E de reload siguen pendientes/UNKNOWN. S17/R03/Fase5B PARTIAL. Sin cambios funcionales/API/permisos/migraciones ni commit. Rollback: revertir solo notas documentales.


## Continuación — S19 revalidación del detalle administrativo, 2026-10-26

**Causa raíz.** R03E ya había corregido Flutter para que el fallo conjunto de perfil/esquema/evidencia no pareciera vacío y ofreciera reintentar. La matriz conservaba un conteo de suite desactualizado y el estado debía contrastarse con Next, donde las lecturas se recuperan por consulta.

**Verificación.** Flutter oculta nombre/datos/acciones ante fallo inicial o recarga y ofrece retry de las tres lecturas juntas. Next diferencia error por consulta, conserva el comportamiento ya implementado y expone confirmar desactivar/reactivar/eliminar dentro del detalle. Esto resuelve la aparente ausencia de esas acciones en la fila S17: la diferencia es ubicación. FastAPI sigue decidiendo acceso. No se modifican tabs, decisiones de review, clínica, certificados ni historial/revocación.

**Pruebas ejecutadas.** Next `phase5a-student-detail.test.tsx` + `phase5b-detail-scheme.test.tsx`: **14 PASS**. Flutter `admin_student_detail_screen_test.dart`: **2 PASS**. El primer intento Flutter sandbox bloqueó socket local; la repetición autorizada pasó. No se ejecutaron E2E, backend/PostgreSQL, full suite, build, analyze o goldens en este bloque.

**Estado/límites.** Actualizadas las matrices S17/S19 para eliminar contradicción de UI-09 y registrar evidencia focal. Accesibilidad física, responsive/tema integral y otras pestañas/estados siguen UNKNOWN; historial/revocación y certificado excluidos. S19/R03/Fase5B PARTIAL. Sin código funcional, permisos, clínica, migraciones ni commit. Rollback: revertir solo documentación.


## Continuación — H01 revalidación de contrato/paginación S11

La fila S11 en `docs/ui/phase5-parity-matrix.md` conservaba observaciones anteriores a H01. La revisión actual confirma: FastAPI expone `/audit/me/page` y `/audit/admin/page` con `page`, `page_size` (default20, máximo100) y `PageResponse`; ordena por `created_at DESC, id DESC`. Flutter pagina a20 y distingue errores de vacío; Next consulta por página, usa metadata y muestra `QueryError` en fallo. Las rutas de detalle Next ya consumen `tab=scheme/evidence`, contrario al texto histórico del audit.

Pruebas repetidas: `phase5b_history_recovery_test.dart`: **29 PASS**; `phase5b-history-recovery.test.tsx`: **16 PASS**. Estas suites cubren errores, retry, loading/empty, metadata y viewports/temas declarados; no se repitió el E2E de navegador/PostgreSQL en este bloque. Su evidencia de ejecución previa se mantiene referenciada, no se presenta como actual.

Se corrigieron únicamente las filas de S11 que describían error como vacío, ausencia de pager, limit100/offset0 fijo y tabs ignoradas. Permanecen ciertas diferencias: página Flutter no está en URL y reinicia al recargar; Next conserva página en query string. app_admin puede consultar historial por Flutter/Backend, pero Next mantiene su guard; intención institucional del acceso web UNKNOWN bajo H02. Otros temas/estados completos, detalle largo y accesibilidad física siguen UNKNOWN. Sin cambio funcional ni migraciones; S11/R04/Fase5B PARTIAL, sin commit.

Revisados git diff e incremental contra baseline;git diff --check PASS. Nuevas fuentes/patch sin whitespace final;parche de rollback de contexto cero validado con --unidiff-zero, sin aplicarlo.786 referencias SHA-256 verificadas,0 ausentes/desajustes. Escaneo limitado de patrones de secretos de alta confianza en8 archivos fuente/test/patch:0 coincidencias;no auditoría universal. Artefactos solo sintéticos,sin IDs personales/clínicos,cookies,tokens o diagnósticos privados en metadatos.

H02 queda separado: la restricción web de app_admin está comprobada, pero su intención de representación es UNKNOWN. Antes de cambiar guard/nav, definir la disponibilidad deseada de esa pantalla;no reinterpretar permisos clínicos del backend. Otros estados/composición integral S11,lectores/zoom/teclado/hardware/contraste global siguen pendientes. C02/A07 UNKNOWN,UI-16/UI-17 BLOCKED por alcance,T-02/T-03 PARTIAL y almacenamiento real pendiente. Sin producción lista, cierre de Fase3B ni commit.


## Continuación — M01 alta de administradores, 2026-10-21

**B5-M01a/M01b/M01c DONE en alta verificada. S20/FASE5B PARTIAL.** Bloque acotado al formulario Next de creación de administradores. FastAPI conserva contratos/permisos; Flutter es referencia existente, sin cambios de su implementación funcional. Sin commit.

### Causas raíz y solución

| ID / prioridad | Evidencia previa / impacto | Cambio acotado |
|---|---|---|
| B5-M01a / P2 | `frontend-next/src/app/admin/admins/page.tsx`: los campos estaban en CardContent y el botón invocaba mutate en onClick. required/type=email no participaban en un submit nativo; Enter no enviaba. No exponía privilegios nuevos: FastAPI seguía validando, pero la UI enviaba solicitudes evitables. | Form nativo con nombre accesible, onSubmit/reportValidity y botón submit. minLength8 de contraseña y maxLength100/150 de nombres/cargo/ámbito corresponden a CreateAdminRequest actual. Backend sigue validando catálogo, datos y rol app_admin. |
| B5-M01b / P2 | mutationFn leía el estado del render; los campos y Cancelar permanecían activos durante POST. La respuesta exitosa limpiaba el formulario aunque se hubiera editado entretanto. | Payload por variables de mutación, construido una vez al enviar; fieldset, cancelar y acciones de eliminación bloqueados durante creación. Alta también se bloquea mientras elimina. El helper existente conserva exclusión del doble submit y bloqueo hasta resolver la lectura posterior; no cambia auth ni coordinación compartida. |
| B5-M01c / P2 | Campos opcionales editados y borrados dejaban first_name/last_name="", incompatibles con min_length1 del backend cuando están presentes. onSuccess invalidaba admins además del refresco ya realizado por useSafeMutation: dos GET tras una creación. | Omite opcionales vacíos, recorta texto ordinario, conserva contraseña exacta y elimina únicamente la invalidación redundante de creación. La invalidación de eliminación no se modifica en este bloque. |

Fuente contractual inspeccionada: `backend/app/modules/admin/schemas.py::CreateAdminRequest`, `AcademicScopeMixin`, `accounts/service.py::AdminAccountService.create_admin` y router POST/GET /admin/admins. Solo app_admin configura estas cuentas; admin/estudiante reciben403. POST actual responde200, sin cambio a201. Nombres son opcionales y el backend ya tiene fallback de presentación; no se convierten en obligatorios por copiar Flutter. Programa/campus permanecen validados contra opciones existentes por backend; no se crean opciones institucionales nuevas ni se copian reglas clínicas.

Archivo funcional modificado: `frontend-next/src/app/admin/admins/page.tsx`. Helpers SafeMutation, RoleGuard, clientes HTTP, datasources Flutter y backend funcional permanecen intactos. Migraciones nuevas: **ninguna**; dependencias/manifiestos/lockfiles sin cambios.

### Pruebas y comparación

- `frontend-next/src/components/__tests__/phase5b-admin-create.test.tsx`:11 pruebas. Required/email, form y límites contractuales, Enter, opcionales borrados, texto normalizado/contraseña intacta, campos/cancelar/eliminar congelados, doble submit en mismo frame, una recarga tras éxito y limpieza de contraseña, espera del GET posterior y POST fallido con borrador/reintento explícito. Primera ejecución9 pruebas:8 FAIL/1 PASS; después9 PASS; se añaden dos casos de regresión y suite final422 PASS.
- `frontend/test/core/theme/phase5b_admin_create_test.dart`:4 pruebas nuevas contra pantalla/datasource reales con transporte controlado;2 referencias claro/oscuro390 y rechazo local de datos faltantes/contraseña corta sin POST. No demuestra autorización del router móvil ni modifica su flujo. Solo estas dos goldens nuevas se inicializaron; suite completa compara las anteriores sin regenerarlas.
- `backend/tests/test_phase5b_admin_create_browser.py` + `frontend-next/tests/e2e/phase5b-admin-create-browser.mjs`: nuevo wrapper del harness aislado y runner CDP. Chrome→webpack→BFF→FastAPI→PostgreSQL real local. Requeridos en ambos temas, correo inválido y minLength mediante inserción de teclado real no generan POST; POST retenido congela campos/cancelar/eliminar; doble submit produce una petición; alta con opcionales borrados funciona; una recarga refleja la cuenta; reapertura sin contraseña anterior; creación negada403 a estudiante/admin. El esquema clínico sigue in_review al finalizar, según harness existente.

Primer build falló por opción `exact` no admitida en ByRoleOptions del test; se corrigió el test, sin omitir typecheck. Analyze detectó un helper público con tipo privado; renombrado privado y analyze repetido limpio. El primer E2E falló al esperar creación: el fixture usaba dominio `.invalid`, rechazado por EmailStr/email-validator como special-use; se confirmó con el validador instalado y se sustituyó por example.com reservado para ejemplos. No se cambió validación funcional ni se usaron credenciales/datos reales. E2E específico posterior:1 PASS/6 warnings/6,43s. Se añadió después una aserción de ausencia de desbordamiento horizontal390; también pasa en la ejecución final integrada. La medición6,43s pertenece a la ejecución específica anterior.

[Dos pares anotados](../ui/evidence/phase5b/admin-create/comparison-cases.json), [7 casos web](../ui/evidence/phase5b/admin-create/next-measurements.json), [índice SHA-256](../ui/evidence/phase5b/admin-create/evidence-index.json). Dos PNG Flutter y cuatro Next. Revisados visualmente ambos pares claro/oscuro y los estados web pendiente/éxito oscuro: shells/altura/composición diferentes; Next móvil requiere scroll para campos inferiores y Flutter agrupa nombres. Next conserva campos de texto de programa/campus, Flutter dropdowns. Nombres requeridos Flutter vs opcionales API/Next es diferencia explícita, no justificación para imponer otra política. No igualdad de píxeles ni cierre visual integral. Capturas contienen exclusivamente cuentas sintéticas; password aparece enmascarada y no se guarda en JSON ni URLs.

### Gates de esta continuación

| Gate | Resultado |
|---|---|
| Next completo/BFF |422 PASS,46 archivos,19,97s; BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test. |
| Next lint/typecheck | npm run lint / node node_modules/typescript/bin/tsc --noEmit:PASS. |
| Next producción | node node_modules/next/dist/bin/next build --webpack:PASS;compilación3,5s/TypeScript2,3s/26 páginas. Build final antes del backend integrado. |
| Flutter completo | flutter test --no-pub --reporter expanded:301 PASS,27s en primer gate y26s en repetición final;sin regenerar referencias anteriores. |
| Flutter analyze/formato | analyze final:PASS,2,2s;dart format --output=none --set-exit-if-changed del test nuevo:PASS,0 cambios. |
| Nuevas referencias | flutter test --no-pub --update-goldens test/core/theme/phase5b_admin_create_test.dart:4 PASS;solo2 PNG nuevas. |
| E2E específico |1 PASS,6 warnings,6,43s antes de añadir comprobación geométrica390. Intento anterior fallido no cuenta como éxito. |
| Backend/PostgreSQL completo |405 PASS,0 SKIP,51 warnings,456,40s;17 E2E,concurrencia y tres bases nuevas inicialmente vacías para migraciones existentes. |
| Ruff/Node | ruff check del wrapper y node --check del runner:PASS. |
| Rollback | git apply --reverse --check --unidiff-zero docs/audits/patches/phase5b-admin-create.patch:PASS;no se aplica. |

Entorno recuperado documentado en H01; mismas herramientas, sin instalaciones nuevas. Flutter usa FLUTTER_SUPPRESS_ANALYTICS=true, PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache y SDK /tmp/immuno-miguel-tools/flutter. Backend:

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_admin_create_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_admin_create_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_admin_create_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos, pendientes y rollback

La validación del navegador mejora la interacción; el servidor sigue siendo autoridad y rechaza valores no autorizados. El bloqueo es por instancia montada, sin nuevos locks entre pestañas o usuarios. No existe persistencia nueva del borrador ni de su contraseña en almacenamiento del navegador. GET fallido tras POST confirmado sigue siendo pendiente separado M02: no atribuir a este bloque la distinción de resultado de escritura/lectura implementada en otras pantallas. Tampoco cierra empty/error/retry/busy del listado ni posibles carreras de escritura del formulario Flutter. Reintentar explícitamente POST fallido no demuestra idempotencia de red ante un timeout incierto.

Rollback incremental persistente: [phase5b-admin-create.patch](patches/phase5b-admin-create.patch), limitado a una fuente funcional. Validar `git apply --reverse --check --unidiff-zero` contra el árbol actual antes de una reversión; no se aplicó. Copia/baseline1369 archivos y logs en /tmp/immuno-miguel-tools/phase5b-admin-create; puede desaparecer. No usar reset global que borre fases anteriores; no hay datos productivos/migración nueva que revertir.

S20/FASE5B PARTIAL;H02 PARTIAL con intención web UNKNOWN;C02/A07 UNKNOWN;lectores/dispositivos/zoom nativo/contraste global UNKNOWN;UI-16/UI-17 BLOCKED por alcance;T-02/T-03 PARTIAL y almacenamiento real pendiente. No cierre de Fase3B ni producción lista.


### Revisión final M01

**B5-M01a/M01b/M01c DONE en recorridos probados;S20/FASE5B PARTIAL.** Backend/PostgreSQL405 PASS/0 SKIP,51 warnings,456,40s:17 E2E y tres migraciones existentes;incluye el runner final con comprobación390. Next422 PASS/lint/typecheck/webpack PASS;Flutter301 PASS/analyze/formato PASS. Warnings existentes de SQLAlchemy noload/FCM no se silencian. No nuevas migraciones ni instalaciones.

Revisados git diff y diff incremental frente a baseline1369: una fuente funcional Next modificada,cuatro archivos nuevos de pruebas,tres documentos actualizados y10 artefactos nuevos (6 PNG,3 JSON,parche incremental). El gate regenera127 artefactos/índices de evidencia anteriores;12 índices se refrescaron preservando procedencia. Ningún archivo anterior eliminado ni golden Flutter anterior alterada. No cambios funcionales de backend/Flutter,contratos,permisos,auth,clínica,manifiestos/lockfiles o ámbitos excluidos.

794 referencias SHA-256 verificadas,0 ausentes/desajustes. Escaneo limitado de patrones de secretos de alta confianza en6 fuentes/tests/parche:0 coincidencias;sin whitespace final. No auditoría global de dependencias/secretos. git diff --check y comprobación del parche inverso --unidiff-zero:PASS,sin aplicar rollback ni hacer commit.

Pendiente siguiente M02: recuperación del listado y distinción de POST confirmado/GET fallido;inspeccionar antes de modificar. Nombres obligatorios Flutter,ámbito por dropdown/composición,lectores/dispositivos/zoom nativo y otros estados S20 siguen fuera del cierre M01. H02/C02/A07 conservan sus decisiones pendientes;UI-16/UI-17 BLOCKED por alcance;T-02/T-03 PARTIAL y almacenamiento real pendiente. No declarar Fase5B ni producción listas.


## Continuación — M02 recuperación de administradores Next, 2026-10-21

**B5-M02a/M02b/M02c DONE en Next verificado;S20/M03/FASE5B PARTIAL.** Alcance: listado y distinción escritura/lectura de la pantalla Next /admin/admins. Flutter se inspecciona y conserva como referencia de vacío;sin cambios de su formulario ni backend funcional. No se cierra la diferencia nativa M03 ni se cambian permisos,dominio,auth o contratos.

### Causas raíz y correcciones

| ID / prioridad | Causa y efecto demostrado | Solución |
|---|---|---|
| B5-M02a / P2 | useQuery no exponía isFetching;QueryError recibía refetch sin cancelRefetch:false ni retrying. No había refresco explícito ni mensaje de vacío;el formulario seguía visible ante error del listado. | Loading con role=status,vacío solo tras GET exitoso y mensaje No hay administradores creados,refresco explícito y retry compartido. Error retira lista/formulario/acciones;conserva el borrador únicamente en el estado de la misma vista hasta un nuevo GET exitoso. Refresco bloquea formulario,cancelación,crear/eliminar. |
| B5-M02b / P2 | useSafeMutation ya refresca lecturas antes del callback;invalidateQueries puede resolver aunque el GET falle. Ambos onSuccess mostraban éxito normal sin distinguir que la lectura había fallado. | Callback consulta estado real de admins tras la escritura confirmada. Ante GET fallido:aviso persistente seguro y toast warning;sin reenviar POST/DELETE. Aviso asociado a dataUpdateCount para no reaparecer en fallos ajenos posteriores. Alta confirmada limpia borrador/contraseña;carga fallida después de POST fallido conserva borrador y pide envío explícito. |
| B5-M02c / P2 | Eliminación invalidaba admins dos veces (helper+callback). Los errores de escritura solo tenían toast efímero. | Retira la invalidación redundante de eliminación;una recarga por escritura. Mensaje estático de fallo de POST/DELETE,no diagnóstico recibido. No se cambia confirmación ni endpoint/método/payload/permisos de eliminación. |
| B5-M03 / P2 / PARTIAL | Flutter AdminManagementScreen::_load guarda un error genérico pero build aún representa formulario y _admins vacío/retendido;_create/_deleteAdmin mezclan resultado de escritura con recarga y existen rutas de error de escritura que muestran texto del transporte. | Solo inspección en este bloque. Se necesita un bloque nativo de lectura/escritura separado con tests de GET fallido inicial/refresco,conservación de borrador,disposición y confirmaciones. No afirmar recuperación o paridad nativa por las capturas de vacío exitoso. |

Fuente modificada:`frontend-next/src/app/admin/admins/page.tsx`. Se reutilizan sin cambios QueryError,useSafeMutation,RoleGuard y API. Se actualiza una espera en `phase5b-field-labels.test.tsx`:ahora aguarda la carga autorizada antes de abrir el formulario;conserva assertions de label/foco/atributos. Fuente FastAPI inspeccionada:router GET/POST /admin/admins y DELETE /admin/admins/{id},AdminAccountService y CreateAdminRequest. El servidor sigue siendo autoridad;ningún cliente recalcula clínica.

### Pruebas y evidencia

Nuevos archivos:

- `frontend-next/src/components/__tests__/phase5b-admin-recovery.test.tsx`:27 tests. Seis HTTP401/403/404/429/500/503 de lectura tras datos+borrador;dos errores iniciales403/503;vacío/carga distintos,refresco bloqueado;creación/eliminación confirmadas×seis errores de GET;POST/DELETE fallidos con GET fallido no son confirmación;retry GET-only y doble retry compartido;aviso confirmado no se reutiliza tras una lectura exitosa posterior con structural sharing;cancelación no elimina y eliminación solo refresca una vez.
- `backend/tests/test_phase5b_admin_recovery_browser.py` + `frontend-next/tests/e2e/phase5b-admin-recovery-browser.mjs`:Chrome→webpack→BFF→FastAPI→PostgreSQL sintético. En claro/oscuro390:GET403/503 después de datos,vacío200 controlado,GET retenido bloquea acciones,alta POST200 y eliminación DELETE204 reales con GET503 posterior,retry único sin repetir escrituras;verifica presencia/ausencia real de cuenta tras recuperación. GET401 final usa expiración existente;student/admin reciben403 real en listado. Trece casos y diez PNG. No se interceptan escrituras para simular éxito.

Primera ejecución antes de editar:23 FAIL/2 PASS de25 casos. Después39 PASS/1 FAIL entre40 pruebas (incluye alta/labels anteriores):el nuevo test comprobaba habilitación antes de pintarse la notificación asíncrona de React Query;se cambia a waitFor del estado observable,conservando la assertion. Repetición40 PASS. Se añaden dos casos iniciales y la suite final ejecutada llega a449 PASS. E2E específico1 PASS/6 warnings/17,39s antes del ajuste final de formato;el gate integrado final también pasa con el build y el runner finales.

[Dos pares de vacío anotados](../ui/evidence/phase5b/admin-recovery/comparison-cases.json),[13 casos web](../ui/evidence/phase5b/admin-recovery/next-measurements.json),[índice](../ui/evidence/phase5b/admin-recovery/evidence-index.json). Referencias Flutter existentes M01,verificadas de nuevo por su suite:vacío bajo formulario siempre visible. Next vacío sin formulario abierto y con acción de crear. Diferencias explícitas de shell,altura,exposición del formulario y dropdowns. No captura nueva Flutter ni prueba de su recuperación fallida;M03 permanece abierto. Ocho estados web de error/escritura confirmada no tienen par nativo. Se inspeccionaron vacío claro,GET403 claro y escritura confirmada/lectura fallida de creación oscuro y eliminación claro. Algunas capturas contienen toasts efímeros de acciones anteriores próximas;el aviso persistente dentro de main es el estado comprobado y su procedencia no se reutiliza. Los demás casos están cubiertos por assertions/capturas,sin afirmar igualdad visual ni contraste global.

### Gates de M02

| Gate | Resultado observado |
|---|---|
| Next completo/BFF |449 PASS,47 archivos,18,10s;BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test. |
| Next lint/typecheck |npm run lint / node node_modules/typescript/bin/tsc --noEmit:PASS. |
| Next producción |node node_modules/next/dist/bin/next build --webpack:PASS;compilación2,6s/TypeScript1,951s/26 páginas. |
| Flutter regresiones |flutter test --no-pub --reporter expanded:301 PASS,18s;sin regenerar goldens. |
| Flutter analyze |analyze --no-pub:PASS,6,7s;no fuente Dart modificada que formatear. |
| E2E específico |1 PASS,6 warnings,17,39s.No sustitución de escrituras reales por respuestas simuladas. |
| Backend/PostgreSQL completo |406 PASS,0 SKIP,51 warnings,474,91s;concurrencia,18 E2E y tres bases locales inicialmente vacías para migraciones existentes. |
| Ruff/Node |ruff check del wrapper nuevo y node --check del runner:PASS. |
| Rollback |git apply --reverse --check --unidiff-zero docs/audits/patches/phase5b-admin-recovery.patch:PASS;no se aplica. |

Herramientas existentes del entorno H01/M01,sin instalaciones ni cambios de dependencias. Comandos Flutter con FLUTTER_SUPPRESS_ANALYTICS=true,PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache y SDK /tmp/immuno-miguel-tools/flutter. Backend:

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_admin_recovery_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_admin_recovery_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_admin_recovery_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos,límites y rollback

La confirmación del aviso significa respuesta exitosa recibida del servidor,no resolución de un timeout incierto. No se añade idempotencia de POST/DELETE ni coordinación entre pestañas. dataUpdateCount limita la procedencia del aviso a la misma lectura fallida;desaparece con lectura exitosa aunque el servidor devuelva datos estructuralmente idénticos. Los errores solo conservan el borrador en memoria de la vista;no se guarda contraseña en JSON,URLs o almacenamiento del navegador. No modifica la política de sesión;tests unit401 no prueban el interceptor móvil y E2E solo verifica expiración web existente.

Rollback persistente:[phase5b-admin-recovery.patch](patches/phase5b-admin-recovery.patch),limitado a la única fuente funcional de M02,contra estado M01. Se comprobó inverso --unidiff-zero sin aplicarlo;revisar/revalidar ante cambios posteriores. Mantener tests/documentar reversión,no reset global. Baseline1383 archivos,copias y logs en /tmp/immuno-miguel-tools/phase5b-admin-recovery;no es garantía de persistencia del directorio temporal. Migraciones nuevas:**ninguna**. No datos institucionales ni commit.

M03 nativo y S20 integral PARTIAL;H02 intención web UNKNOWN;C02/A07 UNKNOWN;accesibilidad nativa/zoom/lectores/dispositivos/contraste integral UNKNOWN;UI-16/UI-17 BLOCKED por alcance;T-02/T-03 PARTIAL y almacenamiento real pendiente. No cierre de Fase3B ni producción lista.


### Revisión final M02

**B5-M02a/M02b/M02c DONE para Next;M03/S20/Fase5B PARTIAL.** Backend/PostgreSQL406 PASS/0 SKIP,51 warnings,474,91s:18 E2E,concurrencia y tres migraciones existentes. Incluye creación M01 y recuperación M02 sobre build final. Next449 PASS/lint/typecheck/webpack PASS;Flutter301 PASS/analyze PASS. Los warnings existentes de noload/FCM se conservan,sin silenciarlos. Ningún cambio funcional ni prueba se editó después del gate integrado.

Frente a baseline1383:una fuente funcional Next y una espera del test de etiquetas modificadas;tres tests nuevos (componente,wrapper y runner),tres documentos actualizados y14 artefactos nuevos (10 PNG,3 JSON y parche incremental). El gate regeneró124 artefactos/índices de evidencia anteriores;13 índices se refrescaron preservando procedencia. Ningún archivo anterior eliminado ni golden Flutter previa alterada. Backend/Flutter funcional,contratos,permisos,auth,reglas clínicas,dependencias/manifiestos/lockfiles y ámbitos excluidos intactos.

808 referencias SHA-256 verificadas,0 ausentes/desajustes. Escaneo acotado de patrones de secretos de alta confianza en6 fuentes/tests/parche:0 coincidencias;sin whitespace final. No auditoría universal de secretos ni dependencia.Sintéticos únicamente,sin tokens/cookies/contraseñas/PII real en metadatos o capturas. git diff y diff incremental revisados;git diff --check PASS;parche inverso --unidiff-zero comprobado,sin aplicar rollback ni commit. Migraciones nuevas:**ninguna**.

Siguiente M03:corregir lectura/escritura del formulario Flutter de administradores con pruebas antes de implementación;no copiar otras reglas ni opciones institucionales por este cambio. S20 integral/lectores/teclado/dispositivos/zoom nativo y composición siguen pendientes. H02/C02/A07 separados;UI-16/UI-17 BLOCKED por alcance;T-02/T-03 PARTIAL y almacenamiento real pendiente. No cierre de Fase3B ni certificación productiva.


## Continuación — M03 recuperación de administradores Flutter, 2026-10-21

**B5-M03a/M03b/M03c DONE en recuperación probada;R01 DONE;S20/FASE5B PARTIAL.** Se crea además la [lista finita de cierre R01–R07](phase5b-remaining-work.md):22 pantallas incluidas del inventario existente,más exclusiones explícitas. Sus grupos no son estimaciones temporales ni resultados de prueba. R02–R07 siguen pendientes;cerrar M03 no cierra5B.

### Causas raíz y solución

| ID / prioridad | Evidencia / impacto previo | Corrección acotada |
|---|---|---|
| B5-M03a / P2 | AdminManagementScreen::_load usaba el mismo _error que el POST. Build mostraba formulario/lista incluso con GET fallido,con vacío falso inicial o administradores retenidos. Refresh podía solaparse y ocultaba por completo el formulario durante cualquier GET. | _readError separado;loading inicial distinto de datos/error/vacío;error retira formulario/lista/acciones y ofrece GET-only retry. _inFlightLoad comparte la lectura;reintento permanece bloqueado mientras carga. Borrador/controladores se conservan dentro de la misma pantalla;GET exitoso retira el error. |
| B5-M03b / P2 | Alta/eliminación no distinguían escritura confirmada de recarga fallida. Alta limpiaba controladores después del await sin comprobar mounted;dropdowns podían conservar selección anterior tras limpiar variables. | _confirmedChange solo se presenta cuando la escritura respondió con éxito y falla el GET posterior;retry no repite POST/DELETE. Lectura exitosa invalida el aviso. Guardas mounted antes de controladores/state/nueva lectura;alta confirmada renueva la key del formulario para limpiar también selecciones. POST fallido conserva borrador y necesita envío explícito. |
| B5-M03c / P2 | Campos seguían editables durante POST;_create no tenía exclusión sincrónica y _deleteAdmin no coordinaba confirmaciones/escrituras. El catch de DELETE concatenaba el transporte con $e. | _busy de carga/alta/eliminación bloquea campos,dropdowns,crear,eliminar/mensaje y refresh mientras escribe. Guardas sincrónicas antes de await evitan dos POST o dos diálogos DELETE en un frame. Cancelar sigue sin eliminar. Mensajes estáticos de fallo de escritura y errores HTTP seguros,sin diagnóstico/PII de transporte. |

Única fuente funcional:`frontend/lib/features/admin/presentation/screens/admin_management_screen.dart`. Mantiene validadores de correo/contraseña/nombre/apellido,opciones AcademicOptions,carga/creación/eliminación por AdminRemoteDataSource y confirmación de borrado. No convierte los nombres opcionales del backend en política nueva ni cambia la validación Flutter existente;esa diferencia de representación queda registrada para el barrido de S20. No cambia esquema clínico ni autorización por roles.

Se inspeccionó ApiClient::onRequest/onResponse:las guardas existentes de generación de sesión rechazan respuestas de otra generación;permanecen intactas. Los tests nuevos de Dio controlado no prueban el interceptor ni el cambio de cuenta/dispositivo real. El guard de inicio de mensaje solo impide abrirlo mientras la pantalla está ocupada/con error;no cambia destinatario,payload,navegación ni implementación del compositor.

### Pruebas y evidencia

Nuevo `frontend/test/core/theme/phase5b_admin_native_test.dart`:26 widget tests con pantalla/datasource reales y Dio controlado. Seis estados HTTP401/403/404/429/500/503 tras refresco con borrador;403/503 iniciales distintos de vacío;creación/eliminación confirmadas×GET403/503;retry no repite escritura;aviso no reaparece después de una lectura exitosa y nuevo fallo ajeno;escritura fallida conserva borrador sin diagnóstico;alta en mismo frame una sola vez,campos/dropdowns bloqueados y refresh sin GET mientras escribe;cancelación y doble confirmación DELETE;dispose durante lectura/escritura tanto de éxito como de fallo;cuatro nuevas referencias403/503×claro/oscuro390.

Primera reproducción23 casos:17 FAIL/6 PASS;una de las17 era un cast incorrecto del harness RawTooltip→IconButton,no un defecto de aplicación. Después de la corrección funcional:22 PASS/1 FAIL por ese cast;se selecciona el IconButton por su tooltip sin retirar la assertion de doble confirmación. Se añaden tres casos de dispose con fallo:26 PASS,cuatro referencias nuevas. Analyze inicial encontró tres avisos de llaves del test;corregidos sin desactivar reglas. La selección del dropdown del test se hace sobre los dos controles reales y sus menús,programa/campus enviados se comprueban contra fixture sintético. No prueba HTTP móvil real.

[Cuatro pares anotados](../ui/evidence/phase5b/admin-native/comparison-cases.json),[índice](../ui/evidence/phase5b/admin-native/evidence-index.json):cuatro PNG Flutter nuevos y cuatro PNG Next reutilizados de M02. Flutter captura fallo inicial y Next fallo de refresco de datos previos de PostgreSQL;misma retirada de contenido y acción GET-only,centro nativo vs alert web/shell distintos. Revisados visualmente403 claro y503 oscuro;sin afirmar igualdad de píxeles ni contraste global. Las referencias de formulario exitoso M01 se conservan sin regeneración. No hay captura nueva Next ni E2E nuevo que simule una aplicación Flutter en un navegador.

### Gates M03

| Gate | Resultado observado |
|---|---|
| Nuevas pruebas Flutter |26 PASS,5s;flutter test --no-pub --update-goldens test/core/theme/phase5b_admin_native_test.dart,inicializa solo4 PNG nuevos. |
| Flutter completo |327 PASS,28s en primer completo;repetición final327 PASS,18s tras reforzar assertions de programa/campus.flutter test --no-pub --reporter expanded,sin --update-goldens.Referencias anteriores intactas. |
| Flutter analyze |analyze --no-pub:PASS,2,7s;repetición final4,2s.PASS de formato de dos fuentes. |
| Next completo/BFF |449 PASS,47 archivos,20,00s;BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test. |
| Next lint/typecheck |npm run lint / node node_modules/typescript/bin/tsc --noEmit:PASS,sin cambios de fuentes Next. |
| Next producción |node node_modules/next/dist/bin/next build --webpack:PASS;compilación2,9s/TypeScript1,534s/26 páginas. |
| Backend/PostgreSQL |406 PASS,0 SKIP,51 warnings,491,20s;18 E2E de regresión web,concurrencia y tres bases locales nuevas inicialmente vacías para migraciones existentes.No acredita transporte/dispositivo Flutter. |
| Rollback |git apply --reverse --check --unidiff-zero docs/audits/patches/phase5b-admin-native.patch:PASS;no se aplica. |

Herramientas existentes,sin instalaciones ni upgrades. Flutter con FLUTTER_SUPPRESS_ANALYTICS=true,PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache y SDK /tmp/immuno-miguel-tools/flutter. Backend completo:

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_admin_native_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_admin_native_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_admin_native_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos,límites y rollback

Coordinación por instancia de pantalla,no entre procesos/clientes/pestañas. La confirmación significa respuesta recibida del backend,no idempotencia ante timeout incierto. Un POST/DELETE fallido conserva datos y requiere nueva acción explícita;su resultado no se infiere del estado clínico. La lectura fallida oculta contenido anterior;el borrador vive solo en memoria de la pantalla y se destruye con dispose. Los validadores/formularios/catálogos existentes siguen distintos en algunos aspectos de Next;no se afirma paridad integral de S20 por cerrar recuperación.

Al renovar la key tras alta se reinician selecciones/validación de esa instancia sin cambiar las opciones;no ocurre en un POST fallido ni en refresh de borrador. Mensajería del administrador bloqueada mientras hay escritura/lectura pendiente,conservando sus funciones. Error pane nuevo usa onSurface para botón retry;no representa validación universal con lector/zoom/dispositivo o teclado virtual. HTTP nativo,TalkBack/VoiceOver y hardware UNKNOWN.

[Parche incremental](patches/phase5b-admin-native.patch) de una única fuente Flutter:comprobación inversa --unidiff-zero PASS,sin aplicarla;revisar/revalidar antes de revertir con cambios posteriores. Copia/baseline1400 archivos y logs en /tmp/immuno-miguel-tools/phase5b-admin-native,temporal. No reset global ni borrado de historia. Migraciones nuevas:**ninguna**. Sin backend/Next funcional,contratos,permisos,auth,clínica,dependencias/lockfiles o ámbitos excluidos modificados. Sin commit.

Lista finita:R01 DONE en recuperación probada;R02 formularios/cuentas,R03 listas/detalle/esquema/catálogo,R04 consolidación de estados ya intervenidos,R05 accesibilidad,R06 decisiones H02/C02/A07 yR07 gate/cierre. R02–R04 exigen barrido de cobertura,no repetir como abiertas correcciones DONE. UI-16/UI-17 BLOCKED por alcance;T-02/T-03 y Fase3B PARTIAL,almacenamiento real pendiente. Sin producción lista.


### Revisión final M03 y R01

**B5-M03a/M03b/M03c DONE en recuperación probada;R01 DONE;S20/Fase5B PARTIAL.** Backend/PostgreSQL406 PASS/0 SKIP,51 warnings,491,20s;18 E2E web existentes,concurrencia y tres migraciones existentes. Next449 PASS/lint/typecheck/webpack PASS;Flutter327 PASS/analyze/formato PASS. Tras el backend se reforzaron únicamente dos assertions de programa/campus en los seis casos de recuperación:Flutter completo repetido327 PASS/18s y analyze4,2s PASS.Sin cambios funcionales después del gate backend;no se atribuye esa repetición de assertions al backend anterior.Warnings existentes de noload/FCM conservados.

Frente a baseline1400:una fuente funcional Flutter modificada y un test Flutter nuevo;tres documentos previos actualizados y una lista finita nueva;7 artefactos nuevos (4 PNG,2 JSON y parche incremental). El gate regeneró117 artefactos/índices de evidencia anteriores;13 índices se refrescaron preservando procedencia.Ningún archivo anterior eliminado ni golden Flutter previa alterada.No backend/Next funcional,permisos,contratos,auth,clínica,dependencias/manifiestos/lockfiles o ámbitos excluidos modificados.Migraciones nuevas:**ninguna**.

817 referencias SHA-256 verificadas,0 ausentes/desajustes.Escaneo acotado de patrones de secretos de alta confianza en3 fuentes/test/parche:0 coincidencias;sin auditoría universal.Nuevos artefactos solo sintéticos,sin credenciales/tokens/cookies/PII real.Revisados git diff y diff incremental;git diff --check PASS y parche inverso --unidiff-zero comprobado,sin aplicar rollback ni commit.

Los seis grupos restantes están delimitados en [R02–R07](phase5b-remaining-work.md):tres grupos de cobertura de pantallas,accesibilidad,decisiones y cierre integrado.No son seis defectos ni una estimación temporal;las pantallas pendientes requieren completar su matriz aplicable.R01 no resuelve composición/nombres del formulario S20 ni pruebas físicas;siguen dentro de esa cobertura.UI-16/UI-17 BLOCKED por alcance;H02/C02/A07 UNKNOWN,T-02/T-03 y Fase3B PARTIAL,almacenamiento real pendiente.No producción lista.


## Continuación — R02A formularios de cuenta, 2026-10-21

**B5-R02A01–R02A06 DONE en controles probados;R02/FASE5B PARTIAL.** S02/S03/S09:recuperación,reset y cambio de contraseña.Se crea [cobertura finita de las siete pantallas R02](../ui/phase5b-r02-coverage.md).S00/S01 inspeccionados sin cambios;S18/S22 base separados.No ampliar el alcance a autenticación,clínica,firma o certificados.

### Causas raíz

| ID / prioridad | Evidencia y efecto | Corrección |
|---|---|---|
| B5-R02A01 / P2 | Next solo bloqueaba el botón con estado React;dos submits antes del render podían lanzar dos peticiones.Campos y controles de visibilidad editables durante la solicitud.Flutter también solo bloqueaba botón,sin guarda al comienzo. | Referencia sincrónica de envío Next y _isLoading al entrar en Flutter;fieldset/campos/controles de visibilidad bloqueados hasta resolver la operación;payload y validadores existentes intactos. |
| B5-R02A02 / P2 | Forgot Next mostraba detail/error.message y diagnósticos CORS/Render;reset etiquetaba todo fallo como token inválido;change mostraba detail y confundía401 con contraseña actual incorrecta.Flutter reset/change mostraban respuesta vía dioErrorMessage. | Helpers de presentación account-form-error.ts/account_form_error.dart:mensajes estáticos por HTTP y timeout,sin cuerpo/diagnóstico.400 reset=token inválido,400 change=contraseña actual incorrecta según AuthService;401=sesión expirada,5xx=servicio/servidor.No cambia error API. |
| B5-R02A03 / P2 | Flutter hacía setState después de respuestas con widget desmontado y change consultaba ref para logout después del await.Next podía actualizar/renderizar destino tras desmontaje. | Guardas mounted antes de estado;change captura el mismo notifier antes de await para conservar solicitud→logout incluso al desmontar,sin usar ref inválida;Next conserva await changePassword→await logout→redirect login,con guarda de representación.No cambio de servicios/store/FCM. |
| B5-R02A04 / P2 | Forgot/change Flutter usaban Column sin scroll;errores Next aria-invalid sin descripción;reset nativo sin tooltips de visibilidad;copy Flutter aún afirmaba contraseña=cédula. | Scroll con altura mínima preservando composición ordinaria,descripciones de errores asociadas por ID,tooltips reset y copy de contraseña temporal recibida por correo.No cambia política de contraseña. |
| B5-R02A05 / P2 | Capturas nuevas demostraron texto de error C94242 sobre071416 con contraste3,87 en oscuro. | Solo mensajes de error de estos3 formularios usan darkTextPrimary en oscuro;claro mantiene estilo existente.Tests de luminancia del estado503>=4,5,incluido fondo compuesto de reset.No declaración global de contraste. |
| B5-R02A06 / P2 | Captura web de cambio de contraseña:decoración de UccBrandBackground se pintaba por encima de campos/error/botón y navegación;AppShell ya tenía corrección acotada en otras rutas. | Extiende capa relative/z-0 únicamente a /student/change-password y /admin/change-password.Cuatro regresiones:dos rutas positivas ydos prefijos parecidos negativos.No clipping ni cambio de rutas/permisos. |

Fuentes existentes modificadas:Next `(auth)/forgot-password/page.tsx`,`(auth)/reset-password/page.tsx`,`components/change-password-form.tsx`,`components/app-shell.tsx`;Flutter `forgot_password_screen.dart`,`reset_password_screen.dart`,`change_password_screen.dart`.Nuevos helpers `frontend-next/src/lib/ui/account-form-error.ts` y `frontend/lib/core/error/account_form_error.dart`.El enum AccountFormOperation es interno de presentación,no un estado de dominio/API.

Backend AuthService::change_password/reset_password inspeccionado:contraseña actual incorrecta y token inválido generan400;credenciales inválidas/expiradas401 y validación422.No se cambian servicios,stores,HTTP client,BFF,JWT/refresh/logout,esquemas ni reglas de contraseña.Normalizaciones previas (incluido trim de reset en ambos clientes) se conservan,no se redefine la contraseña.La antigua descripción del audit sobre copy Next=cédula ya no era vigente;solo Flutter tenía ese texto.

### Pruebas y comparación

- Nuevo Next `phase5b-account-forms.test.tsx`:32 pruebas.Invalidación con error asociado,duplicación en mismo frame,controles bloqueados,éxito y orden logout/ruta,HTTP400/401/403/422/429/500/503 seguros,borrador,reintento explícito,timeout,token ausente y copy de cambio obligatorio.Antes24 FAIL/8 PASS;después32 PASS.
- Se amplía `phase5b-communications-layers.test.tsx` con4 casos acotados de rutas.No se retiran assertions ni se habilitan prefijos arbitrarios.
- Nuevo Flutter `phase5b_account_forms_test.dart`:37 pruebas (34 widget+3 mapeos adicionales).Doble submit,validación,HTTP400/401/429/503,403/422/500/timeout/desconocido sin diagnóstico,éxito/errores tras dispose,conservación de borrador,logout una vez,viewport corto/TextScaler2,copy obligatoria y6 goldens nuevas.El primer intento falló antes de ejecutar por await de TestTextInput.hide(),que devuelve void;corregido.No se presenta como evidencia funcional de defectos.La ejecución válida posterior34 PASS;se amplía a37 PASS y se comprueba contraste oscuro.
- Nuevo wrapper `backend/tests/test_phase5b_account_forms_browser.py` y runner `frontend-next/tests/e2e/phase5b-account-forms-browser.mjs`:login real webpack→BFF→FastAPI→PostgreSQL;POST de los tres formularios interceptados con errores explícitos503/400/429,sin envío de correo ni modificación real de contraseñas.Ocho casos,6 screenshots.Doble submit una petición,campos congelados,borrador recuperado,error seguro y ausencia de overflow390.No simula éxito ni se atribuye una integración real de reset/cambio al caso503.

E2E específico inicial1 PASS/6 warnings/5,62s;backend completo407 PASS/0 SKIP/51 warnings/454,24s,19 E2E y tres migraciones existentes,sobre build previo a corrección de capas.Durante ese gate se diagnosticó la capa;se esperó su final antes de reconstruir.No atribuir ese407 al build final:la corrección scoped se verifica por suite Next final y repetición E2E específica sobre el nuevo build.El backend funcional permanece idéntico.

[Seis pares anotados](../ui/evidence/phase5b/account-forms/comparison-cases.json),[casos web](../ui/evidence/phase5b/account-forms/next-measurements.json),[índice](../ui/evidence/phase5b/account-forms/evidence-index.json).6 PNG Flutter y6 Next;datos sintéticos,contraseñas enmascaradas,token no representado ni guardado en metadata.Las imágenes finales web provienen de la repetición tras capas;las iniciales se reemplazaron solo en este bloque nuevo.Revisados pares forgot claro,cambio oscuro y reset claro después de las correcciones.La capa web deja de tapar el error y el mensaje oscuro Flutter resulta legible;composición/requisitos truncados nativos y accesibilidad integral siguen pendientes.No igualdad de píxeles,hardware o éxito SMTP institucional.

### Gates

| Gate | Resultado observado |
|---|---|
| Next inicial/actualizado |481 PASS inicial;485 PASS final,48 archivos,15,20s (32 tests de formularios+4 regresiones de capas nuevos). |
| Next lint/typecheck |Lint final PASS sin warnings;primer lint detectó helper CDP sin uso y se retiró.Node tsc --noEmit final PASS. |
| Next producción |Build inicial PASS;build final webpack PASS,compilación5,0s/TypeScript7,3s/26 páginas,después de acabar los E2E del gate integrado. |
| Flutter |37 nuevas PASS;364 completo PASS,19s tras corrección de contraste.Analyze final PASS,2,2s. |
| Backend/PostgreSQL |407 PASS,0 SKIP,51 warnings,454,24s;19 E2E,concurrencia y migraciones existentes sobre build inicial.Sin cambios de backend entre builds. |
| E2E final específico |1 PASS,6 warnings,5,67s sobre build final;comprueba capa por encima de decoración y reexporta6 capturas. |
| Ruff/Node |ruff check de wrapper y node --check de runner:PASS. |
| Rollback |git apply --reverse --check --unidiff-zero docs/audits/patches/phase5b-account-forms.patch:PASS,sin aplicar. |

Comandos Next:npm test con BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a,npm run lint,node node_modules/typescript/bin/tsc --noEmit,node node_modules/next/dist/bin/next build --webpack.Flutter con SDK /tmp/immuno-miguel-tools/flutter,FLUTTER_SUPPRESS_ANALYTICS=true,PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache:analyze --no-pub,test --no-pub --reporter expanded;update-goldens limitado al nuevo archivo.No dependencias instaladas o actualizadas.

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_account_forms_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_account_forms_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_account_forms_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Límites y rollback

Envío único por instancia;no nueva idempotencia de red.Un timeout no permite inferir si una escritura llegó al servidor;reintento sigue siendo explícito.Los mocks no validan correo/links/reset real del cliente ni transporte móvil.Se conservan las pruebas backend de email/sesiones/concurrencia;credenciales/dataset institucional no utilizados.No se declaran todos los roles/estados/composición/lectores/teclado físico validados por seis pares.

[Rollback incremental](patches/phase5b-account-forms.patch):7 fuentes previas y2 helpers nuevos,comprobación inversa --unidiff-zero,sin aplicar,revisar ante cambios posteriores.Para recuperar comportamiento anterior se retiran también los helpers nuevos mediante ese parche;no borrar en bloque otros archivos.Baseline1409,copias y logs bajo /tmp/immuno-miguel-tools/phase5b-account-forms,temporal.Migraciones nuevas:**ninguna**.Sin commit.

R02 continúa PARTIAL:S18 alta/importación y S22 perfil base requieren correcciones propias;S00/S01 y comparación integral de formularios requieren cobertura restante.R03–R07 conservados,H02/C02/A07 UNKNOWN;UI-16/UI-17 BLOCKED por alcance;T-02/T-03 y Fase3B PARTIAL,almacenamiento real pendiente.Sin Azure,Maps,PDF/QR,stores o clínica nueva.


### Revisión final R02A

**B5-R02A01–R02A06 DONE en controles probados;R02 y Fase5B PARTIAL.** 32 nuevas pruebas de formularios Next y4 regresiones de capas:485 PASS,lint/typecheck/webpack final PASS.Flutter37 nuevas:364 PASS,analyze/formato PASS.Backend/PostgreSQL407 PASS/0 SKIP,51 warnings,454,24s;19 E2E y tres migraciones existentes,sobre build previo al ajuste de capas.Después del ajuste:E2E específico final1 PASS/6 warnings/5,67s sobre nuevo build y Next completo final485 PASS.No atribuir toda la suite backend al build posterior.Los warnings existentes de noload/FCM no se silencian.

Frente a baseline1409:7 fuentes funcionales existentes modificadas (4 Next/3 Flutter),2 helpers de presentación nuevos,1 test previo ampliado y4 archivos de tests nuevos;4 documentos previos actualizados y1 cobertura R02 nueva;16 artefactos nuevos (12 PNG,3 JSON y parche).El gate regeneró142 artefactos/índices de evidencia anteriores;14 índices se refrescaron preservando procedencia.Ningún archivo anterior eliminado ni golden Flutter anterior alterada.No backend funcional,servicios/store/BFF/FCM/JWT,contratos,payloads,validadores/reglas de contraseña,clínica,dependencias/manifiestos/lockfiles o ámbitos excluidos modificados.Migraciones nuevas:**ninguna**.

831 referencias SHA-256 verificadas,0 ausentes/desajustes.Escaneo acotado de patrones de secretos de alta confianza en15 fuentes/tests/parche:0 coincidencias;sin auditoría universal.Sin datos institucionales ni credenciales reales en pruebas;metadatos sin contraseñas/tokens/cookies/PII real.Revisados git diff y diff incremental;git diff --check y parche inverso --unidiff-zero PASS,sin aplicar rollback ni commit.

R02 sigue abierto:próximo R02B alta/importación S18;luego perfil base S22 y cobertura pendiente S00/S01 y representación integral de los formularios.No cerrar R02 por la corrección de errores de3 pantallas.R03–R07 siguen delimitados en lista finita.UI-16/UI-17 BLOCKED;H02/C02/A07 UNKNOWN,T-02/T-03/Fase3B PARTIAL y almacenamiento real pendiente.Sin producción lista.


## Continuación — R02B alta/importación de estudiantes, 2026-10-21

**B5-R02B01–R02B05 DONE en controles probados;S18/R02/Fase5B PARTIAL.** S18 únicamente:validación/envío manual,exclusión de operaciones,archivo/previsualización/resultado,lifecycle y capa visual. FastAPI conserva autoridad y contratos. No nuevas opciones institucionales,reglas de matrícula o clínicas,auth ni firma/certificados.

### Causas raíz y correcciones

| ID / prioridad | Causa raíz / impacto | Solución acotada |
|---|---|---|
| B5-R02B01 / P2 | Next tenía required/type=email en inputs pero creación mediante onClick fuera de form;la validación nativa y envío Enter no se ejecutaban como formulario. | Form nativo con fieldset y botón asociado por ID;payload limpio y birth_date YYYY-MM-DD conservados. Enter real Chrome y bloqueo de inválidos comprobados. No validación clínica nueva. |
| B5-R02B02 / P2 | Tres mutaciones Next con locks independientes,campos editables y selección Flutter sin lock hasta después de await picker;crear/importar podían solaparse o lanzar selecciones duplicadas.Flutter _submit tampoco tenía guarda inicial. | Lock sincrónico compartido por instancia Next y _busy Flutter desde antes de abrir picker;controles y borrador bloqueados durante la operación;File/payload capturados para esa solicitud.No idempotencia distribuida. |
| B5-R02B03 / P2 | Next retenía preview al iniciar otra lectura fallida y después de importar,por lo que podía confirmar un resultado antiguo;panel local podía conservar página2 al reemplazar resultado del mismo archivo. | Retirar preview/resultados antes de cada nueva previsualización y consumir preview al confirmar un intento,exitoso o fallido;reintento exige vista previa explícita.El panel se desmonta/reinicia a página1.Sin inventar endpoint paginado ni descargar registros adicionales. |
| B5-R02B04 / P2 | Flutter mostraba excepción import cruda y hacía setState tras create fallido sin mounted;picker/date-picker podían completar tras dispose.Next callbacks podían navegar tras desmontar. | Mensajes UI estáticos seguros y error visible persistente;importación conserva SnackBar seguro visible sin recorrer el formulario;mounted antes de representación/lectura de ref tras picker.Next conserva protección de propietario de useSafeMutation y añade guarda de componente.No cuerpos de error/diagnósticos en pantalla. |
| B5-R02B05 / P2 | Captura web nueva mostró aro decorativo sobre botón Crear estudiante;AppShell tenía capa corregida solo en rutas anteriores. | Extender política relative/z-0 solo a /admin/students/create;pruebas positiva y dos prefijos negativos.No clipping ni modificación del fondo en otras rutas. |

La confirmación Next con will_create=0 se deshabilita según el conteo de FastAPI,igual que el diálogo Flutter existente;no nuevo criterio de validez de fila. Eliminadas dos invalidaciones redundantes Next:useSafeMutation ya cancela/refresca las mismas consultas de estudiantes/auditoría antes del callback.No cambia el helper compartido. Mensaje Flutter oscuro usa texto primario del tema para evitar repetir el contraste insuficiente ya demostrado en R02A;no rediseño global.

### Archivos y contratos

Fuentes funcionales existentes:frontend-next/src/app/admin/students/create/page.tsx,frontend-next/src/components/app-shell.tsx,frontend/lib/features/admin/presentation/screens/create_student_screen.dart. Test existente ampliado:phase5b-communications-layers.test.tsx (tres casos). Nuevos tests:phase5b-student-create.test.tsx,phase5b_student_create_test.dart,backend/tests/test_phase5b_student_create_browser.py y frontend-next/tests/e2e/phase5b-student-create-browser.mjs.

Endpoints/métodos conservados:POST /admin/students,POST /admin/students/import/preview y POST /admin/students/import;Next sigue usando BFF /api y CSRF existentes.Flutter utiliza el mismo datasource/Dio. Sin cambios backend funcionales,schemas,enums,permisos,auth,normalización de payload o reglas de importación. Sex inicial Flutter male/Next female y programa/campus por rol ya eran distintos:se conservan,no se decide equivalencia institucional por este bloque.A07 semestres no alterado.Fecha de nacimiento no se convierte a UTC.

### Pruebas y evidencia

- Next:11 nuevas pruebas de formulario,validación nativa,fecha,mutación única y exclusión cruzada,campos congelados,borrador,preview obsoleta/página2,misma ruta de archivo,conteo0,resultados/invalidación y completion tras unmount. Tres regresiones nuevas de capa. Suite final499 PASS/49 archivos,13,76s tras reforzar assertions de ausencia de toast después de unmount.
- Flutter:18 nuevas pruebas de validación,doble envío,lock de picker/cancelación,HTTP401/403/409/422/429/503 seguros,borrador,confirmación explícita,archivo multipart capturado,cancelación/0 filas,llegada tras dispose y dos goldens nuevas. Completo382 PASS/20s. Analyze final PASS/2,2s,formato de los dos Dart PASS.
- E2E:login admin real→crear sintético mediante Enter→detalle→seleccionar CSV sintético→preview→importación→preview existente. Chrome/webpack/BFF/FastAPI/PostgreSQL reales;wrapper verifica fecha de ambos perfiles y ámbito Medicina/Bogotá en DB. Una re-preview503 se controla expresamente para probar que retira autorización obsoleta,no se presenta como caída real. Correo y FCM deshabilitados por fixture;no envíos ni credenciales institucionales.
- Ejecución específica previa a capa:1 PASS/6 warnings/5,07s. Dos intentos previos fallaron por serialización de expresiones/CSV en el runner (no fallo de aplicación),corregidos y repetidos. Primer widget falló por pumpAndSettle con spinner pendiente en fondo de diálogo;se cambió a bombeo acotado,no se retiran assertions. Typecheck inicial detectó dos errores del nuevo test (total_rows/ByRoleOptions),corregidos. Analyze inicial tres avisos de llaves del test,corregidos.
- [Dos pares de preview](../ui/evidence/phase5b/student-create/comparison-cases.json),[mediciones navegador](../ui/evidence/phase5b/student-create/next-measurements.json) e [índice SHA-256](../ui/evidence/phase5b/student-create/evidence-index.json). Flutter modal frente a web inline son composiciones previas;no igualdad de píxeles. Viewport390;sin prueba física/lector/zoom o todos los roles.

### Gates finales

| Gate | Resultado |
|---|---|
| Next tests |499 PASS/49 archivos,12,93s tras capa. |
| Next lint/typecheck |PASS;typecheck explícito y TypeScript del build. |
| Next build webpack |PASS sobre fuentes finales;sin reconstrucción durante E2E. |
| Flutter |382 PASS/analyze PASS;goldens existentes no regeneradas. |
| Backend/PostgreSQL/migraciones/concurrencia/E2E |408 PASS/0 SKIP,51 warnings,466,45s;20 E2E y tres migraciones existentes,sobre build webpack final. |
| Ruff / Node runner |PASS. |
| Diff / rollback |Revisión incremental y git diff --check PASS;rollback inverso comprobado,sin aplicar. |

Comandos Next:npm test con BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a;npm run lint;node node_modules/typescript/bin/tsc --noEmit;node node_modules/next/dist/bin/next build --webpack.Flutter:SDK3.41.6 /tmp/immuno-miguel-tools/flutter,FLUTTER_SUPPRESS_ANALYTICS=true,PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache;analyze --no-pub y test --no-pub --reporter expanded.Update-goldens limitado al nuevo archivo;test completo posterior sin esa opción.No dependencias/versiones actualizadas.El primer comando npm exec se lanzó desde raíz por error,se interrumpió y se utilizó Vitest local instalado;no instalación ni manifiesto nuevo.

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_student_create_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_student_create_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_student_create_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos,límites y rollback

Un timeout no demuestra si la escritura se confirmó;se informa incertidumbre y exige revisar lista/preview antes de reintentar,sin promesa de idempotencia de red.El lock es por instancia,no entre pestañas. Next require/type=email sigue criterio HTML ya declarado,no reproduce todas las validaciones FastAPI.Títulos/campos/máximos/ámbito institucional y composición integral de S18 no se cierran con este control.Flutter date-picker conserva límites existentes;sin nueva decisión clínica.No prueba móvil física ni correo institucional.

[Rollback incremental](patches/phase5b-student-create.patch):tres fuentes funcionales previas;git apply --reverse --check --unidiff-zero comprobado,sin aplicar.Baseline1432 y copias/logs:/tmp/immuno-miguel-tools/phase5b-student-create.No migraciones nuevas,no borrado de datos,no commit. Las tres bases nuevas son sintéticas vacías para comprobar migraciones existentes,no actualización institucional.

B5-R02B01–R02B05 DONE en los controles descritos.R02/S18 integral permanecen PARTIAL;siguen S22 perfil base y S00/S01/cobertura restante.R03–R07 según lista finita.UI-16/UI-17 BLOCKED,H02/C02/A07 UNKNOWN,T-02/T-03/Fase3B PARTIAL y almacenamiento real pendiente.Sin producción lista,Azure,Maps,PDF/QR,stores o clínica nueva.


### Revisión final R02B

**Controles R02B01–R02B05 DONE;S18/R02/Fase5B PARTIAL.** Next499 PASS/49 archivos,13,76s;lint/typecheck/webpack PASS.Flutter18 nuevas,382 completo PASS/20s;analyze2,2s y formato PASS.Backend/PostgreSQL408 PASS/0 SKIP,51 warnings,466,45s;20 E2E,concurrencia y tres migraciones existentes,con build Next final.Los51 warnings existentes de noload/FCM no se silencian.Durante ese gate se conservó el SnackBar seguro de error en Flutter y se añadió su caso de archivo ilegible;Flutter completo/analyze se repitieron después,382 PASS.No cambios backend/Next funcionales después de generar el build;el refuerzo posterior de assertions Next de toast no cambia aplicación/runner y pasó suite499/typecheck/lint.

Frente a baseline1432:3 fuentes funcionales existentes modificadas (2 Next/1 Flutter),1 test existente ampliado,4 tests nuevos,5 documentos existentes actualizados y8 artefactos nuevos (4 PNG,3 JSON,parche incremental).El gate regeneró115 artefactos/índices anteriores;15 índices SHA se refrescaron conservando procedencia.Ningún archivo previo eliminado ni golden Flutter anterior cambiado.837 referencias SHA-256 verificadas,0 ausentes/desajustes.Escaneo acotado de patrones de secretos de alta confianza en9 fuentes/tests/parche:0 coincidencias;no auditoría universal.Sin datos ni credenciales institucionales,cookies o tokens en artefactos;correo/FCM deshabilitados.

Revisados git diff y comparación incremental;git diff --check y git apply --reverse --check --unidiff-zero docs/audits/patches/phase5b-student-create.patch PASS,sin aplicar rollback ni commit.No backend funcional,API,permisos,auth,dependencias/manifiestos/lockfiles,reglas clínicas ni ámbitos excluidos modificados.Migraciones nuevas:**ninguna**.Parche contiene solo3 fuentes funcionales para revertir este bloque;no mezclar con cambios anteriores.

Próximo:R02C perfil administrativo base,sin tocar firma;después cobertura S00/S01 y comparación integral R02.R03–R07 siguen pendientes según lista finita.H02/C02/A07 UNKNOWN,UI-16/UI-17 BLOCKED,T-02/T-03/Fase3B PARTIAL y almacenamiento real pendiente.No producción lista.


## Continuación — R02C perfil administrativo base, 2026-10-21

**B5-R02C01–R02C05 DONE en controles probados;S22/R02/Fase5B PARTIAL.** Alcance:perfil base de admin/app_admin,lectura,borrador,escritura y recuperación. Firma,certificados,clínica y autenticación siguen fuera del bloque.Flutter usa ProfileScreen/ProfileNotifier compartidos ya corregidos en P03;no se modifican sus fuentes,se añaden pruebas específicas de ambos roles.

### Causas raíz

| ID / prioridad | Archivo / función | Problema e impacto | Solución / pruebas |
|---|---|---|---|
| B5-R02C01 / P2 | Next admin/profile/page.tsx:AdminProfilePage,ProfileView | if(error) desmontaba ProfileView y perdía su estado local de edición/borrador;reintento reconstruía formulario con datos anteriores. | ProfileEditor keyed por user.id conserva únicamente estado base durante error;oculta datos/acciones y conserva el montaje/desmontaje anterior de ProfileView.Fallo GET401/403/503 con/sin edición,recuperación y duplicación de retry probados para ambos roles. |
| B5-R02C02 / P2 | Mismo archivo:mutación update.onSuccess | useSafeMutation ya refresca consultas,pero el callback invalidaba otra vez,anunciaba éxito y cerraba edición aunque fallase GET posterior. | Una recarga coordinada del helper existente;se distingue PUT confirmado/GET fallido de PUT fallido y GET fallido.Aviso ligado a dataUpdateCount evita reutilizar una confirmación antigua después de GET idéntico exitoso.Retry solo GET;no replay de PUT ni datos retenidos visibles ante error. |
| B5-R02C03 / P2 | Mismo archivo:editor/guardar/cancelar | Botón guardaba por onClick sin form nativo;el lock del helper no bloqueaba Cancelar sincrónicamente ni capturaba payload explícito antes de awaits. | Form nativo con nombre accesible;lock local,inputs/acciones congeladas,payload capturado y guard de cancelación en mismo frame.Normalización original preservada.Cancelar borrador fallido retira su aviso.Tests de un PUT,borrador,campos bloqueados y cargo vacío=null. |
| B5-R02C04 / P2 | Mismo archivo:callbacks de escritura | Guard del helper protege cambio de propietario,pero unmount con el mismo usuario aún podía notificar éxito/error;fallo de escritura carecía de mensaje persistente en formulario. | Guard mounted,protección de propietario existente intacta y mensajes estáticos seguros;fallos no muestran cuerpo/diagnóstico.Se prueban completion exitosa/fallida tras unmount,antiguo propietario y GET tardío preescritura.No nuevo protocolo auth. |
| B5-R02C05 / P2 | Next components/app-shell.tsx | Captura previa mostró aro decorativo encima de navegación Crear estudiante en /admin/profile. | Capa relative/z-0 únicamente en ruta exacta;se actualiza expectativa previa de esa ruta y se añaden dos negativas /admin/profile-old y /admin/profile/extra.Sin clipping ni cambio de guardas. |

### Fuentes y límites de firma

Solo2 fuentes funcionales existentes modificadas:frontend-next/src/app/admin/profile/page.tsx y frontend-next/src/components/app-shell.tsx. Nuevo controlador local separa estado de formulario del componente que ya contenía firma.La sección de firma sigue desmontándose ante error de lectura y montándose al recuperar,como antes:hooks de firma,consultas,upload,limpieza de object URL y JSX de esa sección comprobados idénticos byte a byte frente a baseline1444.No firma nueva,imagen,almacenamiento ni validación real de esa capacidad.[Índice](../ui/evidence/phase5b/admin-profile/evidence-index.json) registra hashes de ambos fragmentos sin datos de firma.

No cambios a frontend/lib,backend/app,alembic,API/types/datasources,BFF,permisos,FCM,refresh/logout o reglas clínicas.GET /users/me y PUT /users/me/profile mantienen contrato.Next actualiza solo first_name,last_name,job_title;conserva first/last vacíos omitidos y job_title.trim()||null.Flutter mantiene su payload compartido previo,con contactos y nombres/cargo según rol;no se homogeneiza a ciegas ni se agregan campos clínicos.

### Pruebas y comparación

- Nuevo Next phase5b-admin-profile.test.tsx:27 casos finales,ambos roles,error GET con/sin borrador,escritura confirmada/lectura fallida,fallo PUT/GET con reintento explícito,loading inicial frente a datos retenidos,coalescencia de retry,form/envío/cancelación sincrónica,payload y null,confirmación obsoleta,GET tardío,unmount y propietario cambiado.Test existente phase5b-communications-layers.test.tsx:expectativa de ruta actualizada y2 casos adicionales.
- Ejecución anterior a código:15 FAIL/9 PASS entre24 casos.Después23 PASS/1 FAIL:el test inicial esperaba que un botón desmontado estuviese disabled durante loading sin datos.Se corrigió la assertion a spinner/sin botón y se añadió caso separado de retry con datos retenidos,que sí mantiene botón disabled.No se eliminan comprobaciones de exclusión ni conteo de GET;25 PASS antes de ampliar cancelación/unmount.
- Nuevo Flutter phase5b_admin_profile_test.dart:20 casos con ProfileScreen/ProfileNotifier reales y Dio controlado:admin/app_admin,401/403/503 con/sin edición,PUT confirmado/GET503 por tema,archivo de payload/ámbito,bloqueo,doble envío,retry GET-only,borrador tras fallo y dispose.Datos sintéticos consistentes por rol;consulta opcional existente de firma simulada404,sin bytes ni escritura.Cuatro goldens nuevas,no regeneración de anteriores.Flutter completo402 PASS/27s;analyze2,0s PASS,formato PASS.
- Nuevos backend/tests/test_phase5b_admin_profile_browser.py y frontend-next/tests/e2e/phase5b-admin-profile-browser.mjs:login real admin y app_admin,PUTs reales con PostgreSQL aislado,lecturas503/403 y un fallo PUT503 explícitamente controlados,campos congelados,doble submit1 PUT,retry doble1 GET,borrador conservado,recuperación con GET real y envío explícito después de fallo.El wrapper consulta DB y comprueba cargo final de ambos perfiles y ámbito original de admin.
- Permiso real:administrador normal intenta modificar programa/campus por BFF y FastAPI devuelve403;formulario conserva ámbito bloqueado y nunca lo envía.E2E401 controlado dispara expiración existente y retira contenido protegido.No se presenta como revocación real del token ni prueba FCM/logout.Cambio de cuenta del harness por cookies aisladas,no cambio de producto.
- E2E específico previo a capa:1 PASS/6 warnings/15,28s.El integrado final incluye runner con assertion de capa y capturas posteriores,409 PASS/0 SKIP con21 E2E,sobre build final.

[Cuatro pares por rol/tema](../ui/evidence/phase5b/admin-profile/comparison-cases.json),[casos web](../ui/evidence/phase5b/admin-profile/next-measurements.json),[índice](../ui/evidence/phase5b/admin-profile/evidence-index.json).Escena PUT confirmado/GET503 a390x844:Flutter conserva texto genérico de carga y disposición centrada,Next mensaje503 y panel superior;se compara significado/recuperación,no igualdad de píxeles.Capturas iniciales web sustituidas solo dentro de este nuevo bloque tras corrección de capas.Se revisaron los cuatro pares finales:la navegación web queda sobre la decoración y ambos clientes distinguen guardado confirmado de lectura fallida;disposición/copy/contraste integral siguen con los límites descritos.No datos institucionales,imágenes de firma ni credenciales/tokens/cookies en artefactos.

### Gates

| Gate | Resultado actual |
|---|---|
| Next tests |528 PASS/50 archivos,13,34s finales;27 casos nuevos de perfil y2 casos adicionales de capas. |
| Next lint/typecheck |PASS finales,tras ampliación de tests. |
| Next build webpack |PASS sobre fuentes finales;no reconstrucción durante E2E. |
| Flutter |402 PASS/27s,20 nuevas;analyze2,0s y formato PASS.Sin cambios funcionales Dart. |
| Backend/PostgreSQL/migraciones/concurrencia/E2E |409 PASS/0 SKIP,51 warnings,471,62s;21 E2E y tres migraciones existentes,sobre build final. |
| Ruff/Node |PASS del wrapper/runner nuevos. |
| Diff/rollback |Revisión incremental,git diff --check y reversión inversa comprobada:PASS,sin aplicar. |

Next usa npm test con BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a;npm run lint;node node_modules/typescript/bin/tsc --noEmit;node node_modules/next/dist/bin/next build --webpack.Flutter:SDK3.41.6 y PUB_CACHE locales existentes,FLUTTER_SUPPRESS_ANALYTICS=true;flutter analyze --no-pub,flutter test --no-pub --reporter expanded y dart format --output=none --set-exit-if-changed.Update-goldens limitado al archivo nuevo;completo posterior sin regeneración.No dependencias/versiones/manifiestos/lockfiles modificados.

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_admin_profile_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_admin_profile_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_admin_profile_migration \
.venv/bin/python -m pytest -q -rs --tb=short --show-capture=no
```

### Riesgos y rollback

Lock local por instancia,sin idempotencia de red ni entre pestañas.Un fallo de transporte no permite asegurar que no hubo escritura;no se reintenta automáticamente.Retry tras error de lectura nunca envía PUT.Existe nueva región persistente de error de escritura y aviso distinto de guardado confirmado;no nuevas reglas de dominio.

S22 como pantalla integral sigue PARTIAL:composición/nombres extensos,truncamiento de InfoTile,contraste completo (incluido mensaje nativo oscuro existente),foco/lector/teclado físico,320/768/1440/200% y estados de firma no se cierran con cuatro pares390.Diferencia existente de validación de nombres:Flutter exige no vacíos en el formulario;Next conserva omisión de vacíos del actualización parcial admitida por PUT.No se modifica esa normalización ni se infiere nueva obligación del DTO en este bloque;revisión de formulario integral queda registrada como pendiente UI,no como decisión clínica.La firma está excluida del alcance,no validada por404 sintético.

[Rollback incremental](patches/phase5b-admin-profile.patch):2 fuentes Next frente a baseline1444;git apply --reverse --check --unidiff-zero,sin aplicar.Copias/logs en /tmp/immuno-miguel-tools/phase5b-admin-profile.Migraciones nuevas:**ninguna**;tres bases nuevas vacías solo para migraciones existentes,sin datos institucionales.No commit.

Controles B5-R02C01–R02C05 DONE en estados probados;S22/R02/Fase5B PARTIAL.Próximo S00/S01 y comparación restante R02;R03–R07 según lista finita.UI-16/UI-17 BLOCKED,H02/C02/A07 UNKNOWN,T-02/T-03/Fase3B PARTIAL y almacenamiento real pendiente.Sin producción lista.


### Revisión final R02C

**B5-R02C01–R02C05 DONE en controles de recuperación;S22/R02/Fase5B PARTIAL.** Backend/PostgreSQL409 PASS/0 SKIP,51 warnings,471,62s;21 E2E,concurrencia y tres migraciones existentes sobre build final.Next528 PASS/50 archivos,13,34s;27 nuevas pruebas de perfil y2 casos adicionales de capas (además de una expectativa anterior actualizada).Lint/typecheck/webpack PASS.Flutter402 PASS/27s,20 nuevas por rol;analyze2,0s/formato PASS,ninguna fuente funcional Dart modificada.Los warnings noload/FCM existentes no se silencian.Después del build se amplió únicamente una assertion parametrizada de fallo tras unmount;Next completo/lint/typecheck posteriores pasan,sin cambiar aplicación/runner ni reconstruir durante E2E.

Frente a baseline1444:2 fuentes funcionales Next existentes modificadas,1 test existente ampliado,4 tests nuevos,5 documentos existentes actualizados y12 artefactos nuevos (8 PNG,3 JSON,parche incremental).El gate regeneró116 artefactos/índices anteriores;16 índices se refrescaron conservando procedencia.847 referencias SHA-256 verificadas,0 ausentes/desajustes.No archivos previos eliminados ni golden Flutter anterior alterada.Los dos fragmentos de hook/JSX de firma y sus hashes se comprobaron nuevamente idénticos.No se valida firma ni almacenamiento real.

Escaneo acotado de patrones de secretos de alta confianza en8 fuentes/tests/parche:0 coincidencias,sin auditoría universal.Artefactos solo sintéticos,sin tokens/cookies/credenciales o PII institucional.Revisados git diff y diff incremental;git diff --check y git apply --reverse --check --unidiff-zero docs/audits/patches/phase5b-admin-profile.patch PASS,sin aplicar rollback ni commit.No backend funcional,Flutter funcional,API,permisos,auth,dependencias/manifiestos/lockfiles,reglas clínicas o ámbitos excluidos modificados.Migraciones nuevas:**ninguna**.

Siguiente:R02D inicio/login S00/S01 y comparación restante R02.La validación de nombres/composición/truncamiento/contraste/foco y otros viewports de S22 sigue documentada;estos controles no cierran toda la pantalla.R03–R07 continúan según lista finita.H02/C02/A07 UNKNOWN,UI-16/UI-17 BLOCKED,T-02/T-03/Fase3B PARTIAL y almacenamiento real pendiente.No producción lista.


## Continuación — R02D inicio/login S00–S01

**Causa raíz comprobada.** Flutter representa las validaciones locales mediante `TextFormField.validator`,pero sus tests existentes solo verificaban campos y loading. Next mostraba texto de error en `<p>` sin enlazarlo al input ni anunciarlo. Una prueba DOM nueva falló antes de la corrección por falta de `aria-describedby`.

**Cambio acotado.** En `frontend-next/src/app/(auth)/login/page.tsx`,los mensajes locales tienen identificadores estables,se referencian condicionalmente desde el campo mediante `aria-describedby` y usan `role=alert`;`aria-invalid` existente se mantiene. No se cambian copy,validadores,estilo,formulario de envío,store,API,autenticación ni navegación. No se modificó código Flutter.

**Pruebas/gates.** `phase5b-login-accessibility.test.tsx`:1 PASS después de haber fallado antes del cambio. Next:526 PASS/3 SKIP,50 archivos PASS/1 omitido;`npm run lint`,TypeScript `--noEmit` y `next build --webpack` PASS. Flutter analyze/test BLOCKED:la ruta de binario conocida `/tmp/immuno-miguel-tools/flutter/bin/flutter` no existe y `command -v flutter` no encontró instalación. No se instalaron toolchains. Backend/PostgreSQL/E2E no ejecutados:el cambio altera solo atributos de presentación y el test de componente ejercita el DOM;no hay modificación de endpoints o permisos.

**Estado.** S01:corrección semántica accesible DONE en el DOM probado;lector real,foco/autofoco y paridad visual completa UNKNOWN. S00:sin bug demostrable,pero respuesta lenta,error/timeout y transición pareada UNKNOWN. R02D y R02 permanecen PARTIAL mientras falten Flutter y cobertura comparada. Sin migraciones,no credenciales reales,no cambios funcionales fuera de Next login y su test. `git diff --check` y `git apply --reverse --check --unidiff-zero` del rollback incremental PASS;sin aplicar rollback ni hacer commit.


## Continuación — R03A listado administrativo de estudiantes S17

**Causa raíz comprobada.** El helper de presentación FastAPI `student_vaccination_status` devuelve `denied` cuando corresponde. Flutter retiene ese valor y tiene tratamiento separado. El DTO `AdminStudentListItem` de Next limitaba la respuesta a `approved | pending`,y el listado asignaba cualquier no-aprobado a Pendiente tanto en badges como en el agregado por semestre. La prueba de regresión entrega valores sintéticos de los tres estados y falla antes de la corrección porque no encuentra el conteo/etiqueta aprobados esperados.

**Solución acotada.** `AdminStudentListItem.vaccination_status` ahora usa el tipo existente `ReportVaccinationStatus` (`approved | pending | denied`). La tabla desktop,las tarjetas mobile y los contadores por semestre representan directamente los tres valores del backend. No se altera el endpoint,el filtro `approved|pending`,el cálculo de estado en FastAPI,la clínica,las reglas ni los permisos.

**Pruebas y gates.** Nueva `phase5b-admin-student-list-status.test.tsx`:1 PASS con una respuesta sintética que contiene un registro por estado,y comprueba las filas de tabla/tarjeta y los totales del semestre. Next:527 PASS/3 SKIP (51 archivos PASS,1 omitido);lint,typecheck y `next build --webpack` PASS. No se modificó Flutter;analyze/test siguen BLOCKED por falta del toolchain en esta sesión. Backend/PostgreSQL/E2E no ejecutados:ningún endpoint o permiso cambia y el componente prueba la respuesta DTO.

**Estado.** R03A DONE solo para conservar/representar `denied` en S17 Next;S17/R03 integral PARTIAL. La captura de la vista móvil/escritorio no equivale a prueba física del viewport y Flutter tests no se pudieron repetir. Migraciones ninguna. Rollback incremental de los dos archivos funcionales verificado con `git apply --reverse --check --unidiff-zero`;sin aplicarlo. Sin commit.


## Continuación — R03I revalidación de paginación S17

**Causa raíz del hallazgo documental.** La matriz S17 mantenía texto de una implementación anterior (descarga de todas las páginas y pager inoperante), aunque la ruta de listado actual consulta páginas. La descarga de todas las páginas que sigue existiendo en datasources/API se usa para exportar, y no para renderizar la lista.

**Verificación del comportamiento actual.** Flutter `AdminStudentListNotifier.load` solicita `page` y `pageSize:20`, conserva filtros para anterior/siguiente/refresco y renderiza el pager con `totalPages`. Next `AdminStudentsPage` consulta la página seleccionada con `page_size:20`; `Pagination` respeta `has_previous/has_next`, actualiza el query param y refresca con `refetch`. El listado backend aplica orden estable `User.created_at DESC, User.id DESC`. Next reserva `listAllStudents`/exportación masiva para el flujo de exportación. El E2E existente de Fase5A prueba varias páginas, filtros, ida/regreso desde detalle, reload y que cada solicitud de listado use tamaño20.

**Pruebas ejecutadas.** Flutter `admin_provider_test.dart`: **4 PASS**. Next `phase5a-list-sync.test.tsx` y `phase5b-admin-student-list-status.test.tsx`: **8 PASS**. El E2E de navegador/PostgreSQL no se repitió en este bloque; se cita como evidencia existente en la cronología de Fase5A y no como ejecución actual.

**Resultado.** No se requirió cambio funcional: se corrigió la matriz S17 para reflejar el código y la evidencia actual, y se distinguió listado paginado de exportación. R03I DONE como revalidación documental. S17/R03/Fase5B siguen PARTIAL por paridad visual integral, estados/viewports y accesibilidad nativa/física UNKNOWN. Sin migraciones ni commit.


## Continuación — R03B esquema estudiante S05: reintento de error inicial

**Causa raíz.** Cuando la primera lectura del esquema Flutter fallaba sin datos/cache,`SchemeDetailScreen` mostraba el mensaje de error como texto aislado. El provider ya exponía `loadScheme(forceRefresh: true)`,y Next sí ofrece botón de reintento. El gap estaba en la representación de la pantalla.

**Cambio propuesto en código.** Se añadió a la rama de error inicial un botón “Reintentar” que invoca una nueva lectura forzada por el mismo provider. Se preservan el mensaje,flujo offline,cache y API;ninguna regla clínica cambia. Nuevo widget test verifica el error,el botón y el argumento `forceRefresh`.

**Verificación bloqueada.** El test focalizado y `flutter analyze --no-pub` terminan con exit127: `/tmp/immuno-miguel-tools/flutter/bin/flutter: No such file or directory`;`command -v flutter` tampoco encontró ejecutable. No hay resultado de test,analyze,format o build Flutter. Backend y Next no se ejecutaron para este cambio exclusivamente nativo.

**Estado BLOCKED, no DONE.** Mantengo la implementación y el test pendientes de validación en un entorno con Flutter/Dart instalado. Migraciones ninguna;no se cambiaron API/dominio. Baseline/copia del archivo en `/tmp/immuno-miguel-tools/phase5b-r03-scheme-retry/before`;`git apply --reverse --check --unidiff-zero` del rollback incremental PASS,sin aplicarlo. Sin commit.


## Continuación — R03C revalidación documental S19

Se inspeccionó el detalle Flutter/Next y se corrigieron las filas S19 de `docs/ui/phase5-parity-matrix.md`,que conservaban observaciones históricas ya resueltas en Next. El código actual confirma tabs accesibles enlazadas,acciones de ciclo de vida confirmadas,comunicación contextual y manejo error/retry separado por consulta. La diferencia de ubicación queda explícita:Flutter ofrece activar/desactivar/eliminar en listado;Next en detalle.

**Pruebas existentes ejecutadas:**`phase5b-detail-scheme.test.tsx` y `phase5a-student-detail.test.tsx`:2 archivos,14 PASS. No hubo cambios de código S19. Se confirmó una limitación Flutter:el catch conjunto de `_load` únicamente apaga loading y la vista muestra contenido vacío sin retry/error específico. No se corrige en este bloque porque `flutter` no está disponible;S19 PARTIAL. R03B también sigue BLOCKED;sin migraciones,backend,reglas clínicas o commit.


## Continuación — R03D revalidación S21 catálogo

La inspección de Flutter `VaccineCatalogScreen` y Next `/admin/vaccines` no mostró un gap nuevo que justifique cambiar código de catálogo o introducir decisiones clínicas. Ambos representan vacunas anuales mediante `is_annual`,aplicabilidad y configuraciones de dosis. Se conserva el trabajo previo del diálogo y su evidencia acotada;no se considera validación integral de pantalla.

Ejecutado `phase5b-catalog-dialog.test.tsx`:13 PASS. Sin cambios de código. Flutter sigue no ejecutable en este entorno,por lo que viewport,teclado nativo y captura pareada quedan UNKNOWN. S21/R03 PARTIAL;R03B S05 continúa BLOCKED. Sin migraciones/backend/decisiones clínicas o commit.


## Continuación — R03B verificación Flutter S05, 2026-10-26

**Causa raíz y cambio.** La primera lectura fallida del esquema no tenía un control para reintentar, aunque `SchemeNotifier.loadScheme(forceRefresh: true)` ya soportaba una lectura sin depender de cache. `SchemeDetailScreen` ahora presenta “Reintentar” en el error inicial y llama a esa operación existente. El widget test verifica el estado de error, la disponibilidad del control y el argumento de refresh forzado. No cambian API, cache, reglas clínicas ni navegación.

**Entorno.** Flutter 3.41.6, Dart 3.11.4, SDK oficial extraído en `/tmp/immuno-miguel-tools/flutter`; MD5 del archivo descargado coincide con `09fab6931f4da97c7eb20724189918b6`. Dependencias de `frontend/pubspec.lock` instaladas al cache temporal con `flutter pub get --enforce-lockfile`; no se actualizaron versiones fijadas. Sin secretos. El SDK y el cache están fuera del repositorio.

**Pruebas ejecutadas desde `frontend/`.** `flutter test --no-pub test/features/student/presentation/screens/scheme_detail_screen_test.dart`: **1 PASS**. `flutter analyze --no-pub`: **PASS, no issues found**. `flutter test --no-pub --reporter expanded`: **403 PASS**. `dart format --output=none --set-exit-if-changed lib/features/student/presentation/screens/scheme_detail_screen.dart test/features/student/presentation/screens/scheme_detail_screen_test.dart`: **PASS, 0 cambios**. Un primer intento del test dentro del sandbox falló al abrir el socket local; los tests se repitieron con el permiso de ejecución necesario y pasaron. No se ejecutó build Android en este bloque.

**Estado y límites.** R03B DONE para la recuperación Flutter S05 comprobada. S05 y R03 permanecen PARTIAL como paridad integral; no se infiere equivalencia completa de responsive, tema, teclado o lector de pantalla. S19 mantiene su gap independiente: el fallo conjunto de carga Flutter de perfil/esquema/evidencia puede representarse sin mensaje ni retry. No migraciones. `git diff --check` PASS. Sin commit.

**Rollback.** El cambio funcional se limita al botón y llamada de refresh en la rama sin datos/error inicial; el test nuevo puede retirarse junto con ese control. El parche incremental preparado en `/tmp/immuno-miguel-tools/phase5b-r03-scheme-retry/rollback.patch` invierte solo este bloque y se verificó con `git apply --reverse --check --unidiff-zero`; no se aplicó.


## Continuación — R03E recuperación de lectura del detalle S19 Flutter, 2026-10-26

**Causa raíz.** `AdminStudentDetailScreen._load` ejecutaba con `Future.wait` las lecturas de perfil, esquema y evidencias. Su `catch` ignoraba cualquier excepción y solo cambiaba `_loading` a false. En la primera carga, las pestañas interpretaban la ausencia de datos como “Sin perfil”/“Sin evidencia subida”; tras una recarga podía dejar contenido y acciones viejas sin indicar que el GET falló. No había retry del conjunto.

**Solución.** Se añadió un estado de fallo de lectura y un error genérico con botón “Reintentar”. No se muestra texto de excepción/servidor. La acción vuelve a llamar `_load` y las tres lecturas existentes; mientras la lectura está fallida se ocultan acciones de certificado, edición de perfil y comunicación. Se conserva el comportamiento atómico actual de esas consultas. No se cambian APIs, permisos, clínica o datos.

**Pruebas.** Nuevo `frontend/test/features/admin/presentation/screens/admin_student_detail_screen_test.dart`: un caso comprueba fallo inicial, mensaje genérico sin detalle simulado, distinción de vacío y retry exitoso; otro comprueba una primera carga exitosa seguida de recarga fallida, que se retiren el nombre/datos/acciones y aparezca el error. Focalizado: **2 PASS**. `flutter analyze --no-pub`: **PASS**. Suite completa final `flutter test --no-pub --reporter expanded`: **405 PASS** (incluye S05 y ambos casos S19). `dart format --output=none --set-exit-if-changed` sobre pantalla/test: **PASS, 0 cambios**. Se corrigieron dos supuestos del test (nombre aparece en AppBar y perfil; provider auth requiere fake); los tests finales pasan. Next/backend no se ejecutaron porque no se alteraron.

**Riesgo/límite.** Una falla de cualquiera de las tres consultas bloquea el detalle completo, según el `Future.wait` preexistente; no se convirtió en tres estados independientes. No se verificó expiración real de sesión, lector de pantalla o hardware. Rollback: quitar `_loadFailed`, restaurar el `catch`/render previo y retirar el test nuevo; conservar el resto de cambios históricos del archivo. Sin migraciones ni commit. **S19: recuperación de error DONE en el recorrido probado; pantalla/R03/Fase5B PARTIAL.**


## Continuación — R02E estado de carga accesible S00 Next, 2026-10-26

**Causa raíz.** `HomePage` mostraba “Cargando…” en un párrafo visual sin rol de estado ni anuncio live. Durante la restauración de sesión, un lector de pantalla no recibía la señal semántica de que la aplicación estaba esperando hidratación.

**Solución.** El mensaje usa `role="status"` y `aria-live="polite"`. No se modificó `checkSession`, el estado de autenticación, el momento de hidratación ni la navegación.

**Pruebas.** Nueva `frontend-next/src/app/__tests__/home-loading-accessibility.test.tsx`: primero falló porque no existía el rol accesible; después pasa y verifica que se anuncia el estado mientras `isHydrated=false` y no se llama a `router.replace`. Next focal: **1 PASS**. Suite completa sin `BFF_TEST_DATABASE_URL`: **528 PASS, 3 SKIP**; las pruebas BFF/PostgreSQL no se ejecutaron. Un intento con la URL local falló por `ECONNREFUSED 127.0.0.1:55544`, por lo que no se presenta como integración PASS. `npm run lint`, `tsc --noEmit` y `next build --webpack`: **PASS**. El warning ya existente de Vite sobre `configLoader=native` sigue visible.

**Estado/límites.** R02E DONE para semántica del estado de carga. R02 y S00 permanecen PARTIAL/UNKNOWN por timeout, respuesta tardía y comparación integral; no se cambia autenticación de Fase2. No se ejecutó Flutter en este bloque, no migraciones. Rollback: retirar `role`/`aria-live` y el test nuevo. `git diff --check` PASS;sin commit.


## Continuación — R03G estado vacío del catálogo S21 Flutter, 2026-10-26

**Causa raíz.** Cuando `VaccineCatalogNotifier.load()` respondía correctamente con `vaccines=[]`, `ListView.separated` recibía `itemCount=0`. Flutter mostraba solo el FAB “Nueva vacuna” y un cuerpo vacío, mientras Next presentaba el estado explícito “Aún no hay vacunas en el catálogo.”. El fallo de red ya tenía un estado separado con retry; no se confundió con la lista vacía.

**Solución.** La lista Flutter ahora renderiza el mensaje vacío dentro de un elemento centrado y usa `AlwaysScrollableScrollPhysics`, de modo que `RefreshIndicator` sigue disponible sin filas. No cambia la API, permisos, catálogo, reglas ni operaciones; el FAB de creación permanece disponible.

**Pruebas.** Nuevo `frontend/test/features/admin/presentation/screens/vaccine_catalog_screen_test.dart`: falló antes al no encontrar el texto vacío; después comprueba el texto, conserva “Nueva vacuna” y arrastra para refrescar; la fuente remota se invoca dos veces. Test focal **1 PASS**. `flutter analyze --no-pub`: **PASS**. Suite final `flutter test --no-pub --reporter expanded`: **406 PASS**. `dart format --output=none --set-exit-if-changed` en pantalla/test: **PASS, 0 cambios**. No se modificó Next/backend; el test Next focal de catálogo registrado anteriormente fue 13 PASS, no re-ejecutado aquí.

**Estado/límites.** R03G DONE para el estado vacío probado; S21/R03/Fase5B siguen PARTIAL por paridad integral de estados, capturas pareadas y lector/dispositivo físico UNKNOWN. Sin migraciones. Rollback: retirar la fila vacía/physics añadidos en `VaccineCatalogScreen` y el test nuevo; conservar el resto del archivo preexistente. `git diff --check` PASS; sin commit.


## Continuación — R03H estado vacío del esquema S05 Flutter, 2026-10-26

**Causa raíz.** Ante una respuesta exitosa con `vaccines=[]`, Flutter mostraba el resumen del esquema y no explicaba por qué la lista estaba vacía. Next ya representaba el caso con “Sin vacunas asignadas” y una descripción. La actualización por arrastre tampoco estaba garantizada cuando la lista tenía menos contenido que la altura disponible.

**Solución.** Flutter ahora muestra “Sin vacunas asignadas” y “Tu esquema aún no tiene vacunas.” cuando el backend entrega una lista vacía, y aplica `AlwaysScrollableScrollPhysics` para conservar pull-to-refresh en ese estado. No calcula completitud/elegibilidad ni altera datos, estado clínico, contrato o navegación.

**Pruebas.** En `frontend/test/features/student/presentation/screens/scheme_detail_screen_test.dart`, el recorrido vacío verifica ambos textos y que el gesto dispare una segunda carga (`forceRefresh=true`). Test focal **2 PASS** (incluye la regresión existente del error/reintento). Suite completa `flutter test --no-pub --reporter expanded`: **407 PASS**. `flutter analyze --no-pub`: **PASS**. `dart format --output=none --set-exit-if-changed` sobre pantalla/test: **PASS, 0 cambios**. `git diff --check`: **PASS**.

**Estado/límites.** R03H DONE para estado vacío y actualización probados; S05/R03/Fase5B siguen PARTIAL por paridad integral de estados, responsive, tema y evidencia física UNKNOWN. Sin migraciones. Rollback: retirar únicamente la rama vacía y física de scroll añadidas en `SchemeDetailScreen`, y el test nuevo; mantener el retry/error previo. Sin commit.


## Continuación — S21 revalidación del catálogo, 2026-10-26

**Causa raíz.** El inventario de S21 mezclaba casos históricos del editor con validación integral de pantalla. Había evidencia previa de modal/confirmación Next y una prueba Flutter posterior añadió estado vacío, pero faltaba una nueva ejecución conjunta para registrar el alcance actual.

**Verificación.** El código Next usa QueryError para GET, modal de edición, errores seguros de mutación y confirmación antes de alternar activo. El copy de desactivación dice que se eliminará del esquema de estudiantes activos y el de edición menciona regeneración; este bloque no determina ni reinterpreta su relación con snapshots históricos. Flutter ya distingue error de vacío y presenta mensaje vacío con gesto de refresh; la suite Flutter de esta pantalla no cubre el error del editor. FastAPI mantiene decisiones de dominio y permisos.

**Pruebas ejecutadas.** Next `phase5b-catalog-dialog.test.tsx`: **13 PASS**. Flutter `vaccine_catalog_screen_test.dart`: **1 PASS**. El primer run Flutter en sandbox falló al abrir socket local; la repetición autorizada pasó. No se ejecutaron E2E, backend/PostgreSQL, analyze, full suite, build ni goldens.

**Estado/límites.** Actualizadas filas S21 en las matrices para reflejar copy verificable y límites. No se cambió catálogo, historia, reglas clínicas, permisos, API o migraciones. Efecto institucional de reversiones/versionado, error de edición Flutter, lector/hardware y paridad visual completa siguen UNKNOWN; S21/R03/Fase5B PARTIAL. Rollback: revertir solo documentación.


## Continuación — S10 revalidación de notificaciones, 2026-10-26

**Causa raíz.** La matriz consolidada ya describía los arreglos N04/N06/N09/N10, pero su evidencia provenía de ejecuciones previas y requería una lectura actual de las rutas de lectura/marcado y una nueva corrida focal.

**Verificación.** Flutter conserva datos solo en fallos transitorios y muestra aviso/retry; fallos de autorización/cancelación limpian estado retenido. Marcar leído es independiente de abrir; si la mutación falla, conserva no leído y no navega. Next mantiene el criterio: errores transitorios conservan advertencia/lista, terminales ocultan datos previos, y no navega hasta que marque leído. La API continúa filtrando por propietario; ningún texto clínico/payload/push se modificó.

**Pruebas ejecutadas.** Next `phase5b-notifications.test.tsx` + `phase5b-notification-refresh.test.tsx`: **47 PASS**. Flutter `phase5b_notification_errors_test.dart` + `phase5b_notifications_reference_test.dart`: **42 PASS**. Repetición Flutter fuera del sandbox por bloqueo del socket local. No se ejecutaron E2E/PostgreSQL, build, full suite, analyze, push real o pruebas con dispositivo/lector físico.

**Estado/límites.** Matrices actualizadas con evidencia focal vigente; sin código, API, permisos, payloads, clínica o migraciones. Validación de entrega FCM real, lectores/hardware, expiración real y paridad visual integral UNKNOWN. S10/R04/Fase5B PARTIAL. Rollback: revertir solo documentación.


## Continuación — S12 revalidación de comunicaciones estudiante, 2026-10-26

**Causa raíz.** S12 ya tenía recorridos previos de peers, recuperación y empty de destinatarios, pero la matriz agrupa casos student/admin/app_admin y seguía PARTIAL sin una corrida focal actual de lista/detalle, búsqueda y acciones.

**Verificación.** Flutter y Next consumen endpoints de FastAPI para hilos/destinatarios; la API decide permisos y destino. Las suites controlan recuperación de lista/detalle, búsqueda empty/error/retry, respuesta tardía, borrador y marcado de lectura; Next no navega si falla el marcado. Se mantiene diferencia intencional/documentada: Next permite destinatario vacío para resolver por ámbito; Flutter exige selección. No se altera contrato ni autorización.

**Pruebas ejecutadas.** Next `phase5a-communications.test.tsx` + `phase5b-communications-peer.test.tsx` + `phase5b-communications-recovery.test.tsx`: **54 PASS**. Flutter `phase5b_communications_peer_test.dart` + `phase5b_communications_states_test.dart`: **52 PASS**. Primer intento Flutter en sandbox falló al abrir socket; la repetición autorizada pasó. No se repitió E2E/PostgreSQL, full suite, build o analyze.

**Estado/límites.** Matriz S12 actualizada con evidence focal. Búsqueda y peers sintéticos no prueban inbox institucional real, lector/teclado físico, expiración real ni paridad visual completa; S12/R04/Fase5B PARTIAL. Sin código, backend, permisos, clínica, migraciones o commit. Rollback: revertir solo documentos.


## Continuación — S13 revalidación de comunicaciones admin/app_admin, 2026-10-26

**Causa raíz.** La evidencia de peers y recuperación existente combina student/admin/app_admin; se reejecutaron los tests compartidos para confirmar los flujos administrativos en el estado de código actual, sin inferir capacidad por rol.

**Verificación.** Fixtures recorren admin→student/admin/app_admin y recepción en admin/app_admin; la interfaz exige selección al administrar destinatarios, app_admin busca admins y FastAPI mantiene autoridad de scope. Se cubren lista/detalle, búsqueda, error/empty/retry, respuesta tardía, borrador y marcado de lectura. No se alteran el endpoint, permisos ni polling; la selección de destinatario y `returnTo` se conservan.

**Pruebas ejecutadas.** Next `phase5a-communications.test.tsx` + `phase5b-communications-peer.test.tsx` + `phase5b-communications-recovery.test.tsx`: **54 PASS**. Flutter `phase5b_communications_peer_test.dart` + `phase5b_communications_states_test.dart`: **52 PASS**. La repetición Flutter requirió permiso por socket local. No E2E/PostgreSQL, suite completa, build/analyze o validación de servicios institucionales.

**Estado/límites.** No se cambió código, contrato, rol, clínica o migración. Datos institucionales, lector/dispositivo, expiración real y equivalencia visual total siguen UNKNOWN; S13/R04/Fase5B PARTIAL. Rollback: revertir solo documentación.

## Revalidación S14/S15 — 2026-10-26

**Verificación.** Se repitieron las pruebas de detalle de comunicaciones: Next `phase5b-communications-recovery.test.tsx` + `phase5b-communications-peer.test.tsx`: **47 PASS**; Flutter `phase5b_communications_states_test.dart`: **32 PASS**. Para S15, Next `phase5b-admin-dashboard.test.tsx` + `phase5b-dashboard-context.test.tsx`: **31 PASS**; Flutter `phase5b_admin_dashboard_reference_test.dart` + `admin_dashboard_screen_test.dart`: **48 PASS**. El primer Flutter intento S15 no pudo abrir el socket localhost dentro del sandbox; la repetición autorizada pasó.

**Resultado/límites.** S14 confirma estados y recuperación documentados; S15 confirma filtros de semestre, estados de dashboard y conservación del contexto en los casos probados. Persisten UNKNOWN para lector/dispositivo, comparación integral por viewport/tema y equivalencia numérica institucional de estadísticas. No se cambió código, permiso, contrato, clínica ni migraciones. No se ejecutaron E2E/backend ni gates completos en este bloque; S14/S15 y R04/Fase5B permanecen PARTIAL. Rollback: revertir solo documentación.

## S16 — revalidación del dashboard app_admin, 2026-10-26

La ejecución compartida de S15 cubre también el dashboard global app_admin: Next `phase5b-admin-dashboard.test.tsx` + `phase5b-dashboard-context.test.tsx` (**31 PASS**) contiene escenarios parametrizados por `admin`/`app_admin` y verifica que `app_admin` permanezca sin filtro de semestre; Flutter `phase5b_admin_dashboard_reference_test.dart` + `admin_dashboard_screen_test.dart` (**48 PASS**) incluye estados globales de app_admin. Los controles comprobados conservan navegación del rol y presentación de carga/vacío/error/refresh; no cambian permisos ni consumen métricas clínicas adicionales. No se repitió prueba E2E/backend ni gates completos. Estadísticas institucionales, lector físico, reflow/zoom y contraste integral siguen UNKNOWN; S16/R04/Fase5B PARTIAL. Sin cambios funcionales o migraciones; rollback documental.

## S17 — revalidación focal del listado administrativo, 2026-10-26

Next `phase5a-list-sync.test.tsx` + `phase5b-admin-student-list-status.test.tsx`: **8 PASS**. Flutter `admin_provider_test.dart` + `paginated_response_contract_test.dart`: **6 PASS**. Se comprueban sincronización/refresco del listado, interpretación de estados y metadatos paginados; FastAPI conserva la autoridad de permisos. Las acciones de ciclo de vida aparecen en el listado Flutter y en el detalle Next: diferencia de ubicación, no evidencia de capacidad ausente. No se localizó/ejecutó un widget test Flutter de la pantalla de listado ni una E2E navegador de filtros-paginación en este subbloque; por eso navegación completa, lector/teclado, integración real de páginas y estados en viewport permanecen UNKNOWN. S17/R03/Fase5B PARTIAL. Sin cambios funcionales, contrato o migraciones; rollback documental.

## S18 — revalidación de alta/importación, 2026-10-26

Next `phase5b-admin-create.test.tsx` + `phase5b-student-create.test.tsx`: **22 PASS**. Flutter `phase5b_admin_create_test.dart` + `phase5b_student_create_test.dart`: **22 PASS**. Se cubren validación, busy/doble envío, importación/preview sintético, respuestas tardías y recuperación en los casos implementados. Sigue documentada la diferencia: Next presenta programa/campus como texto libre mientras Flutter usa AcademicOptions; los subconjuntos de filas/resultados de importación también difieren. Sin catálogo institucional autorizado no se declara equivalencia. No hubo API/E2E, correo real ni validación contra registros institucionales. S18/R03/Fase5B PARTIAL; sin código funcional ni migraciones. Rollback documental.

## S20 — revalidación de administración de usuarios, 2026-10-26

Next `phase5b-admin-create.test.tsx` + `phase5b-admin-recovery.test.tsx`: **38 PASS**. Flutter `phase5b_admin_native_test.dart`: **26 PASS**. Se cubren listado/carga, permisos visuales existentes, create/delete, confirmación, doble submit, estados HTTP y recuperación de lectura; tras una escritura confirmada con fallo de lectura, el retry vuelve a consultar sin repetir la mutación. FastAPI sigue siendo autoridad de autorización. Estas suites no verifican con PostgreSQL real la matriz de permisos ni confirman usuario institucional. S20/R03/Fase5B PARTIAL; sin cambios de código/contrato/migraciones. Rollback documental.

### Paridad funcional — envío de mensaje a administrador

**Causa raíz.** Flutter exponía el envío contextual desde la gestión app_admin, mientras Next solo tenía crear/eliminar. El endpoint y el cliente Next ya soportaban creación de hilo con `admin_id`; faltaba el control/formulario en la página.

**Solución.** Se añadió botón y modal etiquetado, validación equivalente (`subject.trim().length >= 3`, mensaje requerido), texto de error seguro, bloqueo de submit concurrente, `createThread({category: "admin", admin_id})` y navegación al hilo con retorno a la lista. No se añadió API ni permiso; FastAPI mantiene la comprobación del rol app_admin y el destinatario.

**Pruebas y gates.** Next creación/recuperación/mensaje: **42 PASS**; lint, typecheck y build webpack PASS. Nuevas pruebas: diálogo/validación sin escritura, payload/destinatario y retorno, doble submit y fallo seguro con borrador. `test_phase5a_communications.py`: **4 PASS** con SQLite de archivo, Python 3.12.15 temporal y dependencias instaladas desde los manifiestos. PostgreSQL real no se validó: el cluster temporal falló al arrancar por un bloque de memoria compartida preexistente; no se manipuló ese recurso. La prueba SQLite cubre el servicio HTTP y autorizaciones por rol, pero no sustituye al gate PostgreSQL.

**Estado/riesgo/rollback.** Capacidad de mensajería restaurada en Next para el flujo probado; RBAC de extremo a extremo queda pendiente de correr con PostgreSQL. Sin cambios en Flutter, backend, contrato, migraciones o clínica. Rollback: retirar el botón/modal/mutación en `frontend-next/src/app/admin/admins/page.tsx` y las pruebas nuevas/mocks asociados; conservar cambios preexistentes del archivo. S20/R03/Fase5B siguen PARTIAL por alcance integral y pruebas institucionales.

## S23 — revalidación del verificador público, 2026-10-26

La ruta `/verify/{publicId}` es exclusiva de Next; Flutter solo abre la URL externa desde el PDF, no ofrece pantalla equivalente. FastAPI continúa siendo autoridad de validez/revocación. Next BFF conserva acceso público únicamente al GET del verificador, sin sesión, con `cache: no-store` y sin Authorization; `route.test.ts`: **6 PASS**. No hay prueba focal de componente para loading/errores HTTP: la pantalla convierte fallo de red a INVALID y no diferencia explícitamente 429/503; response.ok no se inspecciona. Es un límite conocido UI-16, fuera del alcance de esta revalidación; no se cambió código ni PDF/QR. La comparación visual/a11y sigue UNKNOWN. S23/UI-16 BLOCKED; Fase5B PARTIAL.

## Revalidación S21/S22 — catálogo y perfil administrativo, 2026-10-26

Next `phase5b-catalog-dialog.test.tsx` + `phase5b-admin-profile.test.tsx`: **40 PASS** (13 catálogo, 27 perfil). Flutter `vaccine_catalog_screen_test.dart` + `phase5b_admin_profile_test.dart`: **21 PASS** (1 catálogo vacío, 20 perfil admin/app_admin). Se confirman estados de editor/catalog dialog y recuperación de lectura/escritura del perfil en los casos focales. El alcance de perfil sigue excluyendo carga/almacenamiento real de firma; el test de catálogo Flutter es solo empty state. No se infiere efecto histórico de desactivación y no se cambian reglas de catálogo. S21/S22/R03/R04/Fase5B PARTIAL; sin cambios funcionales, backend, contratos o migraciones.

## S24 — asignación responsable programa/campus, 2026-10-26

La auditoría de la matriz confirma que no existe pantalla ni consumidor Flutter/Next para administrar asignaciones de firmante; el backend expone endpoints. Por tanto no hay paridad de pantalla evaluable ni pruebas cliente que ejecutar en este bloque. No se crea UI ni se amplía navegación/permisos. La decisión de qué interfaz administrativa necesita la institución y su validación UX quedan UNKNOWN; el modelo/API existente no se presenta como funcionalidad UI. S24 sin pantalla en ambos, fuera de los cierres de paridad, sin cambios funcionales.

## S19 — subflujos de detalle/evidencias, revalidación 2026-10-26

Next `phase5a-student-detail.test.tsx` + `phase5b-detail-scheme.test.tsx` + `phase5a-evidence.test.tsx`: **18 PASS**; Flutter `admin_student_detail_screen_test.dart` + `phase5b_evidence_recovery_test.dart` + `phase5b_evidence_selection_test.dart`: **30 PASS**. Se comprueban tabs/datos/esquema, fallo inicial distinguido de vacío con retry, selección de archivos y recuperación tras POST confirmado/GET fallido sin repetir el POST. La prueba de detalle Flutter mantiene carga atómica de tres consultas. No se cubrió emisión/historial/revocación/certificado, firma responsable ni PDF; tampoco E2E con FastAPI/PostgreSQL en esta corrida. S19 queda PARTIAL por esos huecos, lectores/hardware y comparación responsive/tema integral. Sin cambios funcionales o migraciones; rollback documental.

## S18/S20 — discrepancia de opciones programa/campus, 2026-10-26

**Causa raíz.** El backend valida los valores contra `ACADEMIC_PROGRAMS` y `CAMPUSES` en `backend/app/common/academic.py`; Flutter refleja la lista en `AcademicOptions`, pero Next usa campos de texto libre en creación de estudiantes y administradores.

**Evidencia/impacto.** `CreateAdminRequest` acepta un valor listado y rechaza `Programa arbitrario` con Pydantic `ValidationError` (fixture sintético). Las pantallas Next permiten enviar texto que FastAPI rechaza como 422. Se añade fricción y se muestra vocabulario distinto según el cliente; la validación de negocio sigue protegida en backend. No hay prueba existente que vincule todas las opciones desplegadas a ambos formularios.

**Propuesta.** Publicar una respuesta aditiva y protegida por roles admin/app_admin con `programs` y `campuses`, y consumirla desde Next/Flutter en las pantallas de alta. No modificar ni ampliar las listas. Pruebas necesarias: permisos del endpoint, valores exactos de listas, compatibilidad OpenAPI, carga/error/retry del selector en ambos clientes, selección y POST válido, prevención de texto no permitido y drift.

**Estado.** Hallazgo demostrado; implementación no realizada en este bloque porque requiere ampliar/documentar el contrato FastAPI y modificar ambos clientes. La fuente de valores es conocida; la forma de exponerla como contrato compartido queda pendiente. S18/S20 mantienen PARTIAL. Sin cambio funcional, migración o commit.

## S18/S20 — opciones académicas desde FastAPI, 2026-10-26

**Causa raíz.** FastAPI valida programa y campus contra listas centralizadas, Flutter tenía una copia estática y los formularios Next aceptaban texto arbitrario. Eso permitía que los clientes ofrecieran opciones distintas o que Next enviara valores que el backend rechaza.

**Cambio.** Se añadió `GET /admin/academic-options`, con el vocabulario actual de FastAPI y permisos existentes `admin`/`app_admin`. Next reemplazó los campos libres de alta de estudiantes y administradores por selects y estados de carga/error/reintento. Flutter migró alta de estudiantes, alta/lista administrativa y edición del ámbito en perfil administrativo al mismo contrato. Las opciones son vocabulario global no personal; la autorización del endpoint sigue en FastAPI. No se añadieron opciones ni se alteró la validación de dominio. Sin migración.

**Pruebas y resultado.** Backend `test_phase5b_academic_options.py`: **4 PASS** con SQLite sintético (roles autorizados, student 403, no autenticado 401 y valores exactos). Next suite focal: **57 PASS**; lint, typecheck y `next build --webpack`: **PASS**. Flutter suite focal: **52 PASS**; `flutter analyze --no-pub`: **PASS**. No se ejecutó PostgreSQL real para este bloque; la autorización/catálogo no se reporta como verificada en PostgreSQL.

**Riesgos/límites/rollback.** Si falla la consulta, los formularios muestran error/reintento y no permiten elegir valores libres; los campos opcionales de estudiante pueden permanecer vacíos. El endpoint no contiene datos personales. Rollback reversible: retirar endpoint/DTO/pruebas y restaurar los controles anteriores de ambos clientes; no requiere rollback de datos. S18/S20 y Fase5B permanecen PARTIAL por cobertura integral restante.

## Continuación — R03J refresco accesible de lista Flutter S17, 2026-10-26

**Causa raíz.** Next tenía acción visible para volver a consultar la lista. Flutter conservaba `refresh()` con página/filtros y lo usaba al volver del detalle o ante error, pero no lo exponía durante la vista exitosa.

**Archivos.** `frontend/lib/features/admin/presentation/screens/admin_student_list_screen.dart`; nuevo `frontend/test/features/admin/presentation/screens/admin_student_list_pagination_test.dart`; matrices `docs/ui/phase5-parity-matrix.md`, `docs/ui/phase5b-parity-matrix.md` y `docs/audits/phase5b-remaining-work.md`.

**Solución.** Se agregó acción en AppBar con tooltip accesible “Actualizar lista”, deshabilitada mientras carga, conectada al método existente del provider. Se nombraron semánticamente los controles anterior/siguiente. No cambia filtros, endpoint, permisos ni contrato; tampoco recalcula estado clínico.

**Pruebas ejecutadas.** El test de widget `admin_student_list_pagination_test.dart` y `admin_provider_test.dart`: **5 PASS** combinados. `flutter analyze --no-pub`: **PASS**. `dart format` aplicado al archivo de test. `git diff --check`: **PASS**. Next y backend no se modificaron en este bloque.

**Riesgos, rollback y estado.** Widget test con datasource mock; sin E2E de API ni validación de lector/dispositivo físico. Rollback: retirar la acción AppBar y el test nuevo. R03J DONE solo para el refresco probado; S17/R03/Fase5B continúan PARTIAL por cobertura integral pendiente. Sin migraciones ni commit.

## Continuación — R03K errores y editor Flutter S21, 2026-10-26

**Causa raíz.** `VaccineCatalogNotifier` solo capturaba `DioException`, por lo que un error de parseo/runtime dejaba la lectura sin finalizar y el indicador podía quedarse activo. Las fallas de mutación también se escribían en el campo de error de lectura, reemplazando la lista; tras una escritura aceptada y recarga fallida no se indicaba que el cambio ya se había confirmado. El editor carecía de límites de viewport y sus dropdowns de dosis desbordaban en ancho móvil.

**Archivos.** `frontend/lib/features/admin/presentation/providers/admin_provider.dart`; `frontend/lib/features/admin/presentation/screens/vaccine_catalog_screen.dart`; `frontend/test/features/admin/presentation/screens/vaccine_catalog_screen_test.dart`; `docs/ui/phase5-parity-matrix.md`, `docs/ui/phase5b-parity-matrix.md`, `docs/audits/phase5b-remaining-work.md`.

**Solución.** Se añadieron mensajes seguros ante excepciones genéricas, estado separado para lectura/escritura y confirmación de cambio si falla la lectura posterior. Las escrituras fallidas ya no transforman el error del listado; el borrador y la lista permanecen. La recarga GET tiene retry. El editor usa hasta 600px de ancho o el ancho disponible, 90% de altura del viewport; dropdowns de tipo/aplicabilidad están expandidos para caber en columnas estrechas. No se alteraron reglas ni contratos clínicos.

**Pruebas ejecutadas.** `flutter test --no-pub --reporter expanded test/features/admin/presentation/screens/vaccine_catalog_screen_test.dart`: **4 PASS** (vacío/refresh y tres escenarios de error/edición); los casos del editor usan viewport 390×844. `flutter analyze --no-pub`: **PASS**. `dart format` sin cambios pendientes; `git diff --check`: **PASS**.

**Riesgos/rollback/estado.** Pruebas con datasource mock; no backend/PostgreSQL, Next, integración ni hardware/lector. Rollback: revertir los campos y manejo de error del provider, los estados de UI y límites responsive del editor, junto con los tests añadidos. R03K DONE para el alcance probado. S21/R03/Fase5B siguen PARTIAL por responsive en otros viewports, accesibilidad física, paridad integral y efecto institucional del catálogo sobre snapshots UNKNOWN; sin migraciones ni commit.
## Continuación — R02F límite de espera en restauración de sesión Next, 2026-11-02

**Hallazgo y causa raíz.** En S00, Flutter aplica límites de 4 s a la consulta del perfil y 5 s al splash. Next usaba `getMe()` durante `checkSession()` con el timeout general de Axios (30 s), por lo que una consulta lenta retrasaba la salida de la pantalla de carga frente a Flutter.

**Cambio.** `getMe(timeoutMs)` permite un límite específico y solo la restauración inicial pasa 5 s. El login conserva el timeout general. El manejo de error/estado, el BFF, la cookie, FastAPI y el protocolo de autenticación no cambian.

**Pruebas.** `phase1-auth.test.ts` + `home-loading-accessibility.test.tsx` + `users-timeout.test.ts`: 10 PASS. Comprueban el límite de cinco segundos en restauración, el estado anónimo/hidratado ante fallo y la configuración `{ timeout: 5000 }` que llega a Axios. También verifican que `getMe()` mantiene 30 s para llamadas existentes. No depende de tiempo real ni credenciales.

**Riesgo/rollback.** La restauración podría llevar a login ante una latencia mayor a 5 s aunque el servicio luego responda; coincide con el límite vigente del cliente Flutter. Rollback: quitar el argumento específico en `checkSession` y conservar `getMe` con timeout general. No hay migraciones. R02F DONE solo para este límite; R02/S00/Fase5B PARTIAL por cobertura integral pendiente. Sin commit.

## Revisión — R02G respuesta tardía al cerrar sesión durante restauración, 2026-11-02

**Causa raíz analizada.** `checkSession` de Flutter captura la época antes del primer `await` y la compara después de validar sesión, después de leer identidad y antes de cambiar estado; `logout` incrementa la época al comenzar. Next usa una generación equivalente y su prueba existente resuelve `/users/me` después de `logout`, esperando que la sesión siga anónima. No se encontró un fallo funcional que requiera modificar autenticación.

**Prueba añadida / resultado.** Se añadió a `auth_provider_test.dart` una regresión Flutter que demora la respuesta de identidad hasta después del logout y verifica que no restaure usuario ni guarde rol. Con Flutter3.41.6/Dart3.11.4 y `pub get --enforce-lockfile`: `auth_provider_test.dart` **9 PASS**, `flutter analyze --no-pub` PASS y `dart format --output=none --set-exit-if-changed` sin cambios. Next `phase1-auth.test.ts`: **7 PASS**, incluye la carrera equivalente ya existente. No se cambió `pubspec.lock` ni el código de autenticación.

**Riesgo/rollback/estado.** No cambia código funcional ni protocolo. Rollback: retirar únicamente el test nuevo y su import `dart:async`. No migraciones. R02G **DONE** para la respuesta tardía posterior a logout en los dos clientes; R02/Fase5B permanecen PARTIAL por cobertura integral, errores reales de transporte y accesibilidad física.

## Revisión — R02H timeout del Splash Flutter, 2026-11-02

**Causa raíz / alcance.** La matriz tenía sin evidencia ejecutada el límite de cinco segundos del Splash Flutter. El código ya aplica `checkSession().timeout(5s)` y dirige a login al vencerlo. No se necesitó cambiar comportamiento.

**Prueba.** `app_smoke_test.dart` ahora usa un notifier cuya restauración queda pendiente, avanza el reloj del widget cinco segundos y verifica que aparece el login. `app_smoke_test.dart`: **2 PASS** (incluye arranque anónimo). `dart format`: sin cambios; `flutter analyze --no-pub`: PASS después de añadir la prueba.

**Límites/estado.** Timeout simulado de la navegación; no es una caída de red ni prueba de dispositivo. R02H DONE para ese comportamiento local; la latencia/error real y la paridad integral de S00 siguen pendientes. Rollback: retirar el segundo widget test, callback configurable del fake y el import async si ya no se usa.

## Revisión — R02I error de perfil al restaurar sesión, 2026-11-02

**Causa raíz.** Había pruebas para éxito, timeout y respuesta tardía tras logout, pero no una comparación explícita de qué hacen ambos clientes con un error de `/users/me` mientras restauran una sesión. La inspección indica que los dos deben limpiar estado local; FastAPI sigue decidiendo si la sesión es válida.

**Pruebas añadidas.** Next `phase1-auth.test.ts` simula fallo en `getMeWithTimeout` y exige estado anónimo/hidratado, tokens ausentes y caché clínica vacía. Flutter `auth_provider_test.dart` simula `DioException.connectionError` y exige estado anónimo, limpieza de sesión y que no se guarde rol. Next **8 PASS**; Flutter **10 PASS**. `flutter analyze --no-pub`, Next lint y typecheck: **PASS**.

**Límites/estado/rollback.** Son fallos controlados, no caída de red real, E2E ni verificación visual del mensaje/ruta; no se cambió código funcional ni autenticación. R02I DONE para cleanup local bajo fallo simulado; R02/Fase5B siguen PARTIAL. Rollback: retirar los dos tests de error de restauración. Sin migraciones ni cambios de contrato.

## Continuación — R03L editor de catálogo en viewport estrecho S21, 2026-11-02

**Causa raíz.** La evidencia R03K probaba el editor a390×844. El test adicional a320×568 reprodujo overflow horizontal de36px en una fila `Row` que mantenía “Cancelar” y “Guardar” lado a lado: el contenido disponía de256px, pero las acciones requerían cerca de292px.

**Cambio.** La fila de acciones ahora usa `OverflowBar` alineado al final, con separación, para que los dos botones se apilen cuando no quepan. No se quitó ninguna acción ni se cambió validación, catálogo, API o regla clínica.

**Pruebas.** `vaccine_catalog_screen_test.dart`: **5 PASS**, incluyendo el nuevo caso320×568 que abre el editor, desplaza hasta Guardar y comprueba ausencia de excepción de layout; los cuatro casos previos continúan pasando. `flutter analyze --no-pub`: PASS; `dart format`: sin cambios.

**Límites/rollback/estado.** Test de widget con fixture sintético; no dispositivo, lector ni captura visual pareada. R03L DONE para el overflow reproducido. Rollback: volver a `Row` con sus acciones en línea y retirar el test320×568. S21/R03/Fase5B siguen PARTIAL por otros viewports, estados, accesibilidad física y semántica institucional de snapshots UNKNOWN. Sin migraciones ni commit.

## Continuación — R03M esquema estudiante en viewport estrecho S05, 2026-11-02

**Causa raíz.** Un test a320×568 reprodujo dos desbordamientos de presentación en la tarjeta de esquema: el subtítulo usaba `Row` para estado + cantidad (32px fuera del ancho) y el encabezado del comentario de revisión también forzaba icono + texto en una `Row` (211px fuera al expandir, con la acción de dosis presente).

**Cambio.** Ambas filas se cambiaron por `Wrap` con espaciado equivalente, permitiendo que el contador y encabezado del comentario pasen a la línea siguiente. No cambian etiquetas, datos, permisos, acciones, clínica ni contratos.

**Pruebas.** `scheme_detail_screen_test.dart` añade fixture sintético con dosis denegada/comentario y verifica tarjeta cerrada y detalle expandido a320×568 sin excepción. Suite conjunta de esquema y catálogo: **8 PASS**. `flutter analyze --no-pub`: PASS; `dart format`: sin cambios.

**Límites/rollback/estado.** Test widget, sin lector/dispositivo ni comparación visual Flutter/Next. R03M DONE para los dos overflows reproducidos. Rollback: restaurar `Row` en subtítulo/comentario y retirar el test responsive. S05/R03/Fase5B siguen PARTIAL por otros estados/viewports, accesibilidad física y paridad integral pendientes. Sin migración ni commit.

## Continuación — R03N listado administrativo S17 a 320×568

**Causa raíz.** Al expandir un grupo de estudiantes a320×568, el chip de estado de vacunación construía icono+“Pendiente” dentro de un `Row`: los hijos sumaban107,3px para98px disponibles y producían overflow de9,3px. Lista/filtros/paginación en estado contraído no desbordaban.

**Cambio.** El contenido interno del chip usa ahora `Wrap` para que el icono/etiqueta puedan reacomodarse conservando ambos, color, texto y acción. No se cambian filtros, paginación, estado de negocio ni permisos.

**Pruebas.** `admin_student_list_pagination_test.dart`: **2 PASS**, incluyendo filtro/refresh de página y nuevo escenario de viewport320×568 con grupo expandido, email/programa/campus sintéticos y ausencia de excepción. `flutter analyze --no-pub`: PASS; `dart format`: sin cambios.

**Límites/rollback/estado.** Test de widget con datasource mock; no E2E API, lector o dispositivo físico. R03N DONE para este overflow. Rollback: restaurar `Row` dentro del chip y retirar el test estrecho. S17/R03/Fase5B siguen PARTIAL por paridad integral, otros viewports y accesibilidad física UNKNOWN. Sin migración ni commit.

## Continuación — R03O detalle administrativo S19 a 320×568

**Causa raíz / alcance.** El detalle tenía pruebas de recuperación de lectura, pero no un test de reflow que cubriera perfil, las tres tabs y un detalle de dosis/comentario expandido en ancho320. Se probó ese escenario con estado sintético sin inferir comportamiento clínico.

**Resultado.** No se reprodujo overflow. `admin_student_detail_screen_test.dart` comprueba perfil, esquema expandido con comentario revisado y evidencia vacía/paginación a320×568; suite **4 PASS** tras añadir además el lote de evidencia expandido, acciones de revisión y nombre largo de archivo. `flutter analyze --no-pub`: PASS; `dart format`: sin cambios. No se cambió código de producto.

**Límites/estado/rollback.** Test widget con datasource mock; no cubre todas las longitudes, temas, tabs, dispositivos, lector ni paridad Next. R03O DONE únicamente como verificación del caso descrito; S19/R03/Fase5B siguen PARTIAL. Rollback: retirar el test320×568. Sin migraciones ni commit.

## Continuación — R03P evidencia administrativa S19 a 320×568

**Causa raíz / alcance.** La verificación R03O cubría el estado vacío de Evidencia, pero no la presentación de un lote poblado con nombre largo ni los controles de revisión en viewport estrecho. Por eso no había evidencia de que esa rama de la pantalla cupiera a320×568.

**Cambio.** Se añadió un caso widget sintético que carga un lote, expande una evidencia con nombre largo y comprueba estado “En revisión”, acciones “Aprobar” y “Denegar” y ausencia de excepción de layout. No se cambió código de producto, permisos ni transiciones.

**Pruebas.** `admin_student_detail_screen_test.dart`: **4 PASS** (suite completa, incluidos los dos casos previos de recuperación, el recorrido vacío/esquema responsive y el lote poblado). `flutter analyze --no-pub`: PASS; `dart format --output=none --set-exit-if-changed`: PASS; `git diff --check`: PASS.

**Límites/estado/rollback.** Fixture y viewport simulados; no valida dispositivo físico, accesibilidad, todos los temas/dimensiones ni paridad integral Next. R03P DONE únicamente para el escenario probado; S19/R03/Fase5B permanecen PARTIAL. Rollback: retirar el caso widget añadido. Sin migraciones ni commit.

## Continuación — R03Q interacción del editor de catálogo S21 a 320×568

**Causa raíz / alcance.** La comprobación estrecha de R03L abría el editor y hacía visible Guardar, pero no interactuaba con los selectores de tipo y aplicabilidad de dosis que comparten una fila. No había evidencia de que ambos controles fueran operables en ese ancho.

**Cambio.** Se amplió el test widget existente para abrir/cambiar ambos selectores en el editor de 320×568 y comprobar que no haya excepciones de layout. No se modificó código de producto, datos, permisos ni reglas de catálogo.

**Pruebas.** `vaccine_catalog_screen_test.dart`: **5 PASS**; el escenario responsive incluye ahora selección de “Refuerzo” y “Mujeres”. `flutter analyze --no-pub`: PASS; `dart format --output=none --set-exit-if-changed`: PASS.

**Límites/estado/rollback.** La interacción usa datasource mock y no valida dispositivo físico, todos los valores/temas ni paridad visual integral. El test no reprodujo defecto, por lo que no se justifica cambio de producto. R03Q DONE solo como cobertura de interacción probada; S21/R03/Fase5B siguen PARTIAL. Rollback: retirar las aserciones/interacciones añadidas. Sin migraciones ni commit.

## Continuación — R03R evidencia Next S19 con nombre largo a 320×568

**Causa raíz.** La tab Evidencia no tenía medición responsive con un archivo poblado. Chrome/PostgreSQL sintético reprodujo que un nombre permitido de 233 caracteres en `AdminEvidenceFileItem` se renderizaba en una sola línea: a320px el documento crecía a1788px y el botón del archivo medía1763px. La caja del panel, en cambio, estaba dentro de 12–308px.

**Cambio.** El botón de archivo ahora usa ancho máximo disponible, espacio normal y quiebre de palabras largas (`max-w-full whitespace-normal break-all`). El test E2E siembra archivos con nombre sintético largo en los lotes de evidencia para que la segunda página esté poblada y mide el panel/nombre en320×568. No cambia API, descarga, permisos ni clínica.

**Pruebas y resultado.** `phase5b-theme-browser.mjs` sobre build webpack, Chrome real y PostgreSQL local UTF‑8 sintético: **1 PASS** (1 parámetro hermano de `phase5a-browser.mjs` quedó deselected). Medición guardada en [detail-scheme/measurements.json](../ui/evidence/phase5b/detail-scheme/measurements.json): viewport320, documento scrollWidth320, panel12–308 y botón25–295 (270px). Next focal `phase5a-student-detail` + `phase5b-detail-scheme`: **14 PASS**; lint, typecheck y build webpack: **PASS**. `node --check` y `git diff --check`: PASS.

**Límites/rollback/estado.** E2E con fixture no institucional; el nombre largo demuestra el límite, no todas las combinaciones de navegador, escala de texto/zoom ni lectores/dispositivo. Warning no bloqueante de pytest-asyncio por loop scope sin configurar y de SQLAlchemy `noload` deprecado en la fixture. R03R DONE para esta regresión reproducida; S19/R03/Fase5B siguen PARTIAL. Rollback: quitar clases de wrapping del botón, restaurar fixture anterior y retirar mediciones/assertions añadidas. Sin migraciones ni commit.

## Continuación — R03S interacción de selectores del catálogo Next S21 a 320×568

**Causa raíz / alcance.** Flutter ya comprobaba que los selectores de tipo de dosis y aplicabilidad se pueden operar a320×568. El E2E Next del catálogo medía el diálogo en320/390/768/1440px y cubría foco/chips, pero no cambiaba esos selectores por teclado.

**Cambio.** Se amplió `phase5b-catalog-browser.mjs` para usar flecha abajo/arriba en tipo y aplicabilidad a320×568, comprobar valores seleccionados y restaurar los valores iniciales. No se envía el formulario ni se dispara una mutación de catálogo.

**Pruebas y resultado.** `test_phase5b_catalog_browser.py`: **1 PASS** con Chrome real, Next webpack y PostgreSQL sintético; el artefacto registra selectores operables y valores restaurados a320×568 en [catalog-dialog/measurements.json](../ui/evidence/phase5b/catalog-dialog/measurements.json). `node --check`: PASS; `git diff --check`: PASS. Warning no bloqueante de SQLAlchemy `noload` deprecado en fixture.

**Límites/rollback/estado.** E2E de teclado web, no dispositivo físico/teclado móvil ni validación visual comparada por captura; no modifica producto. R03S DONE para esta interacción; S21/R03/Fase5B siguen PARTIAL. Rollback: retirar la secuencia/assertions de teclado del runner y sus medidas. Sin migraciones ni commit.

## Continuación — R03T estado de revisión en listado administrativo Next S17

**Causa raíz.** FastAPI serializa el estado agregado pendiente como `in_review`, porque `VaccineStatus.PENDING` es un alias de ese valor. Next limitaba `ReportVaccinationStatus` a `pending` y `studentStatus()` no tenía rama para `in_review`; Chrome mostró `TypeError: Cannot read properties of undefined (reading 'variant')` y el boundary sustituyó el listado por una pantalla de error aunque el endpoint devolvía200 y45 items. Además, con el render ya corregido, el E2E midió el tercer badge hasta x=350,6 dentro de un grupo x=16–304 en320px, donde quedaba recortado.

**Cambio.** El tipo Next acepta aditivamente `in_review`; el listado representa `pending` e `in_review` como “Pendiente” y los cuenta bajo el mismo agregado de reporte, sin recalcular estado clínico. El grupo de badges permite wrap para que los tres contadores queden dentro del encabezado. El runner E2E comprueba status mapping y geometría a320×568 y conserva una medida sin PII.

**Pruebas/resultados.** Vitest `phase5b-admin-student-list-status` + `phase5a-student-detail`: **8 PASS**; `npm run lint`, `tsc --noEmit`, `next build --webpack`, `node --check` y `git diff --check`: PASS. E2E `test_phase5a_browser.py -k phase5a-browser`: **1 PASS**, 1 parámetro hermano deselected, Chrome real y PostgreSQL sintético. Medición en [student-list/measurements.json](../ui/evidence/phase5b/student-list/measurements.json): viewport320, document scrollWidth320, details16–304; los tres badges terminan entre x=263 y287.

**Límites/rollback/estado.** La representación conserva el copy legado “Pendiente” establecido para el reporte; no cambia filtros, estado FastAPI ni reglas. La prueba usa20 de45 estudiantes sintéticos; no verifica dispositivos físicos, zoom ni lectores. R03T DONE para el fallo reproducido y el encabezado a320×568; S17/R03/Fase5B siguen PARTIAL. Rollback: quitar el alias de tipo y casos de representación/cuenta, restaurar el grupo de badges no envolvente y retirar assertions/mediciones E2E. Sin migraciones ni commit.

## Continuación — S06 error de lectura del esquema auxiliar en Flutter

**Causa raíz.** En `EvidenceUploadScreen`, el selector usa `schemeProvider.vaccines`, pero no representaba `schemeProvider.error` ni `isLoading`. Un fallo de `GET /scheme/` dejaba solo la opción de carga general, con apariencia de que no había dosis; a diferencia de Next, no había mensaje ni recuperación independiente. El fallo de lectura no impedía cargar evidencia general, capacidad que se conserva.

**Cambio.** Flutter muestra progreso accesible mientras no haya dosis cacheadas; si la lectura falla, muestra el mensaje seguro del provider y ofrece “Reintentar lectura del esquema”. El botón invoca únicamente `loadScheme(forceRefresh: true)` y queda deshabilitado durante carga/subida. No cambia reglas clínicas, API, permisos, mutaciones de evidencia ni datos de esquema.

**Pruebas y resultados.** Se añadió un escenario a `phase5b_evidence_recovery_test.dart`: estado de error separado de vacío, retry recupera la dosis asociada, desaparece el error y no se repite lectura de evidencias ni se envía POST. También verifica que el error es `liveRegion` y que retry expone rol de botón y acción tap en `SemanticsData`. Suite focal: **16 PASS**. `flutter analyze --no-pub`: **PASS**. `dart format --output=none --set-exit-if-changed`: **PASS**. El runner necesitó permiso de socket local; el primer intento dentro del sandbox falló por `127.0.0.1` bloqueado y el mismo comando autorizado pasó. La primera versión de la aserción usó miembros obsoletos/no disponibles y falló compilación; se corrigió al API `flagsCollection`/`SemanticsData`, tras lo cual test/analyze/formato pasan. Se restauró SDK Flutter3.41.6/Dart3.11.4 desde tag oficial y caché según `pubspec.lock` con `pub get --enforce-lockfile`; no se actualizaron dependencias ni lockfile.

**Límites/estado/rollback.** La prueba controla el provider, no una caída de red real; no se repitió E2E FastAPI/PostgreSQL ni Next porque el cambio es exclusivamente Flutter y Next ya tenía error/retry auxiliar. Consulta auxiliar S06 resuelta en el recorrido probado; S06/R04/Fase5B siguen PARTIAL por paridad integral y accesibilidad/dispositivo físico UNKNOWN. Rollback: retirar los widgets de progreso/error/retry y la prueba nueva. Sin migraciones ni commit.

## Continuación — R04 ranking colapsado del dashboard app_admin, 2026-11-04

**Causa raíz.** `VaccineComplianceRanking` recibía `compact` solo desde el dashboard global `app_admin` y mostraba cuatro vacunas al inicio; para `admin` mostraba tres. Flutter muestra tres inicialmente en ambos roles y conserva expansión para el resto. La fixture y el contrato usan el mismo arreglo `vaccine_compliance`; la diferencia era el límite de presentación del cliente, no una regla ni cálculo de FastAPI.

**Cambio.** Se retiró la variante compacta de Next y ambos roles muestran tres elementos antes de expandir. “Ver más/Ver menos” continúa mostrando el conjunto completo. No se cambian datos, orden, estadísticas, roles, permisos o lógica clínica.

**Pruebas y resultados.** Se actualizó la prueba de expansión por rol para exigir tres filas iniciales y cinco tras expandir. `phase5b-admin-dashboard.test.tsx`: **19 PASS**. `npm run lint`: **PASS**. `next build --webpack`: **PASS**. `tsc --noEmit`: **PASS** ejecutado después del build. Un primer typecheck concurrente con `next build` falló porque este regeneraba `.next/types`; se repitió en secuencia y pasó, por lo que el resultado inicial no se atribuye al código. Vitest mostró el aviso existente de Vite `configLoader: native` no soportado; no afecta el test ni se modificó configuración.

**Límites/rollback/estado.** Cobertura de componente con fixture sintética; no representa estadísticas institucionales ni lector/dispositivo físico. R04 ranking colapsado DONE para ambos roles en el recorrido probado; R04/Fase5B siguen PARTIAL por cobertura integral y UNKNOWN pendientes. Rollback: restaurar `compact` y la expectativa diferenciada en el test. Sin migraciones ni commit.

### Continuación — orden de cumplimiento del ranking

**Causa raíz.** Flutter omitía registros cuyo `total` era cero y, ante porcentajes iguales, ordenaba por `total` descendente. Next conservaba los registros sin población y solo comparaba el porcentaje, por lo que el mismo DTO podía producir distinto contenido y orden.

**Cambio/pruebas.** Next aplica el filtro y desempate ya usados por Flutter al representar la lista de agregados de FastAPI. La prueba sintética demuestra porcentaje mayor primero, empate ordenado por total, exclusión de total cero y expansión de todos los registros con población. `phase5b-admin-dashboard.test.tsx`: **20 PASS**. Lint, `next build --webpack`, `tsc --noEmit` y `git diff --check`: **PASS**.

**Límites/rollback/estado.** No se calcula ni cambia ninguna señal clínica; solo se ordena/filtra la representación de estadísticas entregadas. La equivalencia con estadísticas institucionales y lectores/dispositivo físico permanece UNKNOWN. R04 ranking DONE para casos probados; R04/Fase5B PARTIAL. Rollback: restaurar el ranking Next anterior y retirar el test nuevo. Sin migraciones ni commit.

### Continuación — verificación semántica automatizada del retry S06, 2026-11-05

**Causa raíz.** La corrección S06 ya anunciaba el error como live region y ofrecía retry, pero su widget test comprobaba solo texto e interacción, no los flags/acciones del árbol semántico.

**Pruebas/resultados.** La prueba verifica `flagsCollection.isLiveRegion`, `flagsCollection.isButton` y `SemanticsData.hasAction(tap)`. `phase5b_evidence_recovery_test.dart`: **16 PASS**; `flutter analyze --no-pub`: **PASS**; formato sin cambios; `git diff --check`: **PASS**.

**Estado/límites.** Control automatizado DONE para este retry. No se ejecutó lector físico TalkBack/VoiceOver; R05 sigue UNKNOWN en validación física y Fase5B PARTIAL. Sin cambios de UI funcional adicionales, migraciones ni commit.

## Continuación — R02J transporte local durante restauración de sesión, 2026-11-05

**Causa raíz.** R02F–R02I verificaban timeout, errores y carreras mediante dependencias mockeadas; no había una prueba que ejercitara el cliente Axios real a través de un socket y respuesta HTTP.

**Cambio/prueba.** Se añadió `session-transport.integration.test.ts` en Next. Un servidor Node sintético de loopback devuelve 503 o reinicia el socket tras recibir `GET /api/users/me`; el store termina anónimo e hidratado, limpia la caché clínica y la petición no contiene `Authorization`. No se cambiaron auth, BFF, API ni backend.

**Resultados.** `session-transport.integration.test.ts`: **2 PASS** (HTTP 503 y reset TCP). `npm run lint`: **PASS**; `tsc --noEmit`: **PASS**; `git diff --check`: **PASS**. La ejecución necesita permiso de loopback; intento sandbox falló con `listen EPERM` y repetición autorizada pasó.

**Límites/estado/rollback.** Es transporte real local del cliente contra un servidor sintético; no prueba DNS, TLS, proxy, BFF/FastAPI desplegados ni credenciales institucionales. R02J DONE en ese límite; R02/S00 siguen PARTIAL y transporte del servicio desplegado permanece UNKNOWN. Rollback: retirar solo el test. Sin migraciones ni cambios funcionales/lockfiles/commit.

## Continuación — R02K timeout HTTP real de restauración S00, 2026-11-05

**Causa raíz.** R02J probó respuestas HTTP de error y reset TCP reales en loopback, pero no verificaba que el límite de 5 segundos de `checkSession()` se aplicara frente a una respuesta HTTP que se demora.

**Cambio/pruebas.** Se amplió el test de transporte local con un servidor Node que recibe `GET /api/users/me` y demora su respuesta 6 segundos. Axios interrumpe la espera al límite configurado de 5 segundos; el store queda anónimo e hidratado y la caché clínica se limpia. La petición no contiene `Authorization`. No se modificó código funcional, auth, BFF ni backend.

**Resultados.** `session-transport.integration.test.ts`: **3 PASS** (503, reset TCP y timeout HTTP real). `npm run lint`, `tsc --noEmit` y `git diff --check`: **PASS**. Requiere loopback; ejecutado con permiso de red local.

**Límites/estado/rollback.** R02K DONE para el timeout de transporte local. No valida servicio desplegado, TLS/proxy, respuesta tardía de servidor contra la pantalla pareada, accesibilidad física ni paridad visual integral; S00/R02/Fase5B siguen PARTIAL y esas validaciones UNKNOWN. Rollback: retirar solo el caso lento del test. Sin migraciones, cambios de dependencia ni commit.

## Continuación — destinos de navegación tras hidratar S00, 2026-11-05

**Causa raíz.** La prueba de `HomePage` cubría el estado accesible de carga, pero no protegía qué ruta se elige después de completar la hidratación para cada estado de sesión y rol.

**Cambio/pruebas.** Se agregaron regresiones de componente para sesión anónima, estudiante, `admin`, `app_admin` y cambio obligatorio de contraseña para ambos tipos de rol administrativo/estudiante. Verifican el destino existente y que no haya redirección mientras siga sin hidratar. No se modificó implementación, permisos ni rutas.

**Resultados.** `home-loading-accessibility.test.tsx`: **7 PASS**; `npm run lint` y `tsc --noEmit`: **PASS**; `git diff --check`: **PASS**.

**Límites/estado/rollback.** Los destinos pasan por store controlado y router mock; el caso no integra el HTTP local con navegador ni equivale a E2E desplegado. S00/R02/Fase5B siguen PARTIAL por paridad integral, servicio real y accesibilidad física UNKNOWN. Rollback: retirar los casos parametrizados. Sin cambios funcionales, migraciones ni commit.

## Continuación — anuncio accesible del error de login S01, 2026-11-05

**Causa raíz.** Next presentaba el error del servidor con `role="alert"`; Flutter presentaba el mismo error visible, pero el contenedor no estaba marcado como región viva. La diferencia podía dejar el mensaje sin anuncio inmediato en lector de pantalla.

**Cambio/pruebas.** Flutter envuelve el contenedor existente con `Semantics(liveRegion: true)`, sin cambiar copy ni layout. Se añadió una prueba del flag semántico. Next añadió una regresión de `role=alert` y conserva campos ingresados tras recibir el error; no se cambió producto web.

**Resultados.** Flutter `login_screen_test.dart`: **3 PASS**; `flutter analyze --no-pub`: **PASS**; formato Dart aplicado. Next `phase5b-login-accessibility.test.tsx`: **2 PASS**; `npm run lint` y `tsc --noEmit`: **PASS**; `git diff --check`: **PASS**.

**Límites/estado/rollback.** Paridad semántica automatizada DONE para el mensaje de error probado. No equivale a TalkBack/VoiceOver, foco, teclado físico ni verificación en dispositivo; S01/R02/Fase5B continúan PARTIAL por cobertura integral y validación física UNKNOWN. Rollback: quitar el wrapper Semantics y las pruebas de regresión. Sin API, autenticación, permisos, migraciones o commit.

## Continuación — envío del login con teclado Flutter S01, 2026-11-05

**Causa raíz.** Next envía el formulario de login al pulsar Enter. En Flutter ninguno de los `TextFormField` definía una acción de teclado ni `onFieldSubmitted`; al mandar Done desde contraseña la prueba confirmó `loginCalls=0`, aunque el botón enviaba correctamente.

**Cambio/pruebas.** Correo usa `TextInputAction.next` y avanza el foco; contraseña usa `TextInputAction.done` y llama al mismo `_handleLogin` que el botón, preservando validación y payload. La nueva regresión falló antes con cero llamadas y pasa tras el cambio.

**Resultados.** `login_flow_test.dart` + `login_screen_test.dart`: **5 PASS**; `flutter analyze --no-pub`: **PASS**; formato Dart aplicado. Next `phase5b-login-accessibility.test.tsx`: **2 PASS**; lint/typecheck: **PASS**; `git diff --check`: **PASS**.

**Límites/estado/rollback.** Diferencia de submit por teclado corregida para el caso probado; `next` valida el envío convencional por botón/submit del form, sin prueba de hardware. Teclado físico, lector y foco en dispositivos siguen UNKNOWN; S01/R02/Fase5B PARTIAL. Rollback: quitar acciones y callbacks de teclado y la prueba Done. Sin cambio de auth/backend/API/contratos, migraciones ni commit.

**Ajuste de verificación.** Al añadir la aserción del foco, el test falló cuando se combinó `TextInputAction.next` con un `onFieldSubmitted` que también llamaba `nextFocus()`: el comportamiento estándar ya avanzaba el foco, por lo que se saltaba contraseña. Se retiró el callback redundante y se conserva únicamente `TextInputAction.next`; la prueba comprueba que el foco cae en contraseña. Suites focales posteriores: **5 PASS**. No se añadió otra regla de interacción.

**Verificación Next Enter.** Se añadió al componente Next una prueba con JSDOM que completa ambos campos y usa `userEvent.keyboard("{Enter}")`; `login` se invoca exactamente una vez con email normalizado y contraseña preservada. Suite `phase5b-login-accessibility.test.tsx`: **3 PASS**; lint/typecheck PASS. Es comprobación DOM, no navegador desplegado/hardware; login real y teclado físico siguen UNKNOWN.

## Continuación — copy común para error 401 de login S01, 2026-11-05

**Causa raíz.** FastAPI rechaza credenciales con `401` y detalle fijo `Invalid email or password`. Flutter reemplazaba ese detalle por “Correo o contraseña incorrectos”; Next mostraba directamente el texto en inglés.

**Cambio/pruebas.** Next auth store traduce status401 a la frase ya usada por Flutter; no se altera el endpoint ni la respuesta. Prueba un error sintético de Axios con el detalle real del contrato y afirma que el mensaje mostrado es el español, sin filtrar el detalle original. No se usa ninguna cuenta.

**Resultados.** `phase1-auth.test.ts`: **9 PASS**; `npm run lint`, `tsc --noEmit` y `next build --webpack`: **PASS**.

**Límites/estado/rollback.** Solo se alinea 401 por credenciales. Otros estados, incluido 403 o errores de disponibilidad, no se reescriben aquí; no se afirma su paridad completa. E2E de login real y lectores/hardware UNKNOWN. Rollback: restaurar lectura previa del `detail` para status401 y retirar la prueba. Sin cambios de API, backend, permisos, migraciones ni commit.

**Verificación integrada de pantalla.** Se enlazó la prueba de store con LoginPage: respuesta401 simulada desde `auth.login`, Enter desde contraseña, alerta española, ausencia del texto inglés y borrador conservado. Un primer intento detectó contaminación entre tests porque un caso dejaba un spy `login` instalado en el store; el `beforeEach` ahora restaura la acción real. `phase5b-login-accessibility.test.tsx`: **4 PASS**; combinado con `phase1-auth.test.ts`: **13 PASS**; lint/typecheck PASS. Transporte/credenciales sintéticos.

## Continuación — enviar recuperación S02 con teclado Flutter, 2026-11-05

**Causa raíz.** Next submitía su formulario de recuperación con Enter; el `TextFormField` Flutter de correo no definía `TextInputAction`/`onFieldSubmitted`. El test focal constató que Done no llamaba al datasource (`api.calls=[]`).

**Cambio/pruebas.** El campo Flutter ahora usa `TextInputAction.done` y llama al `_handleSubmit` existente. Se mantienen validación, lowercase/trim, control de doble envío, payload y endpoint. La regresión verifica petición única, payload esperado y pantalla de éxito con datasource falso; no envía correo real. Next añadía comprobación equivalente de Enter en JSDOM.

**Resultados.** Flutter `phase5b_account_forms_test.dart`: **38 PASS**; `flutter analyze --no-pub`: **PASS**; formato sin cambios. Next `phase5b-account-forms.test.tsx`: **33 PASS**; lint/typecheck: **PASS**. `git diff --check`: **PASS**.

**Límites/estado/rollback.** Equivalencia del submit automatizada en widgets/JSDOM, sin teclado físico, SMTP ni entrega institucional; accesibilidad física y correo real UNKNOWN. S02/R02/Fase5B continúan PARTIAL. Rollback: retirar `textInputAction/onFieldSubmitted` y las pruebas de submit con Enter. Sin API, contrato, autenticación, dependencias, migraciones o commit.

## Continuación — enviar restablecimiento S03 con teclado Flutter, 2026-11-05

**Causa raíz.** Next procesa Enter mediante el submit de su `<form>`, pero la confirmación Flutter no tenía `TextInputAction` ni callback de envío; una prueba con token synthetic constató `api.calls=[]` al presionar Done.

**Cambio/pruebas.** El campo de nueva contraseña usa `TextInputAction.next` (avance estándar) y confirmación usa `TextInputAction.done` con el mismo `_resetPassword` del botón. La regresión verifica que POST sintético conserva `/auth/reset-password`, token de fixture y `new_password`, y muestra éxito tras completar el datasource falso. Next añade un test de Enter para mismo contrato cliente, sin modificar código productivo.

**Resultados.** Flutter `phase5b_account_forms_test.dart`: **39 PASS**; `flutter analyze --no-pub`: **PASS**; formato sin cambios. Next `phase5b-account-forms.test.tsx`: **34 PASS**; lint/typecheck: **PASS**. `git diff --check`: **PASS**.

**Límites/estado/rollback.** Solo se prueba el comportamiento de teclado en widget/JSDOM con token y credenciales sintéticos; no se cambió una cuenta ni se usó correo real. Deep link instalado, SMTP, teclado físico y lectores siguen UNKNOWN. S03/R02/Fase5B PARTIAL. Rollback: retirar acciones/callback del teclado y tests añadidos. Sin contrato/API, cambios clínicos, migración ni commit.

## Continuación — enviar cambio de contraseña S09 con teclado Flutter, 2026-11-05

**Causa raíz.** Next somete el cambio mediante `<form>`; los tres campos Flutter no tenían acciones de teclado ni callback de envío. El test con confirmación enfocada verificó que Done no producía petición (`api.calls=[]`).

**Cambio/pruebas.** Campos actual y nueva contraseña usan `TextInputAction.next`; confirmación usa `done` y llama al `_submit` existente, preservando validación, llamada de cambio, logout posterior y secuencia de éxito. Next añadió Enter en componente/JSDOM con API mock. No se cambió producto web.

**Resultados.** Flutter `phase5b_account_forms_test.dart`: **40 PASS**; `flutter analyze --no-pub`: **PASS**; formato Dart PASS. Next `phase5b-account-forms.test.tsx`: **35 PASS**; lint/typecheck PASS. `git diff --check`: PASS.

**Límites/estado/rollback.** Contrato de envío probado solo con fixtures, datasource/API mock y sesión sintética; no se cambió contraseña ni se revocó una sesión real. Sesión real, teclado físico, lector y paridad visual integral UNKNOWN. S09/R02/Fase5B PARTIAL. Rollback: retirar acciones/callback teclado y pruebas añadidas. Sin cambios de API/contrato/backend, dependencias, migraciones o commit.

## Continuación — anunciar errores de reset/cambio S03/S09, 2026-11-05

**Causa raíz.** Next envuelve errores de formulario en `Alert` (`role="alert"`), pero Flutter dibujaba errores de reset y cambio en contenedores/textos sin `Semantics(liveRegion: true)`. Un lector podía no anunciar un fallo nuevo mientras el foco seguía en el formulario.

**Cambio/pruebas.** Se agregaron regiones vivas a los mensajes existentes de reset y cambio, sin modificar copy, apariencia, retry o envío. Dos tests provocan HTTP503 sintético mediante datasource fake y revisan el flag liveRegion del árbol Semantics. La suite Next existente comprueba `role=alert` en errores.

**Resultados.** Flutter `phase5b_account_forms_test.dart`: **42 PASS**; `flutter analyze --no-pub`: **PASS**; formato Dart PASS. Next `phase5b-account-forms.test.tsx`: **35 PASS**. `git diff --check`: **PASS**.

**Límites/estado/rollback.** Es verificación de widget/JSDOM, no TalkBack/VoiceOver físico ni lector real. Errores semánticos automatizados DONE para S03/S09; accesibilidad física sigue UNKNOWN y S03/S09/R02/Fase5B PARTIAL. Rollback: quitar wrappers Semantics y pruebas nuevas. Sin cambios API, clínica, autenticación, dependencia, migración o commit.

## Continuación — conservar el éxito de cambio de contraseña S09 tras logout, 2026-11-05

**Causa raíz.** Tanto Flutter como Next mostraban el resultado dentro del formulario después de cerrar sesión. El logout limpia el estado autenticado y los guards redirigen a `/login`, por lo que el formulario puede desmontarse antes de que el usuario vea el éxito. En Next, además, el callback local que activaba esa pantalla dependía de que el componente siguiera montado.

**Cambio.** Flutter captura el `ScaffoldMessenger` global antes de la operación asíncrona y, tras completar logout, publica “Contraseña actualizada. Inicia sesión con tu nueva contraseña.” Next publica el mismo aviso mediante Sonner, cuyo `Toaster` vive en `AppProviders` fuera de las rutas protegidas. Se mantiene el orden cambio de contraseña → logout → confirmación y no se conserva sesión activa.

**Archivos de este bloque.** `frontend/lib/features/shared/presentation/screens/change_password_screen.dart`, `frontend/test/core/theme/phase5b_account_forms_test.dart`, `frontend-next/src/components/change-password-form.tsx`, `frontend-next/src/components/__tests__/phase5b-account-forms.test.tsx`, esta auditoría, `docs/audits/phase5b-remaining-work.md`, `docs/ui/phase5b-r02-coverage.md` y `docs/ui/phase5b-parity-matrix.md`. Migraciones y dependencias nuevas: ninguna.

**Pruebas y resultados.** Flutter añade recorridos con roles student y admin sintéticos: cambio mock → logout que limpia auth → redirect GoRouter a `/login` → aviso visible en el messenger persistente. `phase5b_account_forms_test.dart`: **44 PASS**; `flutter analyze --no-pub`: **PASS**. Next añade prueba con `AuthGate`: logout limpia auth, el guard redirige a `/login` y la notificación se publica al terminar el logout aunque el formulario ya se desmontó; `phase5b-account-forms.test.tsx`: **36 PASS**; lint, `tsc --noEmit` y `next build --webpack`: **PASS**. Una primera corrida Flutter falló porque la prueba no inyectaba `SharedPreferences` para la pantalla de login; al añadir preferencias sintéticas, la regresión y suite pasaron. No se usaron cuentas ni credenciales reales. `git diff --check`: **PASS**; revisión de whitespace en los documentos del bloque sin hallazgos.

**Riesgos, límites y rollback.** La confirmación usa superficies globales ya presentes; pruebas automatizadas no acreditan TalkBack/VoiceOver ni dispositivos físicos. La sesión real y el servicio remoto no fueron ejercitados. Rollback: retirar los avisos globales y las regresiones nuevas, conservando intacta la invalidación de sesión. S09 tiene confirmación después de redirect cubierta en ambas interfaces; lectores/dispositivos, sesión real y cobertura integral permanecen **UNKNOWN**. R02/Fase5B continúan **PARTIAL**. Sin cambios de API, backend, contrato, reglas clínicas, permisos o commit.

## Continuación — S22 reflow de valores largos en perfil administrativo, 2026-11-05

**Causa raíz.** El header del perfil Next marcaba nombre con `truncate`; correo aparecía como texto directo dentro de una fila flex sin un hijo contraíble; cargo, valores de `InfoTile` y `LockedTile` también usaban `truncate`. Flutter muestra estos datos en `Text` que puede envolver, por lo que Next ocultaba parte de información disponible a anchos estrechos y en campos de ámbito bloqueados durante edición.

**Archivos y solución.** `frontend-next/src/app/admin/profile/page.tsx`: se retiró `truncate` del nombre, cargo y tiles; se añadió `break-words`, `min-w-0` al área de texto/email y el icono de correo conserva su ancho/posición. Se mantuvieron textos, datos, acciones, permisos, llamadas y modo edición. `frontend-next/src/components/__tests__/phase5b-admin-profile.test.tsx`: verifica valores base y tiles bloqueados de edición con cadenas sintéticas extensas. `frontend/test/core/theme/phase5b_admin_profile_test.dart`: widget test con viewport320 y texto2× confirma los valores de referencia Flutter. `frontend-next/tests/e2e/phase5b-admin-profile-reflow-browser.mjs`: E2E standalone inicia el build productivo y usa CDP para interceptar `/api/*` con respuestas sintéticas; `docs/ui/evidence/phase5b/admin-profile-reflow/measurements.json` guarda mediciones agregadas, sin texto sensible. Las validaciones de escritorio corresponden al perfil base; tiles bloqueados se comprueban a nivel de componente.

**Pruebas y resultados.** Next `phase5b-admin-profile.test.tsx`: **28 PASS**. Flutter `phase5b_admin_profile_test.dart`: **21 PASS**; `flutter analyze --no-pub`: **PASS**. Next `npm run lint`: **PASS sin advertencias**; `tsc --noEmit`: **PASS**; `next build --webpack`: **PASS**. Chromium headless sobre el build de producción: **PASS** a320/768/1440 CSS px y720 CSS px como aproximación de reflow a200%; todos los nodos medidos envuelven, `scrollWidth <= clientWidth` y el documento no excede el viewport. Primeros intentos dieron un falso negativo por espacios finales en los valores de fixture y luego `EPERM` del sandbox al crear sockets; se normalizó el fixture y el runner se repitió con autorización para localhost/Chromium. No se imprimieron ni usaron secretos ni datos institucionales. `node --check` del runner y `git diff --check`: **PASS**.

**Migraciones/dependencias/alcance.** Migraciones y dependencias nuevas: **ninguna**. Sin Flutter funcional, backend, API/contratos, seguridad, autenticación, clínica, firma, PDF/QR, Maps, Azure, cambios cosméticos generales ni commit. El runner no accede a PostgreSQL ni a FastAPI; mockea únicamente respuestas de API y no verifica transporte real.

**Estado, riesgos y rollback.** Reflow base y CSS de `LockedTile` comprobados; zoom real del navegador no fue aplicado (720 CSS px solo aproxima el ancho efectivo al200%), ni lector de pantalla, teclado/dispositivo físico o comparación de píxeles Flutter/Next. Firma/blob, almacenamiento privado, estados de firma y contraste integral siguen UNKNOWN/excluidos. S22, R02 y Fase5B permanecen **PARTIAL**. Rollback: revertir únicamente clases de wrapping de `page.tsx` y retirar la prueba/runner/evidencia/documentación de este bloque; sin datos ni migración que revertir.

## Continuación — R02L transporte HTTP local de restauración Flutter S00, 2026-11-05

**Causa raíz.** R02J/K ya ejercitaban el cliente Axios Next contra HTTP local, pero Flutter cubría error/timeout de restauración con el datasource mockeado. La implementación Flutter ya tenía timeout de4s para `/users/me` y limpieza ante excepción; faltaba evidencia del comportamiento con Dio real y un socket/HTTP controlado, así que no se infería defecto funcional.

**Cambio y archivos.** Se agregó solo `frontend/test/core/session/phase5b_session_transport_test.dart`. Usa `AuthRemoteDataSource`, `ApiClient` y Dio reales, un `HttpServer` loopback sintético, `SharedPreferences` mock y `SessionManager` falso. Casos: HTTP503, cierre TCP del servidor y respuesta200 demorada4,3s frente al timeout4s. Comprueba GET a `/api/v1/users/me`, bearer de fixture exclusivamente sintético, estado sin autenticar, caché de esquema vacía y llamada a limpieza de sesión. No cambia AuthNotifier, interceptor, servidor, contratos ni protocolo.

**Pruebas/resultados.** Flutter `phase5b_session_transport_test.dart`: **3 PASS**; `flutter analyze --no-pub`: **PASS**. Next `session-transport.integration.test.ts`: **3 PASS** (503, reset TCP y timeout Axios de5s), repetido para comparar en el mismo bloque. La prueba Flutter no inicializa `TestWidgetsFlutterBinding`, porque ese binding sustituye `HttpClient` y rechaza red; el test sí observó las tres peticiones loopback. Se ejecutó con permiso local de socket. No se conectó a FastAPI/PostgreSQL ni se usaron cuentas/tokens reales.

**Límites, estado y rollback.** El `SessionManager` Flutter es fake: se verifica que el notifier solicita `clearSession` y limpia la caché, no el borrado del plugin de almacenamiento seguro en dispositivo. Es transporte local, no servicio desplegado; DNS/TLS/proxy/BFF/FastAPI, dispositivo móvil, comparación visual/temporal del Splash, lector y hardware permanecen UNKNOWN. R02L DONE para los tres fallos/transporte comprobados; S00/R02/Fase5B siguen **PARTIAL**. Rollback: eliminar únicamente `phase5b_session_transport_test.dart` y su actualización documental. Sin migraciones/dependencias ni cambios funcionales; sin commit.

## Continuación — R03U nombre largo de vacuna en esquema S05, 2026-11-05

**Causa raíz.** El trigger del acordeón de Next aplicaba la clase Tailwind `truncate` al nombre de vacuna; Flutter muestra el mismo dato en el `title` de `ExpansionTile`, que envuelve por defecto. Con un nombre sintético de242 caracteres, el test Next falló en rojo al encontrar `truncate`. Esto ocultaba parte del nombre disponible y era una diferencia concreta frente a Flutter.

**Archivos y solución.** `frontend-next/src/app/student/scheme/page.tsx`: se cambió solo `truncate` por `break-words` para el nombre del trigger; se conservaron estado, conteos, permisos, acciones, estilos de color y reglas clínicas. `frontend-next/src/components/__tests__/phase5b-detail-scheme.test.tsx`: regresión para el nombre completo y el acordeón cerrado, sin mutaciones clínicas. `frontend/test/features/student/presentation/screens/scheme_detail_screen_test.dart`: referencia Flutter a320×568 confirma que el nombre largo ocupa varias líneas sin excepción. `frontend-next/tests/e2e/phase5b-scheme-name-reflow-browser.mjs`: navegador Chromium con respuestas API sintéticas; `docs/ui/evidence/phase5b/scheme-name-reflow/measurements.json` conserva métricas de layout sin el nombre.

**Pruebas y resultados.** Next `phase5b-detail-scheme.test.tsx`: **8 PASS**; el caso nuevo falló primero contra `truncate` y pasó después del ajuste. Flutter `scheme_detail_screen_test.dart`: **4 PASS**; `flutter analyze --no-pub`: **PASS**. `npm run lint`, `tsc --noEmit`, `next build --webpack` y `node --check` del runner: **PASS**. E2E Chromium sobre build productivo: **PASS** a320,768,1440 y720 CSS px; título completo visible, `white-space: normal`, `overflow-wrap: break-word`, `scrollWidth <= clientWidth` y documento sin overflow horizontal. `dart format --output=none --set-exit-if-changed` y `git diff --check`: **PASS**.

**Límites y rollback.** 720 CSS px es ancho efectivo equivalente aproximado a reflow200%, no zoom real. No se probó lector/teclado físico, dispositivo, contraste integral ni el resto de estados del esquema; S05/R03/Fase5B siguen **PARTIAL**, y esas dimensiones permanecen UNKNOWN. Migraciones y dependencias nuevas: **ninguna**. Rollback: restaurar `truncate` y retirar las regresiones, runner, evidencia y anotaciones de este bloque. Sin backend, contrato, política clínica o commit.

## Continuación — R03V nombre y correo largos en listado administrativo S17, 2026-11-05

**Causa raíz.** `StudentMobileCard` en Next aplicaba `truncate` al nombre y correo dentro de un ancho flexible reducido por la tarjeta y el badge. Flutter conserva ambos datos en `Text`/`Wrap` y permite varias líneas; Next ocultaba el final de esos datos en móvil. La regresión Next falló primero al encontrar `truncate` en el nombre con un fixture sintético largo.

**Archivos y solución.** `frontend-next/src/app/admin/students/page.tsx` cambia únicamente las clases de nombre/correo a `break-words`; se conservan badge, filtros, navegación, datos, acciones, permisos, estilos base y tabla desktop. `frontend-next/src/components/__tests__/phase5b-admin-student-list-status.test.tsx` comprueba la tarjeta con nombre y correo sintéticos completos. `frontend/test/features/admin/presentation/screens/admin_student_list_pagination_test.dart` amplía el escenario estrecho 320×568 y verifica que nombre/correo ocupan varias líneas sin excepción. `frontend-next/tests/e2e/phase5b-admin-student-list-reflow-browser.mjs` usa Chromium contra el build productivo e intercepta API/CSRF con respuestas sintéticas. `docs/ui/evidence/phase5b/admin-student-list-reflow/measurements.json` guarda solo métricas agregadas.

**Pruebas y resultados.** Next `phase5b-admin-student-list-status.test.tsx`: **2 PASS**; la prueba nueva falló primero contra el truncamiento y pasó tras el cambio. Flutter `admin_student_list_pagination_test.dart`: **2 PASS**; `flutter analyze --no-pub`: **PASS** y `dart format` aplicado al test. Next `npm run lint`, `tsc --noEmit` y `next build --webpack`: **PASS**. E2E Chromium con datos sintéticos: **PASS** a320/640/720 CSS px; nombre completo visible y envuelto en los tres anchos, correo envuelto en320/640 y completo en una línea a720 cuando cabe; las cajas de texto y el documento no exceden sus anchos. El primer E2E falló porque el fixture omitía el token CSRF sintético requerido antes de POST; corregido el fixture. Un criterio inicial que exigía wrap de correo a720 falló correctamente al mostrar que cabía en una línea; se ajustó la aserción a comprobar visibilidad/no truncamiento allí. `node --check` y `git diff --check`: **PASS**.

**Límites, estado y rollback.** La comprobación de720 CSS px aproxima reflow a200%, no activa zoom nativo. No cubre lectores, dispositivos físicos, contraste integral, la tabla con todas las columnas ni otros estados/temas. R03V queda **DONE** para el recorte de nombre/correo móvil; S17/R03/Fase5B siguen **PARTIAL**. Migraciones/dependencias nuevas: ninguna. Rollback: restaurar `truncate` en las dos etiquetas y retirar pruebas, runner, mediciones y notas de este bloque. Sin cambios backend/API, clínicos, auth, Maps, Azure, PDF/QR o commit.

## Continuación — R03W nombre largo en esquema administrativo S19, 2026-11-05

**Causa raíz.** `AdminVaccineCard` en Next aplicaba `truncate` al nombre de vacuna en el encabezado del acordeón. Flutter representa el mismo campo con el `title` de `ExpansionTile`, que envuelve. La regresión Next falló primero con un nombre largo sintético al detectar `truncate`; el widget Flutter a320×568 confirmó un encabezado de varias líneas sin excepción.

**Archivos y solución.** `frontend-next/src/app/admin/students/[id]/page.tsx` cambia solamente `truncate` por `break-words` en el nombre de vacuna del trigger. Se preservan el acordeón, texto de estado, acciones de dosis, permisos, datos y reglas clínicas. `frontend-next/src/components/__tests__/phase5b-detail-scheme.test.tsx` añade el nombre largo para la rama administrativa del detalle; `frontend/test/features/admin/presentation/screens/admin_student_detail_screen_test.dart` mide que el título Flutter ocupe más de una línea a320×568. `frontend-next/tests/e2e/phase5b-admin-scheme-title-reflow-browser.mjs` ejecuta Chromium sobre el build y usa fixtures de perfil/esquema sintéticos. `docs/ui/evidence/phase5b/admin-scheme-title-reflow/measurements.json` guarda únicamente métricas de layout.

**Pruebas y resultados.** Next `phase5b-detail-scheme.test.tsx`: **9 PASS** (caso nuevo rojo antes del cambio); Flutter `admin_student_detail_screen_test.dart`: **4 PASS**; `flutter analyze --no-pub`: **PASS**. Next lint, `tsc --noEmit` y `next build --webpack`: **PASS**. Chromium E2E con rol admin y esquema sintéticos: **PASS** a320/640/720 CSS px; título completo, `white-space: normal`, `overflow-wrap: break-word`, caja sin overflow y documento dentro del viewport. `node --check` del runner y `git diff --check`: **PASS**.

**Límites, estado y rollback.** 720 CSS px aproxima reflow a200%, no es zoom nativo; no se validaron lector, dispositivo físico, temas/estados completos ni contraste integral. R03W **DONE** para el truncamiento del título administrativo; S19/R03/Fase5B continúan **PARTIAL**. Migraciones/dependencias nuevas: ninguna. Rollback: restaurar la clase `truncate` y retirar el test, runner, evidencia y anotaciones de este subbloque. Sin backend/API, migraciones, clínica, autenticación, Maps, Azure, PDF/QR o commit.

## Continuación — R03X nombres de archivos y selector de dosis en evidencias S06, 2026-11-05

**Causa raíz.** Next usaba `truncate` para el nombre del archivo recién seleccionado y para nombres de archivos históricos, ocultando texto que Flutter permite envolver. Al probar Flutter a320×568 se reprodujo además un `RenderFlex overflow` de62 px: el selector de asociación de dosis conservaba el ancho intrínseco del valor largo “Carga general, sin dosis asociada” en lugar de ajustarse al espacio de la fila. El historial también requería desplazamiento para montar su fila bajo scroll perezoso.

**Archivos y solución.** `frontend-next/src/app/student/evidence/page.tsx` deja envolver nombres seleccionados e históricos (`min-w-0`, `flex-1` y `break-words` donde corresponde). `frontend/lib/features/student/presentation/screens/evidence_upload_screen.dart` configura `isExpanded: true` en el selector existente para limitarlo al ancho disponible, sin alterar opciones, selección o contrato. `frontend-next/src/components/__tests__/phase5b-evidence-selection.test.tsx` añade regresiones para ambos nombres sintéticos; `frontend/test/core/theme/phase5b_evidence_selection_test.dart` prueba selección e historial a320×568, desplazándose al historial. `frontend-next/tests/e2e/phase5b-evidence-file-reflow-browser.mjs` mide ambos escenarios en Chromium sobre build productivo con API y PDF sintéticos; [mediciones agregadas](../ui/evidence/phase5b/evidence-file-reflow/measurements.json) no contienen nombres.

**Pruebas y resultados.** Next selección/recuperación: **17 PASS**; Flutter selección: **15 PASS** y `flutter analyze --no-pub`: **PASS**. Next lint, `tsc --noEmit` y `next build --webpack`: **PASS**. Chromium con fixtures sintéticos: **PASS** a320/640/720 CSS px, nombre de archivo completo/envolvente y sin overflow horizontal del documento. Node syntax check del runner: **PASS**. Una primera ejecución Flutter expuso el overflow real del selector; después de limitarlo al ancho disponible, las pruebas de viewport estrecho pasaron. No se usaron API real, archivos institucionales o credenciales.

**Límites, estado y rollback.** Zoom nativo, TalkBack/VoiceOver, teclado físico, dispositivo real, contraste y otros estados de S06 siguen UNKNOWN. La prueba no demuestra subida/descarga contra FastAPI ni el resto de paridad de la pantalla. R03X **DONE** para los nombres y el overflow reproducidos; S06/R04/Fase5B continúan **PARTIAL**. Migraciones y dependencias nuevas: ninguna. Rollback: restaurar las clases de truncamiento y retirar `isExpanded`, regresiones, runner, mediciones y anotaciones de este bloque. Sin backend, contrato, lógica clínica, autenticación, PDF/QR, Maps, Azure o commit.

## Continuación — R03Y título largo de vacuna en catálogo administrativo S21, 2026-11-05

**Causa raíz.** La fila del catálogo Next aplicaba la clase `truncate` al nombre de vacuna. Flutter usa `ListTile.title` sin límite de líneas y envuelve el texto. La regresión Next con nombre sintético falló antes del cambio: recibió `truncate` en lugar de la clase que permite envolver. No había evidencia de que el nombre largo fuese legible en un viewport móvil estrecho.

**Archivos y solución.** `frontend-next/src/app/admin/vaccines/page.tsx` cambia únicamente las clases del título a `min-w-0 break-words`; no altera el nombre recibido, acciones, permisos, API o reglas de catálogo. `frontend-next/src/components/__tests__/phase5b-catalog-dialog.test.tsx` agrega la regresión de nombre largo. `frontend/test/features/admin/presentation/screens/vaccine_catalog_screen_test.dart` verifica el título multilínea a320×568 con datasource y contenido sintéticos. `frontend-next/tests/e2e/phase5b-admin-catalog-name-reflow-browser.mjs` corre el build productivo y reemplaza las respuestas BFF por una identidad `app_admin` y catálogo sintéticos. [Mediciones agregadas](../ui/evidence/phase5b/admin-catalog-name-reflow/measurements.json) guardan dimensiones/estilos, no el nombre.

**Pruebas y resultados.** Next `phase5b-catalog-dialog.test.tsx`: **14 PASS**; la regresión se observó fallar antes con `truncate`. Flutter `vaccine_catalog_screen_test.dart`: **6 PASS**, incluyendo nombre largo en320×568; `flutter analyze --no-pub`: **PASS**. Next `npm run lint`, `tsc --noEmit`, `next build --webpack`, `node --check` del runner y E2E Chromium con fixtures sintéticos: **PASS**. El E2E confirmó wrap de texto y `documentWidth <= viewport` a320/640/720 CSS px. No se conectó FastAPI/PostgreSQL ni se usaron cuentas o datos institucionales. `git diff --check`: PASS.

**Límites, estado y rollback.** El viewport720 CSS px aproxima reflow a200%, no activa zoom nativo. TalkBack/VoiceOver, lector real, teclado/dispositivo físico, contraste y otros estados del catálogo siguen UNKNOWN. R03Y **DONE** solo para el recorte probado; S21/R03/Fase5B permanecen **PARTIAL**. Migraciones y dependencias nuevas: ninguna. Rollback: restaurar `truncate` y retirar los tests, runner, mediciones y notas añadidas. Sin backend, contratos, reglas clínicas, autenticación, Azure, Maps, PDF/QR o commit.

## Continuación — R03Z nombre largo en header fijo del detalle administrativo S19, 2026-11-05

**Causa raíz.** El `h1` del header fijo de Next tenía `truncate`, por lo que el nombre que Flutter conserva en el AppBar terminaba en ellipsis. El E2E mostró además que retirar el truncamiento sin reorganizar la fila deja al nombre solo116 px entre la navegación y tres acciones: el fixture sintético ocupó525 px de alto en320 px de viewport. La regresión Next con perfil sintético falló primero por recibir `truncate`; la consulta inicial de rol coincidió con dos títulos idénticos (header fijo y panel Perfil), así que se estrechó al primer `h1`. El widget Flutter de320×568 mostró el nombre completo en varias líneas sin excepción.

**Archivos y solución.** `frontend-next/src/app/admin/students/[id]/page.tsx` permite envolver el nombre (`min-w-0 break-words`) y, solo en ancho móvil, pone navegación/acciones en la primera fila y el nombre a ancho completo debajo; desde `sm` conserva la fila inline previa. El email permanece compacto/truncado en la barra, y el perfil sigue mostrando el valor completo. `frontend-next/src/components/__tests__/phase5b-detail-scheme.test.tsx` agrega perfil sintético de nombre largo y apunta al primer encabezado. `frontend/test/features/admin/presentation/screens/admin_student_detail_screen_test.dart` extiende la escena existente a320×568 y verifica nombre de AppBar multilínea junto con esquema y revisión. `frontend-next/tests/e2e/phase5b-admin-student-name-reflow-browser.mjs` ejecuta Chromium sobre build productivo con respuestas API sintéticas; [mediciones agregadas](../ui/evidence/phase5b/admin-student-name-reflow/measurements.json) excluyen el texto.

**Pruebas y resultados.** Next `phase5b-detail-scheme.test.tsx`: **10 PASS**; la regresión de clase falló antes del cambio. Flutter `admin_student_detail_screen_test.dart`: **4 PASS**; `flutter analyze --no-pub`: **PASS**. Next lint, `tsc --noEmit`, `next build --webpack`, `node --check` y Chromium sintético a320/640/720 CSS px: **PASS**, nombre completo con wrap y `documentWidth <= viewport`. En320 el título ahora usa288 px de ancho y mide150 px de alto en vez de116×525; la fila de acciones conserva su ancho y no hay overflow. Un primer test ambiguo halló dos `h1` de igual nombre; se afinó al header fijo y la prueba roja confirmó el `truncate` antes del cambio. E2E verificó el viewport y usó rol/cuenta sintéticos, sin FastAPI/PostgreSQL, cuentas o datos institucionales. `git diff --check`: PASS.

**Límites, estado y rollback.** La comprobación720 CSS px aproxima reflow a200%, no activa zoom nativo. El email sigue truncado en el header Next; su ubicación difiere de Flutter, que lo muestra en el perfil. No se probó lector/teclado/dispositivo físico, contraste ni cobertura de otros estados S19. R03Z **DONE** para el nombre y su reflow móvil; S19/R03/Fase5B continúan **PARTIAL**. Migraciones/dependencias nuevas: ninguna. Rollback: restaurar clases/orden flex anteriores y retirar las pruebas, runner, mediciones y notas. Sin backend, API, clínica, autenticación, Azure, Maps, PDF/QR o commit.

## Continuación — R04 preview de último mensaje de comunicaciones S12/S13, 2026-11-05

**Causa raíz.** `ThreadRow` Next limitaba el último mensaje con `line-clamp-2`; el `ListTile` de Flutter usa `maxLines: 1` y `TextOverflow.ellipsis`. Un mensaje largo generaba una tarjeta Next más alta y mostraba una línea adicional en la lista, tanto para estudiante como para admin/app_admin.

**Archivos y solución.** `frontend-next/src/components/thread-row.tsx` cambia únicamente el clamp del preview a una línea. Se mantienen contenido de detalle, asunto, interlocutor, estados, notificaciones, acciones y permisos. `frontend-next/src/components/__tests__/phase5b-communications-peer.test.tsx` añade texto largo sintético y comprueba el límite; `frontend/test/core/phase5b_communications_peer_test.dart` verifica que Flutter conserva `maxLines: 1`. `frontend-next/tests/e2e/phase5b-communications-preview-line-browser.mjs` ejecuta el build productivo, intercepta respuestas sintéticas y mide Chromium. [Mediciones agregadas](../ui/evidence/phase5b/communications-preview-line/measurements.json) no contienen el mensaje.

**Pruebas y resultados.** Next peer + recovery: **48 PASS**; Flutter peer: **20 PASS**, `flutter analyze --no-pub`: **PASS**. Next lint, `tsc --noEmit`, `next build --webpack`, `node --check` y Chromium con fixtures sintéticos: **PASS**. A320/640/720 el browser confirma `-webkit-line-clamp:1`, altura de una línea y sin overflow de caja o documento. No se conectó FastAPI/PostgreSQL ni se crearon conversaciones. `git diff --check`: PASS.

**Límites, estado y rollback.** El cambio alinea únicamente el preview de lista; no modifica el preview del detalle ni el resto de comunicaciones. Fixtures interceptados no validan sesión o API desplegada. Lector/teclado/dispositivo físico, contraste y cobertura integral S12/S13 siguen UNKNOWN. R04 DONE solo para esta diferencia; S12/S13/R04/Fase5B permanecen PARTIAL. Migraciones/dependencias nuevas: ninguna. Rollback: restaurar `line-clamp-2` y retirar pruebas, runner, mediciones y notas. Sin backend, contrato, permisos, clínica, Azure, Maps, PDF/QR o commit.

## Continuación — R03AA etiqueta de dosis larga en esquema administrativo S19, 2026-11-05

**Causa raíz.** `AdminDoseRow` usaba `truncate` para `dose_config.label`, mientras Flutter presenta la misma etiqueta como título `Text` de `ListTile`, que envuelve. El test de componente Next falló antes del arreglo al recibir la clase `truncate`. Un primer E2E confirmó el recorte; al retirar la elipsis, Chromium mostró que la fila compartida dejaba solo96 px al título en320 px, con440 px de altura para la etiqueta larga. La causa secundaria eran las tres acciones rotuladas que ocupaban la misma fila.

**Archivos y solución.** `frontend-next/src/components/admin-dose-row.tsx` permite `break-words`; por debajo de768 px, etiqueta y acciones quedan apiladas para que el título use el ancho de contenido. Desde768 px se conserva la presentación horizontal. `frontend-next/src/components/__tests__/admin-dose-row.test.tsx` comprueba etiqueta completa/wrapping y ancho móvil; `frontend/test/features/admin/presentation/screens/admin_student_detail_screen_test.dart` añade etiqueta sintética larga y verifica que Flutter la distribuya en varias líneas. El runner `frontend-next/tests/e2e/phase5b-admin-scheme-title-reflow-browser.mjs` incluye un esquema/dosis sintéticos, mide reflow y actualiza [mediciones](../ui/evidence/phase5b/admin-scheme-title-reflow/measurements.json).

**Pruebas y resultados.** La regresión Next fue roja antes del arreglo. Next `admin-dose-row.test.tsx` + `phase5b-detail-scheme.test.tsx`: **16 PASS**; Flutter `admin_student_detail_screen_test.dart`: **4 PASS** y `flutter analyze --no-pub`: **PASS**. Next lint, `tsc --noEmit`, `next build --webpack`, `node --check` y Chromium headless con API sintética a320/640/720 CSS px: **PASS**. La etiqueta mide262×140,540×60 y620×60 px; no tiene ellipsis, envuelve y no desborda su caja o el documento. No se conectó FastAPI/PostgreSQL ni se usaron datos institucionales. `git diff --check`: PASS.

**Límites, estado y rollback.** 720 CSS px no es zoom nativo. Lector/teclado/dispositivo físico, contraste y el resto de estados/tablas de S19 permanecen UNKNOWN; la etiqueta de dosis no cierra la pantalla. R03AA **DONE** solo para esta discrepancia; S19/R03/Fase5B siguen **PARTIAL**. Sin migraciones ni dependencias. Rollback: restaurar `truncate` y la fila anterior en `admin-dose-row.tsx`, y retirar el test, mediciones y anotaciones de este bloque. Sin backend, contrato, clínica, auth, PDF/QR, Azure, Maps o commit.

## Continuación — R03AB estado inicial de acordeones del esquema administrativo S19, 2026-11-05

**Causa raíz.** Flutter `ExpansionTile` usa `initiallyExpanded=false`; Next enviaba `defaultOpen={index < 2}` a `AdminVaccineCard` y exponía las primeras dos listas de dosis sin interacción. La prueba previa describía ese comportamiento como esperado, pero la comparación directa con la implementación Flutter demostró que no coincidía. Una regresión actualizada falló antes de cambiar producto porque encontró `aria-expanded=true`.

**Archivos y solución.** `frontend-next/src/app/admin/students/[id]/page.tsx` elimina el parámetro `defaultOpen` y cada acordeón Next empieza cerrado. Se conserva el botón/semántica `aria-expanded`/panel y apertura por teclado/clic. `frontend-next/src/components/__tests__/phase5b-detail-scheme.test.tsx` ahora exige todos cerrados inicialmente y que Enter/Espacio alteren solo el panel enfocado. `frontend/test/features/admin/presentation/screens/admin_student_detail_screen_test.dart` afirma que Flutter conserva la referencia cerrada. El E2E sintético en `frontend-next/tests/e2e/phase5b-admin-scheme-title-reflow-browser.mjs` verifica estado inicial y activación explícita antes de medir la etiqueta larga; las mediciones siguen en [el artefacto de esquema](../ui/evidence/phase5b/admin-scheme-title-reflow/measurements.json).

**Pruebas y resultados.** Next `phase5b-detail-scheme.test.tsx`: **10 PASS**; Next detalle+dosis: **16 PASS**. Flutter `admin_student_detail_screen_test.dart`: **4 PASS**, `flutter analyze --no-pub`: **PASS**. Next lint (sin warnings), `tsc --noEmit`, `next build --webpack`, `node --check` y Chromium con fixtures sintéticos: **PASS**; el navegador confirma cerrado al inicio, abierto tras click explícito y sin overflow a320/640/720 CSS px. `git diff --check`: PASS.

**Límites, estado y rollback.** Solo se alinea la expansión inicial; los tres roles mantienen las mismas tarjetas/dosis y controles permitidos existentes. No se validó lector/dispositivo físico ni todos los estados de S19; esas dimensiones siguen UNKNOWN. R03AB **DONE** solo para este estado inicial; S19/R03/Fase5B continúan **PARTIAL**. Sin migración/dependencia. Rollback: restaurar `defaultOpen={index < 2}` y la prop en `AdminVaccineCard`, y retirar las aserciones/activación explícita agregadas en las pruebas/documentación de este bloque. Sin cambios backend, API, clínica, auth, PDF/QR, Azure, Maps o commit.

## Revalidación integrada R07 — suites completas de cliente, 2026-11-05

Sin cambios de producto en este bloque. Flutter `flutter test --no-pub --reporter expanded`: **443 PASS**, sin fallos ni skips. Next `npm test`: **571 PASS, 3 SKIP** en56 archivos (55 pasaron y uno contiene solo gates omitidos). Los tres skips son el E2E BFF y dos casos de sesión que usan `skipIf(!databaseUrl)`; no se configuró `BFF_TEST_DATABASE_URL`, así que no se cuentan como evidencia PostgreSQL. La primera ejecución sandbox mostró tres `EPERM` en pruebas loopback y568 PASS; la repetición completa autorizada fuera del sandbox pasó con571 PASS/3 SKIP. No son fallos de producto.

En la misma iteración Next `npm run lint`, `tsc --noEmit` y `next build --webpack` pasaron; Flutter analyze y formato pasaron; el E2E sintético de detalle/esquema/dosis pasó a320/640/720 CSS px. Esto no cubre backend/PostgreSQL, migraciones/concurrencia, el conjunto completo de E2E de navegador ni validación física; R07 sigue **PENDING** y Fase5B **PARTIAL**. `git diff --check`: PASS. Sin cambios funcionales, migraciones o commit; rollback documental.

### Actualización R07 — suites con PostgreSQL temporal, 2026-11-05

La corrida anterior de Next (**571 PASS, 3 SKIP**) se repitió con una instancia PostgreSQL 18.6 descartable, creada en `/tmp` y una base sintética `immuno_phase5b`. La suite completa finalizó con **574 PASS, 0 SKIP, 0 FAIL** en56 archivos; así se ejecutaron también el E2E BFF y los dos casos de sesión que antes se omitían por falta de `BFF_TEST_DATABASE_URL`. Las pruebas generan esquemas aleatorios y los limpian al terminar. La instancia quedó detenida (`pg_isready` no recibe respuesta en127.0.0.1:55544); los datos de prueba permanecen bajo `/tmp/pg-immuno-phase5b-20261105` y no contienen datos institucionales.

Este resultado reemplaza la cuenta anterior de Next únicamente para esta revalidación. Flutter conserva **443 PASS**, sin skips. R07 sigue **PARTIAL** porque aún falta evidencia del conjunto backend/PostgreSQL, migraciones y concurrencia, el E2E integrado final del producto y validación física de accesibilidad. Fase5B continúa **PARTIAL**. No hubo cambios funcionales, migraciones ni commit; `git diff --check`: PASS; rollback documental.

### Actualización R07 — backend, migraciones y E2E de navegador, 2026-11-05

**Entorno.** Venv temporal `/tmp/immuno-phase5b-backend`, Python3.12.15, pytest9.2.0, PostgreSQL18.6. Clúster y bases locales descartables con datos sintéticos. El venv de `backend/.venv` de este checkout conservaba un enlace a un intérprete temporal ausente; se instaló solo lo declarado por `backend/requirements-dev.txt` en el venv de `/tmp`. El primer pip sin red falló al resolver `pypi.org`; con autorización de red la instalación terminó sin editar dependencias del repo.

**Backend/PostgreSQL.** `PHASE1_INTEGRATION_URL=... pytest -vv --tb=short`: **389 PASS, 24 SKIP, 0 FAIL** en413 recolectados. La suite real contra PostgreSQL pasó los tests de sesión/reset concurrentes, rate limit multi-conexión, aprobación de evidencia/dosis, concurrencia de firmantes, reconciliación sintética, permisos, API y flujo clínico login→esquema→evidencia→revisión→certificado. Quedaron omitidos por diseño tres tests de migración con variables específicas y21 tests Chrome optativos; se ejecutaron después por separado.

**Migraciones.** `test_phase1_migration.py`, `test_phase2_migration.py` y `test_certificate_signer_migration.py`, cada uno sobre una base vacía distinta (`immuno_phase1_migration`, `immuno_phase2_migration`, `immuno_phase4_migration`): **3 PASS**. Verificaron upgrade a `head`, segunda ejecución idempotente, preservación de credenciales/filas y reporte de ambigüedades sin seleccionar firmante.

**Navegador integrado.** El grupo `test_phase5a_browser.py tests/test_phase5b_*_browser.py` con Chrome, build Next, FastAPI y PostgreSQL sintético completó **21 casos**:17 pasaron en la corrida inicial; cuatro fallaron por runners obsoletos. Causas: el runner de comentarios no expandía el acordeón tras el cambio R03AB; el runner de tema inspeccionaba el contenido antes de abrirlo, no esperaba a que cargara la ruta del esquema de estudiante y debía mantener cerrado ese acordeón durante la comprobación inicial; los formularios de alta/recuperación buscaban `Sede` en vez de `Campus`, usaban el setter `HTMLInputElement` para `<select>` y no esperaban opciones cargadas; recuperación enfocaba el primer botón de fila (“Enviar mensaje”) en vez de “Eliminar”. Solo se actualizaron esos runners. Los cuatro casos se repitieron y pasaron; con los17 iniciales, los21 tienen evidencia PASS. `node --check` PASS en los runners modificados.

**Gates de cliente.** La revalidación Next con PostgreSQL temporal es **574 PASS, 0 SKIP, 0 FAIL**; Next lint/typecheck/build webpack PASS. Flutter suite **443 PASS**, analyze/formato PASS. Estos resultados se ejecutaron antes de las ediciones test-only de los runners y documentación; no cambió código de producto.

**Revisión, límites y rollback.** `git diff --check` y escaneo de trailing whitespace de los documentos: PASS. Sin migraciones ni cambios funcionales. El clúster está detenido; el directorio de datos sintéticos sigue bajo `/tmp/pg-immuno-phase5b-20261105`, y las tres bases de migración quedan en ese clúster para inspección. No hay datos institucionales. Los tests emiten avisos deprecados por SQLAlchemy `noload`, Firebase `MulticastMessage.tokens` y scope pytest-asyncio sin configurar; no causaron fallos. R07 sigue **PARTIAL** por accesibilidad con lector/dispositivo físico y revisión global final de cambios/secretos en este árbol de trabajo amplio; Fase5B continúa **PARTIAL**. Rollback documental: revertir solo las ediciones de estos cuatro runners y retirar esta evidencia; ningún código de producto se cambió en este bloque.

## Continuación — R02M alineación temporal de S00, 2026-11-05

**Causa raíz.** Flutter limita la consulta de identidad `/users/me` a4s dentro de `AuthNotifier.checkSession`; el timeout visual externo de Splash es5s. Next limitaba la misma consulta a5s, por lo que un backend lento podía dejar la pantalla inicial de Next cargando un segundo más que Flutter.

**Cambio.** Next pasa el límite explícito de restauración a4s en `frontend-next/src/lib/auth/store.ts`. Se actualizan expectativas de `phase1-auth.test.ts` y `users-timeout.test.ts`; la prueba HTTP local ahora entrega una respuesta después del vencimiento y comprueba que el estado permanece anónimo. No se cambian tokens, BFF, contratos, persistencia, rutas ni semántica de autenticación.

**Pruebas.** `npm test -- src/lib/__tests__/phase1-auth.test.ts src/lib/api/__tests__/users-timeout.test.ts src/lib/api/__tests__/session-transport.integration.test.ts`: **14 PASS, 0 FAIL** en3 archivos. Incluye timeout Axios de4s, respuesta loopback demorada de4,8s,503, reset TCP, hidratación/destinos y regresión de carrera. `npm run lint`:PASS;`node node_modules/typescript/bin/tsc --noEmit`:PASS;`node node_modules/next/dist/bin/next build --webpack`:PASS. Sin credenciales reales ni servidor institucional.

**Límites, rollback y estado.** Sin migraciones ni cambios backend/Flutter. Rollback: restaurar el argumento de timeout a5s y las expectativas/prueba Next correspondientes. R02M DONE para alinear el límite local de restauración; R02/S00/Fase5B siguen **PARTIAL** mientras servicio desplegado, DNS/TLS/proxy, paridad visual/temporal integral y accesibilidad física sigan UNKNOWN. Sin commit.

## Continuación — R03AC actualización explícita del catálogo S21, 2026-11-05

**Causa raíz.** La pantalla Flutter envuelve catálogo poblado y vacío en `RefreshIndicator` con `AlwaysScrollableScrollPhysics`, así que el administrador puede volver a consultar después de una carga exitosa. Next solo ofrecía retry en el estado de error y no tenía una acción para actualizar tras una lectura exitosa.

**Cambio y archivos.** `frontend-next/src/app/admin/vaccines/page.tsx` añade el botón accesible “Actualizar catálogo” que invoca la query existente, deshabilitándolo mientras `isFetching`; la cabecera se apila en viewport estrecho para no desplazar la lista horizontalmente. `phase5b-catalog-dialog.test.tsx` añade casos de refresh en catálogo vacío/poblado y bloqueo durante petición. `phase5b-admin-catalog-name-reflow-browser.mjs` comprueba visibilidad/disponibilidad del control y que no haya overflow a320/640/720 CSS px.

**Pruebas.** `npm test -- src/components/__tests__/phase5b-catalog-dialog.test.tsx`: **17 PASS**. `npm run lint`, `node node_modules/typescript/bin/tsc --noEmit` y `node node_modules/next/dist/bin/next build --webpack`: **PASS**. `node tests/e2e/phase5b-admin-catalog-name-reflow-browser.mjs`: **PASS** con usuario y catálogo sintéticos; botón visible/habilitado, sin overflow horizontal a320/640/720 CSS px. La prueba Flutter que fundamenta la equivalencia es `vaccine_catalog_screen_test.dart` y ya cubre gesto de refresh en catálogo vacío; no se modificó Flutter.

**Riesgos, rollback y estado.** Sin cambios API/backend, reglas clínicas, migraciones ni Flutter; sin credenciales ni datos institucionales. Rollback: retirar el botón/test Next y la aserción E2E. R03AC DONE solo para refresh manual y reflow verificados; S21/R03/Fase5B permanecen **PARTIAL** por paridad integral y accesibilidad física UNKNOWN. No commit.

## Continuación — R05A semántica de carga de S21, 2026-11-05

**Causa raíz.** `VaccineCatalogPage` renderizaba “Cargando…” como un párrafo plano. En Flutter el `CircularProgressIndicator` expone la semántica `loadingSpinner` de Material, pero el párrafo Next no estaba marcado como estado ni como anuncio live.

**Cambio y pruebas.** El párrafo Next ahora utiliza `role="status"` y `aria-live="polite"`, sin alterar su apariencia. `phase5b-catalog-dialog.test.tsx` añade una consulta pendiente y comprueba que el usuario encuentra el estado accesible: suite focal **18 PASS**. Lint, typecheck y build webpack: **PASS**. El E2E Chrome del catálogo sigue PASS después del build final; fixtures sintéticos,320/640/720 CSS px,sin overflow.

**Límites, riesgo y rollback.** DOM/semántica automatizada no sustituye TalkBack/VoiceOver ni prueba hardware. Rollback: retirar atributos ARIA y la regresión de estado pendiente. Sin cambios Flutter/backend, API, clínica o migraciones. R05A DONE solo para estado de carga S21 automatizado; R05/S21/R03/Fase5B siguen **PARTIAL/UNKNOWN** por validación física y paridad integral. Sin commit.

## Continuación — R03AE creación disponible ante error de lectura no-auth S21, 2026-11-05

**Causa raíz.** Flutter mantiene el FAB “Nueva vacuna” en el `Scaffold`, incluso cuando la carga del catálogo muestra `_ErrorState`. Next retornaba `QueryError` como página completa antes de montar encabezado y modal, así que una falla transitoria de lectura quitaba la posibilidad de crear.

**Cambio.** Next mantiene encabezado, QueryError y retry dentro de la pantalla. La acción de crear queda disponible para errores distintos de401/403; en esos dos códigos las acciones permanecen ocultas, preservando el test de acceso denegado/sesión expirada. El botón de actualizar catálogo se oculta durante el error porque QueryError ofrece retry. No se cambia autorización FastAPI ni contrato.

**Pruebas.** `phase5b-catalog-dialog.test.tsx`: **20 PASS**. Un503 permite abrir el diálogo sin iniciar mutación;401 y403 presentan sus mensajes seguros y no muestran CTA. `npm run lint`, typecheck y build webpack: **PASS**. El E2E Chrome de catálogo con fixture sintético: **PASS**,320/640/720 CSS px sin overflow. No se invocó API real.

**Límites, riesgos y rollback.** El CTA se muestra en errores de lectura distintos de401/403; el caso503 está probado y otros errores no-auth siguen la misma condición implementada sin prueba individual en este bloque. El servidor sigue decidiendo si el POST está autorizado. Rollback: restaurar el retorno temprano de QueryError y retirar los casos 503/401/403. Sin migraciones, reglas clínicas ni cambios backend/Flutter. R03AE DONE solo en la representación y permisos UI probados; S21/R03/Fase5B permanecen **PARTIAL** por cobertura integral y validación física UNKNOWN. No commit.

## Continuación — R02N Enter desde contraseña en E2E Chrome S01, 2026-11-05

**Causa raíz.** Las pruebas JSDOM enviaban Enter desde el campo contraseña, pero el helper Chrome de `phase5b-account-forms-browser.mjs` enfocaba el botón `type=submit`. Por tanto, el E2E comprobaba Enter en el botón y no el submit implícito desde el último campo.

**Cambio.** El helper ahora enfoca `#password` antes de dispatchar Enter y espera el destino de dashboard. No se modificó formulario, contrato ni autenticación.

**Prueba ejecutada.** `PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a /tmp/immuno-phase5b-backend/bin/python -m pytest -q tests/test_phase5b_account_forms_browser.py --tb=short`: **1 PASS en5,61s**. Chrome/Next producción/BFF/FastAPI/PostgreSQL con schema sintético. El resto del runner conserva pruebas de error controlado de formularios; no envía correo ni cambia contraseña real. Seis warnings SQLAlchemy `noload` ya conocidos.

El primer intento dentro del sandbox quedó sin resultado visible y se interrumpió; al repetir con acceso local, el setup reportó que la base `immuno_phase1_phase5a` no existía. Se creó una base local vacía y el fixture creó/eliminó su schema aislado. PostgreSQL local se detuvo después. No hay datos institucionales ni secretos exportados en artefactos.

**Estado y límite.** R02N DONE para Enter desde contraseña en navegador y backend local sintético. No equivale a teclado físico, lector, red/TLS desplegados ni cierre de S01/R02. Rollback: restaurar el foco del botón submit en el helper; sin código funcional, migraciones o cambios de dependencia. Sin commit.

## Revalidación final de gates R07, 2026-11-05

**Evidencia ejecutada.** Backend `PHASE1_INTEGRATION_URL=... pytest -q --tb=short` contra PostgreSQL18.6 sintético: **389 passed,24 skipped,0 failed** en90,85s. Los skips corresponden a suites optativas con ejecuciones dedicadas: migraciones Fase1/Fase2/firmante **3 PASS** y Chrome/Next/FastAPI/PostgreSQL **21 PASS**. Este grupo se reejecutó completo después de R02N y lo incluye; no se suma su ejecución aislada. Next `BFF_TEST_DATABASE_URL=... npm test`: **580 PASS,0 SKIP**; `npm run lint`, `node node_modules/typescript/bin/tsc --noEmit` y `node node_modules/next/dist/bin/next build --webpack`: **PASS**. Flutter `flutter test --no-pub --reporter expanded`: **443 PASS**; `flutter analyze --no-pub`: **PASS**.

**Entorno, causa y límites.** El primer backend run en sandbox no produjo evidencia porque el entorno restringió descriptores/sockets; se repitió fuera del sandbox con permiso y terminó PASS. El E2E de navegador se corrió por separado, también con PostgreSQL descartable y datos sintéticos; el clúster quedó detenido. La suite informa seis deprecaciones SQLAlchemy `noload`, una de Firebase `MulticastMessage.tokens` y advertencia de scope pytest-asyncio no configurado; el grupo de navegador informa50 avisos `noload`; no son fallos. Las ejecuciones no son una sola corrida unificada y los24 skips no se cuentan como PASS dentro de esa invocación; se reportan por separado sus ejecuciones dedicadas.

**Cierre y rollback.** `git diff --check`: PASS. Ruff detectó dos bloques de imports desordenados y se corrigieron en `backend/app/modules/admin/router.py` y `backend/tests/test_phase5b_academic_options.py`; Ruff completo `app tests` terminó PASS. Al ser solo reordenamiento, no se repitió la suite funcional, que pasó inmediatamente antes. Sin migraciones ni dependencias. R07 sigue **PARTIAL** por validaciones físicas R05 y revisión final global del árbol de trabajo acumulado. H02/C02/A07 requieren decisiones del usuario; R02–R04 mantienen cobertura integral pendiente. Fase5B continúa **PARTIAL**. Rollback: retirar las anotaciones y restaurar el orden anterior de esas importaciones si fuera necesario.

## Revisión de credenciales de ejemplo y JMeter, 2026-11-05

**Causa raíz.** `backend/.env.example` tenía valores fijos e idénticos para `SECRET_KEY` y `REFRESH_SECRET_KEY`, sin texto marcador reconocido por el control de producción. No hay evidencia de que se hayan usado fuera del ejemplo; ese alcance es **UNKNOWN**. Los valores anteriores no se imprimieron ni se usaron.

**Cambio.** El ejemplo ahora usa dos placeholders distintos con prefijo `change-me-`, que `_check_production_safety` rechaza cuando `DEBUG=false`. `backend/tests/test_security.py` verifica que ambos existen, son distintos y que Settings no acepta la muestra en modo producción. La revisión del plan JMeter verificó los seis campos de login relacionados con usuario/correo/contraseña: todos usan propiedades `__P(...)`; no quedan credenciales literales en esos payloads. No se modificaron perfiles reales, configuración desplegada ni secretos externos.

**Pruebas y seguridad.** `pytest -q tests/test_security.py tests/test_jmeter_configuration.py`: **4 PASS**; Ruff `check app tests` y `format --check tests/test_security.py`: **PASS**. Escaneo dirigido de variables sensibles en archivos `.env*`: **5 asignaciones revisadas,0 literales sin marcar**. `git diff --check`: **PASS**. El escaneo fue dirigido, no un análisis forense de historial Git ni de sistemas desplegados.

**Riesgos y rollback.** Si el valor anterior del ejemplo se copió a un sistema real, su uso no es verificable aquí y requiere confirmación/rotación por los responsables; no se intentó autenticar con él. Rollback de código: no restaurar los valores anteriores; si hace falta, sustituir los placeholders por secretos aleatorios independientes mediante configuración segura fuera del repositorio. Sin migraciones ni dependencias.

## Decisiones R06: H02, C02 y A07 — 2026-11-06

**Alcance.** Se aplicaron las decisiones del usuario: historial web habilitado para `app_admin`; ocultar el destinatario cuando no se identifica a otro participante; y usar las opciones de semestre Flutter1–10. No se modificaron reglas clínicas, contratos de autenticación, permisos FastAPI, datos existentes ni despliegue. Sin migraciones.

### Causa raíz

- **H02:** el endpoint FastAPI ya permitía `admin` y `app_admin`, pero `/admin/history` tenía un `RoleGuard` exclusivo de `plain_admin` y el menú app_admin no ofrecía Historial.
- **C02:** ambos clientes buscaban primero una contraparte distinta al usuario conectado, pero luego devolvían como fallback `recipient`, `student` o `created_by`; si todos eran la misma persona, mostraban al propio usuario como destinatario.
- **A07:** Flutter ofrecía1–10, Next tenía rangos locales de1–12 y1–20 según pantalla, y `GET /admin/academic-options` no publicaba semestres. FastAPI aceptaba altas hasta20.

### Solución y archivos

- **H02:** `frontend-next/src/app/admin/layout.tsx` añade la navegación Historial; `frontend-next/src/app/admin/history/layout.tsx` y `frontend-next/src/components/role-guard.tsx` permiten ambos roles administrativos bajo `AuthGate requireRole="admin"`, sin cambiar la autorización FastAPI. `frontend-next/tests/e2e/phase5b-history-recovery-browser.mjs` verifica ruta y contenido app_admin.
- **C02:** `frontend-next/src/lib/ui/communication-peer.ts` y los renderizadores `thread-row.tsx`/`thread-detail.tsx` devuelven/representan ausencia cuando no hay contraparte. Los métodos `_participant` de `frontend/lib/features/shared/presentation/screens/communications_screen.dart` y `communication_detail_screen.dart` ya no tienen fallback a una identidad propia.
- **A07:** `backend/app/common/academic.py` define las opciones canónicas; `backend/app/modules/admin/router.py` las agrega de forma aditiva a `AcademicOptionsResponse`; `frontend-next/src/lib/api/types.ts` incorpora el campo. Dashboard, listado, alta y edición Next consumen el endpoint. `CreateStudentRequest` limita nuevas altas a1–10; `StudentAdminService.update_student_profile` impide cambiar un valor legacy fuera de rango, pero permite conservarlo si no cambia. Consultas y filtros mantienen el rango de lectura anterior hasta20 para encontrar registros históricos. Flutter no requiere cambio.
- Pruebas añadidas/actualizadas: `backend/tests/test_phase5b_academic_options.py`, `backend/tests/test_admin_integration.py`, `frontend-next/src/components/__tests__/phase5b-history-access.test.tsx`, `phase5b-communications-peer.test.tsx`, `phase5b-dashboard-context.test.tsx`, `phase5b-admin-dashboard.test.tsx`, `phase5b-admin-student-list-status.test.tsx`, `phase5b-field-labels.test.tsx`, `frontend-next/src/lib/__tests__/phase5b-dashboard-location.test.ts` y `frontend/test/core/phase5b_communications_peer_test.dart`.

### Pruebas y resultados

- Backend: `pytest backend/tests/test_phase5b_academic_options.py backend/tests/test_admin_integration.py -q`: **18 PASS**. Esta suite focal usa las fixtures de integración aisladas del repositorio; no se cuenta como PostgreSQL.
- Next: suite completa **579 PASS, 3 SKIP**; suite focal **90 PASS**; lint, TypeScript `--noEmit` y `next build --webpack`: **PASS**.
- Flutter: interlocutor focal **22 PASS**; suite completa **445 PASS**; `flutter analyze --no-pub`: **PASS**.
- Ruff en archivos backend tocados y `git diff --check`: **PASS**.
- E2E Chrome/Next/FastAPI/PostgreSQL sintético, `PHASE5A_BROWSER=1 ... pytest backend/tests/test_phase5b_history_recovery_browser.py -vv -s`: **1 PASS**. app_admin ve el enlace, carga la página2 y conserva contenido autorizado; estudiante mantiene403 en la ruta administrativa. Base `immuno_phase1_phase5a` local vacía con schema de test aislado; sin datos institucionales.

### Riesgos, rollback y estado

La respuesta académica es aditiva, pero Next requiere el nuevo campo `semesters`; desplegar primero el backend que lo sirve y luego Next. Perfiles existentes con semestres11–20 no se borran ni reescriben; siguen visibles y consultables, y solo pueden conservar su valor legacy sin cambiarlo. La UI oculta contrapartes ausentes; no resuelve personas por rol o ámbito. El historial app_admin conserva el alcance que FastAPI ya permitía.

Rollback acotado: retirar el campo `semesters`/constante y su consumo Next, restaurando los validadores de alta/edición anteriores; revertir el guard/nav H02 y el `null` C02 únicamente en sus líneas funcionales. No restaurar archivos completos del árbol porque contienen cambios previos de Fase5B. No hay migración ni datos que revertir.

**H02 = DONE, C02 = DONE y A07 = DONE** en alcance funcional y automatizado, incluido el E2E PostgreSQL/Chrome. **R04 y Fase5B permanecen PARTIAL**, R05 UNKNOWN para lector/dispositivo físico, UI-16/UI-17 BLOCKED, T-02/T-03 PARTIAL. No commit.

## Revisión C02 de identidad no verificable — 2026-11-06

**Causa raíz.** `communicationPeer` filtraba participantes con `user.id !== currentUserId`. Si `currentUserId` era `null`, todos los participantes no nulos calificaban como “otra persona”, aunque el cliente no tenía identidad autenticada con la cual distinguir a la contraparte.

**Cambio.** `frontend-next/src/lib/ui/communication-peer.ts` ahora devuelve `null` cuando falta el ID del usuario actual. La lista (`thread-row.tsx`) y el detalle (`thread-detail.tsx`) ocultan el nombre/avatar en ese estado. No cambia el contrato FastAPI, los destinatarios, estados, acciones ni permisos. Se añadieron regresiones de lista y detalle con usuario viewer sin ID en `frontend-next/src/components/__tests__/phase5b-communications-peer.test.tsx`; la cobertura existente de contraparte ausente se conserva.

**Verificación.** Suite focal C02: **25 PASS**; Next completo con PostgreSQL sintético: **584 PASS,0 SKIP**; lint, typecheck y `next build --webpack`: **PASS**. La base de prueba fue local/sintética y el clúster quedó detenido.

**Riesgo y rollback.** Riesgo bajo: durante una identidad transitoria incompleta se oculta la contraparte hasta conocer el ID. Rollback: revertir el guard `if (!currentUserId) return null` y retirar el test agregado; no restaurar los archivos completos que contienen trabajo previo. Sin migración ni cambio de API. C02 permanece **DONE** en representación; R04/Fase5B siguen **PARTIAL** por paridad integral y validación física pendientes.

## Revisión de acceso Android para R05 — 2026-11-06

`lsusb` fuera del sandbox detecta el teléfono en modo MTP; se descargaron Platform Tools oficiales a `/tmp` y se mantuvo ADB fuera del árbol del proyecto. Dos consultas `adb devices -l` (servidor iniciado con el usuario temporal local) devolvieron una lista vacía. El sandbox no expone `/dev/bus/usb`; la interfaz ADB no llegó a la sesión y no apareció el diálogo RSA. No se navegó ni se extrajeron archivos del dispositivo. La causa del bloqueo (configuración USB/ADB o passthrough del host) permanece **UNKNOWN**.

No se ejecutaron TalkBack, ampliación nativa, teclado virtual ni capturas en el teléfono. R05 permanece **BLOCKED/UNKNOWN** hasta que el sistema exponga la interfaz ADB o se aporte evidencia física verificable. El paquete adb de Ubuntu y el ZIP oficial de Platform Tools quedaron solo bajo `/tmp`; no hubo instalación global ni cambio al proyecto.

## Revalidación final de gates R07 — 2026-11-06

Esta sección reemplaza los conteos de gates anteriores solo para esta revalidación. No declara paridad visual integral ni accesibilidad física.

### Entorno

- Python **3.12.15**, PostgreSQL **18.6**, Node **22.22.1**, npm **9.2.0**, Next **16.3.6**, Chrome **157.0.8103.38**, Flutter **3.41.6** y Dart **3.11.4**.
- Las dependencias backend se instalaron temporalmente en `/tmp` desde `backend/requirements-dev.txt`, que incluye las declaraciones del proyecto. No se modificaron dependencias ni lockfiles del proyecto. El entorno resolvió FastAPI **0.162.0**, SQLAlchemy **2.1.8**, pytest **9.2.0** y Ruff **0.17.4** dentro de los rangos declarados.
- PostgreSQL fue un clúster local descartable con bases `immuno_phase1_*`, vacías/sintéticas y loopback solamente. No se conectó a datos institucionales.

### Comandos y resultados

- `PHASE1_INTEGRATION_URL=... pytest -q --tb=short`: **393 passed,24 skipped** en la suite completa backend/PostgreSQL. Los 24 skips son los gates optativos de migración y navegador; las mismas categorías se ejecutaron separadamente.
- `PHASE1_POSTGRES_URL=... PHASE2_POSTGRES_URL=... PHASE4_SIGNER_POSTGRES_URL=... pytest -q tests/test_phase1_migration.py tests/test_phase2_migration.py tests/test_certificate_signer_migration.py`: **3 passed** en tres bases PostgreSQL sintéticas vacías; upgrade a `head` repetido sin downgrade ni destrucción.
- `PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node PHASE1_INTEGRATION_URL=... pytest -q tests/test_phase5a_browser.py tests/test_phase5b_*_browser.py`: **21 passed** con Chrome, Next producción, FastAPI y PostgreSQL sintético, en416.42s.
- `BFF_TEST_DATABASE_URL=... npm test`: **582 passed,0 skipped**. `npm run lint`, `node node_modules/typescript/bin/tsc --noEmit` y `node node_modules/next/dist/bin/next build --webpack`: **PASS**.
- `flutter analyze --no-pub`: **PASS**; `flutter test --no-pub`: **445 passed**; `dart format --output=none --set-exit-if-changed lib test`: **0 archivos por formatear**.
- `/tmp/immuno-phase5b-backend/bin/ruff check app tests`: **PASS**; `ruff format app tests` reformateó seis archivos, sin cambios de lógica; `ruff format --check app tests`: **PASS**. Tras el formato, las pruebas backend focales de contratos, emisión transaccional y opciones académicas: **15 passed**.
- `git diff --check`: **PASS**. Barrido adicional de trailing whitespace sobre522 archivos de texto modificados/nuevos: **0 hallazgos**. Barrido de patrones de credenciales de alta confianza sobre los mismos522 archivos: **0 coincidencias**; no es una investigación forense del historial Git.

La primera suite backend usó una base cuyo nombre no cumplía el prefijo de seguridad de la fixture y produjo errores de setup; no se cuenta como evidencia. Repetida con `immuno_phase1_phase5b_final`, pasó. El primer `flutter test` dentro del sandbox no pudo abrir sockets loopback; se repitió con acceso local y pasó. Los avisos no bloqueantes incluyen la deprecación SQLAlchemy `noload`, `MulticastMessage.tokens`, scope predeterminado de pytest-asyncio y el aviso del cargador Vite.

### Revisión, límites y estado

El inventario de evidencia visual contiene36 grupos, pero varios no tienen capturas pareadas de ambas plataformas y no cubren todas las combinaciones por pantalla/estado/viewport requeridas. Por ello **R02, R03 y R04 siguen PARTIAL** aunque los gates automatizados funcionales pasen.

`flutter devices --machine` detectó Linux y Chrome, sin Android/iOS físico. TalkBack/VoiceOver en dispositivo, zoom nativo, teclado virtual y hardware móvil permanecen **UNKNOWN**; no se usó un navegador o widget test como sustituto.

El árbol acumulado tiene177 rutas rastreadas modificadas,1214 archivos sin rastrear (942 bajo `docs/ui/evidence/phase5b`, principalmente capturas) y2 eliminaciones, procedentes de trabajo previo de fases. Se revisaron gates, cambios recientes, estructura del diff y patrones de credenciales, pero no se completó una revisión semántica línea por línea de todo ese árbol amplio. Se creó `docs/audits/phase5b-closure.md` con el estado **PARTIAL** y los criterios restantes. No hubo migraciones nuevas de Fase5B, cambios de reglas clínicas ni commit.

## Validación Android física R05 y revalidación Flutter — 2026-11-07

### Causa raíz investigada

En un POCO X4 Pro físico, la pantalla permanecía en «Ingresando» aunque no se habían enviado credenciales. La causa reproducida en widget test fue que `SplashScreen.initState()` iniciaba la restauración de sesión, y `checkSession()` mutaba el provider mientras Flutter construía el árbol. El manejo de error redirigía a login, pero dejaba `AuthState.isLoading=true`; además, `Future.timeout` no cancela por sí misma la restauración tardía. Por separado, a escala de texto Android1.8× el label del correo no cabía en una línea y quedaba truncado.

### Solución y archivos

- `frontend/lib/features/auth/presentation/screens/splash_screen.dart`: diferir la restauración al primer frame y cancelar lógicamente la operación al expirar la pantalla de splash.
- `frontend/lib/features/auth/presentation/providers/auth_provider.dart`: epoch para ignorar respuestas tardías y restablecer el estado anónimo/carga al cancelar.
- `frontend/lib/features/auth/presentation/screens/login_screen.dart`: label del correo envolvente; semántica de error live region y acciones Next/Done del teclado.
- Pruebas: `frontend/test/e2e/app_smoke_test.dart`, `frontend/test/features/auth/presentation/providers/auth_provider_test.dart`, `frontend/test/features/auth/presentation/screens/login_screen_test.dart`; fakes/interfases actualizados en los tests Flutter de login, router, dashboard admin, detalle admin y smoke/integration.

### Verificación

- Dispositivo conectado: Flutter lo reconoció como Android ARM64; el identificador USB no se conserva en este informe.
- `flutter test integration_test/app_smoke_test.dart --no-pub -d 2201116PG` desde `frontend/`: **1 PASS**; inicia la app y llega al login anónimo con auth fake. No se introdujeron credenciales.
- En el dispositivo se inspeccionó login con escala de texto1.0× y1.8×: el label largo ahora envuelve y el formulario permanece dentro del viewport. El teclado virtual se abrió sin introducir texto. Capturas: [1.0×](../ui/evidence/phase5b/android-physical-login/login-font-1.0.png), [1.8×](../ui/evidence/phase5b/android-physical-login/login-font-1.8.png).
- Regresión de semántica Flutter: labels de correo, contraseña e ingreso; test automatizado a escala1.8×. El servicio TalkBack se enlazó temporalmente, y la configuración original desactivada fue restaurada. **La salida hablada, el orden de foco y la navegación auditiva real no se verificaron**.
- Repetición local: `flutter analyze --no-pub` **PASS**; `flutter test --no-pub --reporter expanded` **447 PASS**; `dart format --output=none --set-exit-if-changed lib test` **PASS**, 103 archivos examinados,0 cambiados.
- El runner registró una advertencia de SDK XML v4 con herramientas que interpretan hasta v3. El APK debug se compiló y el test terminó PASS.

### Alternativa con Android Emulator

Android Studio estaba instalado, pero no el paquete de emulador ni un AVD. Se instaló Android Emulator **37.2.13** y la imagen **Android 15/API35 Google APIs x86_64** en `frontend/build/phase5b-android-sdk` (ruta ignorada por Git), y se creó el AVD `immunoclinic_phase5b_api35_workspace`. El primer directorio de datos en `/tmp` no tenía los12GB que el emulador reserva para userdata; el AVD se reubicó bajo el SDK local, con espacio disponible.

Este host no expone `/dev/kvm`; al arrancar con `-accel off`, Flutter reconoció el AVD, pero `sys.boot_completed` siguió vacío y la instalación de la app no avanzó. Se canceló el runner a los127,2s: **No tests ran / ADB exit -2**. No es evidencia de fallo de la app y no se cuenta como PASS. El proceso emulador se detuvo; el AVD instalado se conserva para un host con aceleración. No se hicieron más operaciones sobre el POCO.

### Incidente de instalación, límites y rollback

El runner encontró instalada la misma `applicationId` con una firma distinta; su recuperación automática desinstaló la versión existente e instaló el APK de prueba. Por tanto, **la posible pérdida de datos locales de esa instalación previa es UNKNOWN**. La limpieza final del runner falló al eliminar una variante de paquete de prueba; una consulta ADB de solo lectura confirmó que el paquete principal estaba instalado al terminar. No se hicieron más operaciones de instalación/desinstalación y no se intentará restaurar ni borrar paquetes sin autorización; el usuario debe verificar si la instalación anterior o sus datos eran necesarios.

R05 pasa de **BLOCKED/UNKNOWN** a **PARTIAL**: Android, teclado virtual y reflow1.8× tienen evidencia física, pero el habla/foco de TalkBack, zoom nativo separado, las demás pantallas, VoiceOver/iOS y cobertura física de permisos/errores por rol permanecen **UNKNOWN**. R02–R04 y R07 continúan **PARTIAL** por falta de paridad integral. No hubo migraciones, cambios clínicos/API/backend, login real ni commit. Rollback de código: revertir únicamente los cambios descritos en los tres archivos Flutter de producción y sus tests asociados; no revertir el árbol acumulado como conjunto. La instalación anterior del teléfono no tiene rollback verificado.

## Revalidación Next por solicitud del usuario — 2026-11-07

Se usó Node22.22.1/npm9.2.0, Next16.3.6 y PostgreSQL18.6 local con base sintética `immuno_phase5b_final`. El primer arranque falló porque el clúster intentaba crear socket bajo `/var/run/postgresql`; se reinició con socket en `/tmp` y listener loopback únicamente.

- `BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase5b_final npm test`: **584 PASS**,57 archivos,0 skips.
- `npm run lint`: **PASS**.
- `node node_modules/typescript/bin/tsc --noEmit`: **PASS**.
- `node node_modules/next/dist/bin/next build --webpack`: **PASS**, Next16.3.6.
- `npm run start -- --hostname 127.0.0.1 --port 3010`: runtime listo. GET `/login` y `/admin` respondieron **HTTP200**. Esta comprobación no valida autorización, APIs con sesión, ni comportamiento de navegador; no cuenta como comparación Flutter/Next.

Se detuvieron el servidor Next y PostgreSQL. No hubo cambios de código, esquema ni migración. El aviso Vite `configLoader: native` no bloqueó las pruebas. R02–R04, R05 TalkBack/zoom y R07 siguen **PARTIAL/UNKNOWN**; esta revalidación no cierra Fase5B. Sin commit.

## Reintento con Android Studio Emulator — 2026-11-07

**Objetivo.** Intentar completar R05 en un AVD de Android Studio ante la indisponibilidad actual del teléfono físico por ADB.

**Causa raíz del bloqueo.** `emulator -accel-check` confirmó que este host no dispone de `/dev/kvm`. El AVD API35 x86_64 solo pudo correr con TCG/`-accel off`; el primer arranque tardó ~194s. Aunque ADB reconoció `emulator-5554` y Package Manager respondió, el sistema mostró el diálogo “System UI isn't responding”.

**Ejecución y resultado.** Se construyó `app-debug.apk` correctamente. Dos intentos de `flutter test integration_test/app_smoke_test.dart --no-pub -d emulator-5554` quedaron en `Installing build/app/outputs/flutter-apk/app-debug.apk...` sin empezar tests y fueron cancelados; resultados: **No tests ran**, y en uno ADB exit **-2**. El paquete llegó a instalarse, pero al lanzar la app el AVD seguía con la UI de sistema no respondiente. No se considera test de app aprobado ni fallo funcional de la app. El emulador quedó apagado.

**Alcance, seguridad y rollback.** Solo se usó el AVD sintético local API35, sin cuentas ni datos institucionales. No se cambiaron archivos funcionales del repositorio, API, clínica ni configuración Android del producto. Se detuvo el AVD y no se hicieron más instalaciones. `No tests ran` permanece como bloqueo por falta de aceleración disponible. R05/R07 y Fase5B siguen **PARTIAL** hasta contar con un host con KVM o dispositivo físico accesible, además de cubrir lectores/zoom y las pantallas restantes.

## Revalidación física complementaria: texto grande en login — 2026-11-07

### Causa raíz

Con Android en escala de texto1.8×, la altura mínima de52 logical px no alcanzaba para la altura real del label del botón más su padding vertical. La reproducción física mostraba «Ingresar» cortado. El test widget que comprobaba solo la restricción mínima no reproducía el escalado de forma explícita; se actualizó para inyectar `TextScaler.linear(1.8)` y comprobar tanto el crecimiento del botón como que el label quede dentro de su rectángulo.

### Cambio

- `frontend/lib/features/auth/presentation/screens/login_screen.dart`: mide el label actual con el `TextScaler` y el estilo efectivos; reserva `max(52, altura del label + padding.vertical)` consultando el estilo efectivo del botón. El tema actual aporta28px. No cambia colores, texto, acciones, navegación ni reglas.
- `frontend/test/features/auth/presentation/screens/login_screen_test.dart`: test a1.8× que verifica semántica, reflow, altura suficiente y límites del label.
- Evidencia actual del dispositivo: [POCO X4 Pro, login a1.8×](../ui/evidence/phase5b/android-physical-login/login-button-font-1.8-fixed.png).

### Verificación

- Test focal antes del ajuste: **FAIL** esperado, botón52px frente al label escalado36px; reprodujo la condición.
- Test focal con corrección: **PASS**.
- `flutter analyze --no-pub`: **PASS**.
- `flutter test --no-pub --reporter expanded`: **447 PASS**.
- `dart format --output=none --set-exit-if-changed` sobre los2 archivos Flutter tocados: **PASS**,0 cambios.
- `flutter test integration_test/app_smoke_test.dart --no-pub -d 2201116PG`: **1 PASS** en el POCO físico; terminó en31s.
- `flutter run --no-pub -d 2201116PG`: compiló e instaló el build debug exacto después de que el usuario desbloqueó el teléfono y habilitó “Instalar vía USB”. ADB confirmó paquete y proceso activos. La captura física a1.8× se obtuvo en el build inmediatamente anterior, que tenía el mismo padding efectivo de28px; la refactorización posterior solo consulta ese valor desde el tema y queda cubierta por los tests actualizados.
- Escala Android restaurada y consultada a1.0×. No se usaron credenciales ni datos clínicos. El APK debug queda instalado; se recomienda desactivar “Instalar vía USB” tras la revisión manual, lo cual no desinstala la app.

### Riesgo y rollback

El cálculo usa el padding vertical resuelto del tema y mantiene52px como mínimo; el fallback de28px conserva la altura usada por el tema actual cuando no hay un padding explícito. El test a texto grande debe mantenerse ante futuros cambios del tema. Rollback acotado: revertir únicamente el cálculo dinámico y la regresión añadida; no revertir cambios anteriores del login. No hay migraciones ni cambios de API/dominio.

**Estado:** la corrección puntual queda **DONE**. El usuario confirma que TalkBack ya se probó en una interacción anterior, pero no hay registro del anuncio/orden observado; no se repite y esos subresultados quedan UNKNOWN. Se intentó zoom nativo leyendo/guardando primero la configuración; el flag estaba en0, activarlo por ADB y triple-tap no mostró ampliación; se restauró en0 y se conservaron escala2.0 y atajo de TalkBack. Esto no prueba fallo de la app y deja zoom nativo **UNKNOWN**, pendiente de habilitación desde Ajustes. R05 continúa **PARTIAL** junto con otras pantallas y VoiceOver/iOS. R02–R04 y R07 siguen PARTIAL; Fase5B no se cierra.

## Continuación — R02, composición visual del login S01, 2026-11-07

### Causa raíz

En Next el layout compartido colocaba marca, título institucional y logo fuera y arriba de todas las tarjetas de autenticación. El login Flutter coloca el logo dentro de una tarjeta de hasta460px, con título alineado a la izquierda y rótulos dentro de los campos. Las capturas pareadas mostraron que el contenido y el flujo existían en ambos clientes, pero la jerarquía y distribución vertical del login Next no correspondían a Flutter. El layout es compartido con recuperación/reset, por lo que un cambio global habría alterado pantallas ajenas al hallazgo.

### Cambio acotado

- `frontend-next/src/app/(auth)/layout.tsx`: añade marcadores de shell/cabecera para estilos específicos de la ruta.
- `frontend-next/src/app/(auth)/login/page.tsx`: incorpora el logo en la tarjeta, conserva las etiquetas accesibles y usa su presentación flotante dentro de los dos campos; las alturas de campos y botón quedan en52px.
- `frontend-next/src/app/globals.css`: oculta la cabecera externa y ajusta ancho, padding y radio únicamente cuando el shell contiene la tarjeta del login. Las páginas de recuperación/reset siguen usando el shell compartido original.
- `frontend-next/src/components/__tests__/phase5b-login-layout.test.tsx`: prueba composición, asociación accesible, medidas, y que el estado `data-filled` siga el borrador sin perder el rótulo.
- `frontend-next/tests/e2e/phase5b-login-layout-browser.mjs`: medición Chromium real del login y recuperación a393×873; intercepta solo la restauración anónima de `/api/users/me` con503 sintético. No envía credenciales ni muta datos.
- Evidencia: [Flutter físico](../ui/evidence/phase5b/login-parity/flutter-login-light-physical.png), [Next login](../ui/evidence/phase5b/login-parity/next-login-light-393x873.png), [Next recuperación](../ui/evidence/phase5b/login-parity/next-forgot-password-light-393x873.png), [mediciones y alcance](../ui/evidence/phase5b/login-parity/measurements.json).

### Verificación

- Next tests focales: **5 PASS**.
- Next suite completa sin PostgreSQL configurado en esta corrida: **582 PASS,3 SKIP,0 FAIL**. No se cuenta como la ejecución histórica con PostgreSQL.
- `npm run lint`: **PASS**.
- `node node_modules/typescript/bin/tsc --noEmit`: **PASS**.
- `node node_modules/next/dist/bin/next build --webpack`: **PASS**.
- E2E de layout Chromium/Next production local: **PASS**; login y recuperación conservan el ancho de viewport, la cabecera común permanece visible en recuperación y no aparece alerta de sesión al simular un503 durante la restauración anónima.
- Login Next medido: tarjeta x24/y178.5,345×516px, radio24px; campos y botón52px; `scrollWidth=innerWidth=393px`. Label interno centrado sin valor y flotado a12px cuando el contenedor representa valor. El tema y la API clínica no cambiaron.
- La captura Flutter es de POCO físico (1080×2400, barras del sistema incluidas); Next es Chrome a393×873 CSS px. Se comparó estructura y huella, no similitud píxel a píxel ni todos los tamaños/temas.

### Estado, límites y rollback

**S01/R02: DONE para la composición base del login y el shell de recuperación comprobado; R02 y Fase5B siguen PARTIAL.** La comparación no cubre login con errores, loading, contraste bajo otros temas, otros viewports, teclado virtual ni lector real; esos resultados no se extrapolan. El control `:focus-within` está implementado, pero esta prueba solo midió el estado vacío y el estado relleno; el foco nativo de teclado no queda acreditado por esta corrida. En una captura local anterior sin interceptación apareció «Tu sesión expiró. Inicia sesión nuevamente»; no se registró el status HTTP ni la existencia/origen de sesión. Su causa e impacto son **UNKNOWN**. La corrida final controló un503 y no reproduce ni cierra ese caso; hace falta capturar el estado con respuesta/status observados antes de tocar autenticación. No hay cambios Flutter/backend/API/migraciones ni cambios de autenticación. Rollback: revertir únicamente los tres archivos de producción Next y el test/script/evidencia de este bloque. Sin commit.
