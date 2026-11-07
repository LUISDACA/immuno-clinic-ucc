# Tokens visuales — referencia para el plan de Fase 5B

Fecha: 2026-10-09. **Inventario documental actualizado al árbol actual.** Las dos correcciones autorizadas y el gate integrado pasan según [phase5b-implementation.md](../audits/phase5b-implementation.md); la paridad integral de temas/pantallas sigue pendiente. Véase [phase5b-plan.md](../audits/phase5b-plan.md).

Fuentes: `frontend/lib/core/theme/app_theme.dart` (`AppColors` y `AppTheme`), `frontend-next/src/app/globals.css` y componentes `ui/button.tsx`, `ui/input.tsx`, `ui/card.tsx`, `ui/badge.tsx`, `ui/alert.tsx`. Flutter aporta la referencia visual inicial; FastAPI conserva exclusivamente estados, permisos y señales de dominio.

Los valores siguientes se extrajeron del código actual. No constituyen una nueva identidad institucional ni acreditan contraste renderizado. El plan de aplicación está en [phase5b-plan.md](../audits/phase5b-plan.md).

## Colores semánticos existentes

| Uso | Flutter | Next | Claro | Oscuro |
|---|---|---|---|---|
| Fondo | background / darkBackground | --background | #F6FAFA | #071416 |
| Superficie | surface / darkSurface | --card | #FFFFFF | #0E2023 |
| Superficie secundaria | surfaceVariant / darkSurfaceVariant | --surface-variant | #EFF7F7 | #142D31 |
| Texto principal | textPrimary / darkTextPrimary | --foreground | #172629 | #EAF7F7 |
| Texto secundario | textSecondary / darkTextSecondary | --muted-foreground | #647478 | #A8BFC2 |
| Primario de tema | primary / primaryLight | --primary | #00AFC6 | #45D2DF |
| Primario oscuro de marca | primaryDark | --primary-dark | #007F93 | #007F93 |
| Acento | accent | --accent | #79C143 | #79C143 |
| Borde | border / darkBorder | --border, --input | #C7DADA | #2D4F55 |
| Divisor | divider / darkDivider | --divider | #DDEAEA | #244247 |

Los fondos suaves de estado de Next sí varían por tema:

| Uso | Color de estado existente | Fondo claro Next | Fondo oscuro Next |
|---|---|---|---|
| Éxito | #5FAE36 | #EAF6E4 | #11341A |
| Advertencia | #E6A700 | #FFF6D6 | #3D2C00 |
| Error | #C94242 | #FFECEC | #3A1313 |
| Información | #008FA3 | #E2F7FA | #103237 |

Flutter define colores suaves de estado como constantes claras; no se supone que equivalgan automáticamente a una superficie oscura. En el árbol actual Badge y Alert Next consumen variables semánticas; el catálogo aún contiene colores Tailwind y clases `dark:`. La corrección parcial no demuestra consistencia global, ni cambia la relación estado→etiqueta o el dominio.

Los estados deben conservar texto/indicador además del color. No convertir colores o iconos en criterios clínicos. El token de texto sobre un fondo de estado debe elegirse después de medir su combinación real; conservar un color de marca no exige usarlo como texto pequeño sobre cualquier fondo.

## Tipografía, espacio y componentes

| Elemento | Referencia actual | Criterio propuesto |
|---|---|---|
| Familia | Flutter GoogleFonts.inter; Next Inter con pesos 400/500/600/700/800 | Mantener Inter y jerarquía equivalente. No incorporar una familia nueva. |
| Código/identificador | Next Geist Mono en --font-geist-mono | Conservar su uso específico; no imponerlo a Flutter. |
| Título de AppBar Flutter | 18, peso 700 | Referencia de jerarquía, no tamaño obligatorio para cada h1 web. |
| Botón Flutter | Texto 15, peso 700, padding horizontal24/vertical14, radio12 | Conservar capacidad táctil/legibilidad; comparar con Button Next antes de ajustar. |
| Input Next | h-11, rounded-xl, focus-visible, disabled | Mantener geometría salvo defecto demostrado con zoom/teclado. |
| Radios | Flutter botones/campos/cards12, chips8; Next --radius .75rem y radios propios de componentes | Documentar diferencias: .75rem equivale a12px cuando raíz=16px; no unificar todo mediante reemplazo masivo. |
| Espacio | Valores habituales Flutter8/12/16/24; Next gap/padding por componente | Mantener agrupación y lectura. No copiar dimensiones de móvil a escritorio. |
| Sombras | Flutter cards elevation0; Next Card shadow-sm | Diferencia de plataforma existente. Cambiar solo si la comparación justifica una corrección. |

Los botones principales difieren entre plataformas: Flutter usa primaryDark y blanco en oscuro; el Button Next actual consume --action/--action-foreground. **No copiar automáticamente combinaciones entre plataformas**. Comprobar contraste, intención visual y estados disabled/focus/hover.

## Tokens adicionales encontrados, pendientes de cierre

