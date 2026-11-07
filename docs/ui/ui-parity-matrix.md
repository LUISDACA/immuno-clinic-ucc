# Paridad Flutter / Next — alcance de Fase 1

Esta matriz registra los estados afectados por contención y reconstrucción.
No constituye una auditoría visual completa ni un rediseño. La API sigue
siendo la fuente de verdad de reglas clínicas y permisos.

| Pantalla / estado | Flutter | Next | Verificación |
|---|---|---|---|
| Alta de estudiante | Texto actualizado: acceso por correo y cambio temporal obligatorio | Alta consume el mismo contrato sin derivar contraseña del documento | E2E API con PostgreSQL y SMTP local: alta, contraseña recibida, login, bloqueo y cambio obligatorio. Entrega externa UNKNOWN. |
| Perfil administrativo | Alcance sujeto al control central API | Programa/sede ya mostrados como administrados por la institución | Backend rechaza cambio de alcance propio; contacto permitido. |
| Login y restauración | Flujo existente conservado | Módulos faltantes implementados; identidad desde `/users/me` | Pruebas Next y autenticación backend. E2E móvil/web conjunto UNKNOWN. |
| Sesión cargando/no autenticada | Flujo existente | Contenido protegido oculto y redirección a login | Tests de sesión y gate. Comparación de capturas UNKNOWN. |
| Rol insuficiente | Autorización de la API | Contenido no se monta durante redirección | Test componente Next y controles backend. |
| Cambio obligatorio de contraseña | Flujo existente | Impide mostrar páginas normales; permite pantalla de cambio | Test de gate y estado de autenticación. |
| Dosis APPROVED | Acciones ocultas por `_canEditDoseDate` | Acciones ocultas por `editable` | E2E API y bloqueo concurrente PostgreSQL: edición devuelve 409; revisión por admin/app_admin y permisos verificados. |
| Dosis reabierta IN_REVIEW | Acciones de edición existentes | Acciones de edición existentes | Test de transición administrativa y posterior edición. |
| Fechas de dosis/nacimiento/vencimiento | Formato de fecha existente conservado | `YYYY-MM-DD` se presenta sin desplazamiento de zona; selector usa fecha local | Pruebas de calendario, zonas y límites de día. Capturas UNKNOWN. |
| Tema claro/oscuro/sistema | Tema existente sin cambios | Restauración compatible con `ic_theme` y CSS existentes | Tests de persistencia y preferencia corrupta; sin cambios de estilos. |
| Catálogo retirado/reactivado | Recibe esquema activo de la API | Recibe esquema activo de la API | Tests conservan ID, aprobación y notas al archivar/reactivar. |

Actualización de cierre: Flutter 3.44.9 pasa analyze y 30 tests. Se corrigió
la resolución de `CupertinoPageTransitionsBuilder` a través de
`PageTransitionsTheme().builders`, conservando Cupertino en iOS/macOS y
FadeUpwards en Android/Windows/Linux. El test `app_theme_test.dart` verifica
ambos temas. La interfaz y esos defaults se comprobaron también en el código
del tag local 3.41.6, sin ejecutar un segundo SDK completo.

El flujo login → esquema → evidencia → revisión → certificado está ejecutado
a nivel HTTP/API sobre PostgreSQL para admin y app_admin. Las capturas,
comparación visual y navegación real conjunta en dispositivo/navegador siguen
**UNKNOWN**. No se introdujeron tokens de diseño nuevos ni cambios cosméticos.
