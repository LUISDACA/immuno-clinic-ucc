# Decisiones definitivas de dominio clínico

Estado: **DECIDIDO** para las reglas de esta fase. FastAPI es autoridad de dominio. Este documento registra literalmente las decisiones aprobadas para Fase 3B; los clientes solo representan resultados contractuales.

## Predicados del esquema

- **AL DÍA** significa que se han cumplido todas las dosis que le corresponden al estudiante hasta la fecha de evaluación. Las dosis futuras que todavía no corresponden no bloquean este estado.
- **COMPLETO** significa que todos los requerimientos de todas las vacunas están cubiertos.
- Una **titulación válida** cubre todos los requerimientos de esa vacuna; para esa vacuna no hacen falta las dosis correspondientes.
- **CERTIFICABLE** se calcula exclusivamente en backend. Un estudiante puede estar al día, tener el esquema incompleto y ser certificable. Las dosis futuras que aún no corresponden no bloquean certificabilidad. Cualquier dosis DENEGADA bloquea certificabilidad. Una titulación válida puede satisfacer por completo una vacuna.
- Flutter y Next no calculan elegibilidad, completitud, estado al día, validez de titulación ni vencimientos clínicos.

## Estados y revisión

Los estados clínicos oficiales son **EN REVISIÓN**, **APROBADO** y **DENEGADO**. En reportes, EN REVISIÓN puede agruparse/representarse funcionalmente como `PENDING`, pero `PENDING` no es un estado clínico adicional ni un valor nuevo del enum de dominio.

El administrador normal realiza la revisión y puede cambiar los estados correspondientes conforme a los permisos existentes. Cuando un estudiante edita una dosis DENEGADA, su estado pasa a EN REVISIÓN; editar nunca la aprueba automáticamente.

Cuando el administrador aprueba evidencia asociada a una dosis, evidencia EN REVISIÓN pasa a APROBADA y la dosis asociada pasa a APROBADA dentro de la misma transacción. Si una escritura falla, ambas se revierten. Evidencia DENEGADA no produce una dosis APROBADA. La asociación a dosis es opcional para conservar el flujo general de evidencia.

## Fechas y vencimientos

- Todas las fechas clínicas son fechas de calendario `YYYY-MM-DD`; no son instantes UTC.
- La zona institucional para determinar la fecha actual es `America/Bogota`.
- Una fecha de vencimiento permanece válida durante todo ese día. Se considera vencida desde el día calendario siguiente.
- No se permite registrar una aplicación futura: `application_date` debe ser menor o igual a la fecha actual en `America/Bogota`.
- Las aplicaciones pasadas no tienen límite de antigüedad en esta fase.
- Vacuna anual: `Vaccine.is_annual = true`; no se agrega `DoseType.annual`. Vence en el aniversario calendario de aplicación y ese día sigue siendo válido. El día siguiente está vencida.
- Si la aplicación anual ocurre el 29/02, vence el 28/02 del año siguiente cuando no es bisiesto; si sí es bisiesto, vence el 29/02. No se crean fechas calendario inválidas.

## Versiones e historial

- Cada cambio de catálogo o de reglas crea una nueva versión del esquema.
- Cambios de sexo/género permitidos por un administrador autorizado, de programa o de campus crean una nueva versión/reconciliación.
- Estudiantes no pueden modificar sexo/género.
- Los cambios nunca destruyen el historial del esquema, dosis, evidencias o revisiones.

## Offline

Flutter puede mostrar información de esquema cacheada y potencialmente desactualizada. Debe mostrar exactamente **“Información no verificada por falta de conexión.”** y no presentarla como validada actualmente por backend.

## Contratos transversales

Paginación canónica:

```json
{
  "page": 1,
  "page_size": 20,
  "total": 200,
  "total_pages": 10,
  "has_next": true,
  "has_previous": false,
  "items": []
}
```

Error canónico:

```json
{
  "code": "CERTIFICATE_NOT_ELIGIBLE",
  "message": "No es posible emitir el certificado.",
  "details": {}
}
```

`details` es opcional; mensajes/detalles no deben incluir PII o datos clínicos innecesarios. Se conservan status HTTP. Next debe reflejar los enums backend sin `Gender.other`, `ConversationStatus.archived` ni `DoseType.annual`; anualidad pertenece a `Vaccine.is_annual`.

## Fuera de alcance o aún pendiente

Esta decisión no autoriza cambios en Azure, mapas, PDF/QR, autenticación ajena a los flujos requeridos ni reglas clínicas distintas. No define si la revisión de lote de evidencias cambia el estado de una dosis. Esa integración permanece pendiente y no se debe inferir.
