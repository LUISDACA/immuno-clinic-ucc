# Fase 5B — Diagnóstico del E2E de temas y desbordamiento móvil

Revisión: 2026-10-09, America/Bogota. **REGISTRO DEL DIAGNÓSTICO PREVIO A LA CORRECCIÓN. FASE 5B = PARTIAL.** Las dos correcciones se autorizaron e implementaron después; su evidencia actual está en [phase5b-implementation.md](phase5b-implementation.md). Este documento conserva los resultados FAILED originales y de las sondas, sin convertirlos en PASS.

Alcance: continuar la revisión del [plan](phase5b-plan.md) sin modificar código del repositorio. Se leyeron `AGENTS.md` y las skills locales `ui-parity`, `quality-gates` y `security-health`. No se cambian reglas clínicas, backend funcional, contratos, autenticación, PDF/QR, Maps, Azure ni permisos. UI-16/UI-17 siguen BLOCKED por alcance; T-02/T-03 permanecen PARTIAL.

## Entorno y método

Se utilizó el harness existente `backend/tests/test_phase5a_browser.py`: Chrome → build de producción Next ya existente → FastAPI → PostgreSQL local sintético. Node v22.22.1 y Python 3.12.15; no se instalaron paquetes ni se reconstruyó el build durante este diagnóstico. No se usaron cuentas ni datos institucionales.

Se reprodujo primero el runner original. Para observar eventos y aislar la siguiente comprobación se preparó una copia temporal del runner y un plugin pytest exclusivamente en `/tmp/immuno-miguel-tools/phase5b-diagnosis/`. El plugin sustituye el path del subprocess Node y su directorio de artefactos; conserva servicios, fixtures, permisos y assertions. Las sondas mantienen el fallo original y no cuentan como gates aprobados.

Comando de reproducción, desde `backend/`:

```sh
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q --tb=short --show-capture=no \
tests/test_phase5a_browser.py -k phase5b
```

Para las sondas se mantuvo el comando y se añadieron `PYTHONPATH=/tmp/immuno-miguel-tools/phase5b-diagnosis` y `-p phase5b_diagnostic_plugin`. Ese plugin temporal no es una dependencia ni una prueba nueva del proyecto. La ejecución inicial restringida encontró `Failed to create stream fd: Operation not permitted` y se interrumpió; las reproducciones posteriores utilizaron la ejecución ampliada autorizada para procesos/sockets locales.

## D-01 / P2 — Enter incompleto en la automatización

- **Archivo / función:** `frontend-next/tests/e2e/phase5b-theme-browser.mjs:66–68`, secuencia de `Input.dispatchKeyEvent` y espera de tema claro.
- **Problema:** el runner original falla con `Timeout: manual light applied and transition finished`.
- **Causa demostrada:** esta secuencia CDP envía `keyDown` y `keyUp` de Enter sin producir `keypress` ni `click` sobre el botón. El elemento correcto tiene foco y `document.hasFocus()` es true. No se ha demostrado que el manejador de tema de la aplicación esté defectuoso.
- **Impacto:** falso diagnóstico de una preferencia de tema rota; el runner se detiene antes de probar responsive y de escribir las mediciones finales.
- **Propuesta:** completar la secuencia de Enter en el runner, con el evento `char` correspondiente entre pulsación y liberación, o usar un helper de teclado que genere la secuencia equivalente. Conservar las assertions de foco, selección, persistencia y CSS real. No sustituir la acción por un click programático ni relajar el timeout como solución.
- **Pruebas necesarias:** ejecutar el runner corregido en Chrome, verificar activación desde teclado, `aria-pressed`, preferencia persistida y cambio de Badge; repetir el E2E 5A existente para demostrar que no se pierde cobertura.
- **Estado durante el diagnóstico:** causa identificada; cambio de prueba **NOT IMPLEMENTED** entonces. Estado posterior **DONE** según el audit de implementación. Sin decisión clínica.

La traza registra:

| Observación | Secuencia original | Sonda temporal que completa Enter |
|---|---|---|
| Botón «Claro» enfocado / documento enfocado | true / true | true / true |
| Eventos de activación | keydown, keyup | se añaden keypress y click |
| Tema resultante | system | light |
| Preferencia almacenada | sepia, recuperada como system | light |
| Fondo del Badge real | rgb(61, 44, 0) | rgb(255, 246, 214) |

La primera sonda vuelve a lanzar el error original después de observar el cambio; su resultado sigue siendo FAILED. Una segunda copia temporal completa Enter y conserva las comprobaciones siguientes: alcanza el cambio de tema, la selección y el contraste, pero falla después por D-02. No se presenta como E2E aprobado.

## D-02 / P2 — Decoración que amplía el viewport móvil