| Token Next | Claro | Oscuro / system oscuro |
|---|---|---|
| --action | #007F93 | #45D2DF |
| --action-foreground | #FFFFFF | #071416 |
| --interactive-foreground | #006575 | #45D2DF |
| --accent-action-foreground | #172629 | #071416 |
| --success-text | #2F6418 | #A7DA64 |
| --warning-text | #715100 | #E6A700 |
| --destructive-text | #8D2525 | #FFAAAA |
| --info-text | #006575 | #45D2DF |

No sustituyen los colores de marca de la primera tabla. `color-scheme` también está presente para controles nativos. Su existencia en código no implica aprobación del bloque ni conformidad general de accesibilidad.

El artefacto final [measurements.json](evidence/phase5b/shared-theme/measurements.json), generado por el runner corregido que pasa sobre webpack final, registra contraste de acción principal de4,71:1 en claro y10,29:1 en oscuro, badge de advertencia6,74:1/6,35:1 y alerta de error clara7,62:1. [palette-comparison.json](evidence/phase5b/shared-theme/palette-comparison.json) confirma32 coincidencias entre8 AppColors y4 combinaciones de tema/SO. Son mediciones acotadas; no acreditan todos los componentes, texto ampliado ni lector de pantalla.

## Tema y aplicación propuesta

1. Mantener preferencia `system`, `light`, `dark`, persistencia existente `ic_theme` y autoridad de representación por plataforma.
2. En Next, usar variables semánticas existentes en los componentes intervenidos. Reemplazar fondos/textos oscuros literales y variantes `dark:` que no sigan la preferencia manual por combinaciones que consuman esas variables.
3. Evitar alterar globalmente variantes Tailwind antes de conocer todos sus consumidores, especialmente páginas excluidas del alcance.
4. Conservar paleta e intención de estado. Documentar cualquier nuevo token de primer plano accesible y su medición antes de introducirlo.
5. En Flutter, consumir ThemeData/ColorScheme en superficies y texto cuando se demuestre una excepción; no recolorear por lote ni copiar estilos web.

## Evidencia pendiente

- Contraste global, composición con transparencias, foco y tipografía: **UNKNOWN** fuera de las mediciones acotadas descritas; requiere render y medición del build final.
- Paridad de pantallas Flutter/Next, lector de pantalla y texto ampliado: **UNKNOWN**. Las imágenes Flutter disponibles son muestras de AppColors, no pantallas completas.
- Gate de navegador después de las dos correcciones autorizadas: **PASS**. El [diagnóstico](../audits/phase5b-theme-diagnosis.md) conserva los FAILED anteriores; la [implementación](../audits/phase5b-implementation.md) separa el cierre acotado de las pantallas/estados pendientes. Reflow probado en login a320/390/768/1440 y scroll vertical; no se extrapola a todo el producto.
- Identidad gráfica oficial distinta de los tokens existentes: **UNKNOWN**; no se necesita inventarla para corregir UI-14/UI-15.
- Este inventario no modifica tokens, dependencias, backend, contratos ni reglas clínicas.

## Consumo verificado en detalle y esquema — bloque2

Los tres consumidores corregidos (detalle administrativo, AdminDoseRow y esquema estudiante) utilizan los tokens existentes; no se crean colores ni estados clínicos. [Mediciones reales](evidence/phase5b/detail-scheme/measurements.json): título claro/oscuro15,61/15,32; texto EN REVISIÓN sobre tarjeta7,29/7,92; comentario info6,07/7,52; acción aprobar6,36/8,40 y denegar7,62/9,03. Estas cifras corresponden al render normal y confirmaciones de fixtures sintéticos, no a todos los hover/disabled ni a todos los datos. Preferencia manual opuesta al SO y reflow de ambas pantallas320/390/768/1440 pasan en Chrome. La comparación de pantallas Flutter completas y lectores permanece UNKNOWN.

## Consumo verificado en catálogo y diálogos — bloque3

Editor, confirmación y chips consumen los mismos tokens existentes; se eliminan los literales oscuros y variantes dark: del catálogo, sin cambiar variables globales. [Mediciones](evidence/phase5b/catalog-dialog/measurements.json): editor/input claro/oscuro15,61/15,32; chip seleccionado6,09/7,59 (después de la transición y componiendo su fondo alpha sobre card); advertencia6,74/6,35; error oscuro9,27. Los datos incluyen colores CSS, fondo efectivo, modalidad y medidas reales del diálogo en320/390/768/1440. Hover/disabled integral, otros motores, lectores y pantalla Flutter completa permanecen UNKNOWN.


## Muestra de notificaciones Flutter — bloque5, 2026-10-10

El texto del estado vacío dejó de fijar AppColors.textSecondary y usa
ColorScheme.onSurfaceVariant del AppTheme actual. Medición de widget real:
claro #3F484A sobre #F6FAFA =8,93; oscuro #BFC8CA sobre #071416 =11,00.
Antes, #647478 sobre oscuro daba3,85. No cambia la paleta institucional ni
ningún significado clínico. El texto de lectura se anuncia también por
Semantics; el icono de marcado tiene tooltip. [Comparación acotada](phase5b-parity-matrix.md#continuación--bloque5-primera-comparación-pareada-notificaciones).