- **Archivo / función:** `frontend-next/src/components/brand.tsx:23–34`, `UccBrandBackground`. Consumido en `(auth)/layout.tsx:10`, `app-shell.tsx` y la página raíz.
- **Problema:** con viewport solicitado de 390×844, el login tiene `documentElement.clientWidth=390`, `scrollWidth=446` e `innerWidth=446`. La assertion anterior `scrollWidth <= innerWidth` por sí sola no detectaría esta expansión.
- **Causa demostrada:** dos círculos decorativos absolutos, con `-right-14` y `-left-16`, están fuera de una capa que limite su overflow. El círculo derecho termina en x=446; el izquierdo empieza en x=-64. El metatag existente es `width=device-width, initial-scale=1`; esperar 500 ms no corrige las medidas.
- **Impacto:** contenido más ancho que el viewport solicitado y autoescalado móvil observado (`visualViewport.scale≈0.9084`). Las capturas móviles previas no bastan para acreditar reflow correcto.
- **Propuesta:** contener únicamente la decoración en una capa absoluta con límites del fondo, overflow recortado, `aria-hidden` y sin eventos de puntero. Mantener contenido interactivo fuera de esa capa y conservar scroll vertical, foco, menús y overlays. No aplicar un `overflow:hidden` global que oculte contenido legítimo.
- **Pruebas necesarias:** componente para la separación de decoración/contenido; navegador a 320/390/768/1440, comparación del ancho solicitado con `clientWidth`, `scrollWidth` e `innerWidth`, reflow/zoom, menús abiertos y formularios largos. Verificar consumidores de la capa compartida sin añadir capacidades a pantallas excluidas.
- **Estado durante el diagnóstico:** defecto demostrado en login; corrección **NOT IMPLEMENTED** entonces. Estado posterior **DONE** en el alcance medido según el audit de implementación. El comportamiento de cada estado de todos los consumidores permanece **UNKNOWN** hasta ejecutarlo. Sin decisión clínica ni cambio de autenticación.

Una sonda exclusivamente en el DOM de Chrome agrupa los dos elementos decorativos en una capa recortada, sin mover el contenido del formulario. Las medidas pasan a 390/390/390 y escala 1. El test conserva la assertion contra el ancho original 446 y permanece FAILED; la sonda demuestra causalidad, no una corrección desplegada ni un gate aprobado.

| Medida | Login original | Tras esperar 500 ms | Sonda DOM de contención |
|---|---:|---:|---:|
| clientWidth | 390 | 390 | 390 |
| scrollWidth | 446 | 446 | 390 |
| innerWidth | 446 | 446 | 390 |
| visualViewport.width | 429,30 | 429,30 | 390 |
| visualViewport.scale | 0,9084 | 0,9084 | 1 |

Evidencia conservada: [observations.json](../ui/evidence/phase5b/diagnosis/observations.json), [login original](../ui/evidence/phase5b/diagnosis/diagnosis-mobile-overflow.png) y [sonda de contención](../ui/evidence/phase5b/diagnosis/diagnosis-mobile-decoration-contained.png). Las imágenes muestran únicamente credenciales de fixture sintético y feedback de login; no contienen tokens ni datos institucionales. La segunda imagen representa una modificación temporal del DOM, no el estado del código.

## Resultados de ejecución

| Ejecución | Resultado real | Duración / explicación |
|---|---|---|
| Runner original | 1 FAILED, 1 deselected, 6 warnings | 14,54 s; timeout al activar Claro. |
| Traza de teclado + char después del fallo | 1 FAILED, 1 deselected, 6 warnings | 14,86 s; identifica ausencia de keypress/click y vuelve a lanzar el fallo. |
| Copia temporal con Enter completo | 1 FAILED, 1 deselected, 6 warnings | 5,22 s; alcanza responsive, 446 ≠ 390. |
| Sonda de geometría y espera | 1 FAILED, 1 deselected, 6 warnings | 5,70 s; confirma decoración fuera del ancho y persistencia tras 500 ms. |
| Sonda de capa decorativa | 1 FAILED, 1 deselected, 6 warnings | 6,74 s; geometría contenida 390/390/390, conserva fallo del original. |

Los warnings corresponden a `noload` de SQLAlchemy en fixtures existentes. Los cinco resultados no se suman como pruebas distintas ni se cuentan como PASS. El flujo 5A está deselected en estas reproducciones; los asserts de seguridad y esquema al final del harness no se alcanzan cuando el runner falla.

No se ejecutaron aquí las suites completas de backend/Next/Flutter, migraciones, lint, typecheck o build: no se cambió código y el alcance sigue siendo diagnóstico/planificación. La suite completa fallida recuperada antes permanece documentada en el plan y no se convierte en PASS por estas sondas.

## Orden propuesto, riesgos y rollback

1. Una vez autorizado el bloque, corregir D-01 únicamente en la automatización y añadir su regresión. Mantener visible el fallo D-02.
2. Corregir D-02 en la capa decorativa compartida, con prueba de reflow y smoke de foco/overlays. No modificar lógica de sesión ni formularios.
3. Ejecutar el runner original actualizado y los gates del bloque 1. Completar comparación de pantallas Flutter/Next y continuar los bloques del plan solo con evidencia satisfactoria.

Riesgos: una corrección global de overflow puede ocultar menús/foco o impedir scroll; un helper de teclado incorrecto puede simular éxito sin activar el control. Rollback futuro: revertir exclusivamente los cambios del runner/capa decorativa aislados de fases anteriores. El diagnóstico actual se desactiva omitiendo el plugin temporal; no modifica servicios persistentes ni añade migraciones.

**Código del repositorio: sin cambios en esta revisión. Tests nuevos del proyecto: ninguno. Migraciones/dependencias nuevas: ninguna. Artefactos: evidencia diagnóstica añadida y captura sintética del dashboard oscuro regenerada por la reproducción original. Sin commit.**

Lectores de pantalla, dispositivos físicos, comparación de pantallas completas Flutter/Next, texto ampliado y responsive de todos los consumidores siguen UNKNOWN. El diagnóstico dejó ambas correcciones pendientes; se cerraron posteriormente en su alcance autorizado con pruebas del runner original actualizado, sin plugin/sondas. **No se cierra Fase5B ni se declara preparación productiva.**
