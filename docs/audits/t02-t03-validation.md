# Preparación para validar T-02 y T-03

Fecha: 2026-09-28
Estado: **T-02 = PARTIAL; T-03 = PARTIAL. Fase 3B permanece PARTIAL.**
Alcance: crear infraestructura repetible y pruebas sintéticas locales. No se utilizaron, conectaron ni incluyeron datos institucionales reales. Los resultados sintéticos demuestran comportamiento de la herramienta y del código bajo fixtures; no prueban conservación ni clasificación de registros institucionales.

## Qué se puede validar ahora

- La suite automatizada puede ejecutar las cinco causas de versionado: cambio de catálogo, regla, sexo, programa y campus.
- Puede comprobar que versiones before/after se agregan, que el snapshot v1 guardado no se modifica y que el snapshot posterior representa el perfil/catálogo vigente.
- Los fixtures incluyen dosis aplicadas, titulación, estado, revisión/fecha y un registro parcial para comprobar conservación en los escenarios aplicables.
- Un comparador offline acepta dos exports JSON con el formato documentado abajo. Detecta filas perdidas/agregadas, IDs duplicados o ausentes, cambios de campos/estado/fecha/revisión/asociación, claves de dosis duplicadas, referencias inexistentes o entre propietarios distintos y cambios en señales de elegibilidad.
- El comparador no abre conexiones de red/base de datos y no escribe los archivos de entrada. Su reporte no contiene valores clínicos ni IDs originales; usa códigos, conteos y fingerprints HMAC con sal aleatoria de un solo proceso.

## Qué requiere un dataset institucional autorizado

- Que snapshots de perfiles, catálogo y reglas reales conserven el histórico y representen la versión vigente con volumen/relaciones reales.
- Que la distribución real de dosis, titulaciones, revisiones, estados y fechas legacy esté completa en los exports.
- Que toda diferencia entre antes/después sea clasificada por el responsable institucional como transformación prevista o pérdida/inconsistencia. El comparador es intencionalmente estricto: no infiere equivalencias para `pending`, `uploaded`, `under_review` o `reviewed`.
- Evidencia de elegibilidad calculada por la versión backend autorizada y aprobada para el ensayo. No se define una fórmula adicional en este validador.
- Aprobación institucional del dataset, alcance, custodios, entorno aislado y política temporal de retención antes de ejecutar el ensayo real.

No se debe copiar un dataset real a los fixtures del repositorio. La validación futura deberá leer exports autorizados desde un entorno seguro, fuera del control de versiones, con IDs seudonimizados de manera controlada.

## Fixtures sintéticos

| Fixture/prueba | Escenarios representados | Uso |
|---|---|---|
| `backend/tests/fixtures/t02_profile_changes.json` | Cambios de sexo, programa y campus, con los valores sintéticos esperados | Parámetros de pruebas de reconciliación de perfil. |
| `test_admin_vaccine_catalog.py::test_catalog_changes_append_immutable_scheme_versions` | v1 → catálogo actualizado → v2 | Compara etiquetas/configuración y asignaciones activas; comprueba que el snapshot anterior y la fecha/estado de dosis aplicada se conservan. |
| `test_admin_vaccine_catalog.py::test_schedule_rule_change_versions_existing_student_schemes` | v1 → regla actualizada → v2 | Comprueba reglas anteriores/nuevas y activación de la regla vigente. |
| `test_admin_integration.py::test_each_profile_reconciliation_preserves_snapshot_and_clinical_history` | Sexo, programa y campus, cada uno como caso separado | Dosis fechada, titulación, estado, nota y reviewer sobreviven; snapshots before/after existen y la fila v1 se vuelve a leer intacta. |
| `backend/tests/fixtures/t03_legacy_before.json` y `t03_legacy_after.json` | Dosis antiguas, evidencia `uploaded`/`reviewed`, titulación, `pending`/`under_review`, fechas antiguas y bisiestas, campos parciales | Par sintético sin cambios para demostrar una comparación limpia; no representa datos de producción. |
| `test_legacy_dataset_validator.py` | pérdida, cambio de estado, fecha, reviewer, duplicados, asociaciones entre dueños y cambio de elegibilidad | Prueba códigos de hallazgo y que el reporte no filtre valores/IDs. |

## Invariantes T-02

1. Los registros de `StudentSchemeVersion` son append-only en los escenarios cubiertos; el snapshot v1 leído de nuevo debe ser idéntico al previo a la reconciliación.
2. La versión nueva debe mostrar el disparador de cambio y el perfil o regla/catálogo vigente.
3. En modificaciones de catálogo, las referencias de dosis del snapshot nuevo deben coincidir con las configuraciones activas del catálogo en ese punto; las filas retiradas se archivan, no se borran.
4. Los datos previos de dosis/titulación y metadatos de revisión se comparan por identidad estable; no se reinterpretan ni se sobrescriben en el snapshot histórico.
5. Sexo, programa y campus se ejercitan separadamente para que un caso combinado no oculte la ausencia de un disparador individual.

Estas invariantes describen las pruebas de infraestructura sintética, no una aprobación clínica de las reconciliaciones en datos reales.

## Formato del comparador T-03

El CLI se ejecuta desde `backend/`:

```sh
.venv/bin/python scripts/validate_legacy_dataset.py BEFORE.json AFTER.json
```

Ambos archivos deben usar `format_version: 1` y contener `records` con listas opcionales de `assignments`, `doses`, `evidence` y `eligibility`. Cada fila necesita `id`; asociaciones usan IDs seudónimos estables, y dosis/evidencia incluyen `owner_id` para comprobar propiedad. El esquema mínimo recomendado:

```json
{
  "format_version": 1,
  "records": {
    "assignments": [{"id": "…", "owner_id": "…", "vaccine_code": "…", "status": "…"}],
    "doses": [{"id": "…", "owner_id": "…", "assignment_id": "…", "dose_number": 1, "status": "…", "applied_date": "YYYY-MM-DD", "reviewed_by": "…", "reviewed_at": "…"}],
    "evidence": [{"id": "…", "owner_id": "…", "status": "…", "dose_id": null, "reviewed_by": null, "reviewed_at": null}],
    "eligibility": [{"id": "…", "owner_id": "…", "is_up_to_date": false, "is_complete": false, "is_certifiable": false}]
  }
}
```

Los puntos suspensivos son valores de ejemplo de estructura, no valores que deban copiarse. El CLI termina con código 0 si no encuentra diferencias y 1 si el reporte tiene hallazgos. Un `RECORD_ADDED` también requiere revisión humana: puede ser una adición válida o duplicación/conversión inesperada. El comparador no decide cuáles diferencias son clínicamente aceptables.

## Algoritmo y detecciones

1. Valida la versión del formato y normaliza cada grupo por `id`; reporta ID ausente o duplicado.
2. Compara los conjuntos de IDs antes/después; reporta pérdida y adición.
3. Compara cada campo de IDs coincidentes, incluyendo presencia/nullability, y emite códigos específicos para estado, fecha de aplicación, reviewer, fecha de revisión, asociación y elegibilidad; valores no se incluyen en el reporte.
4. Busca dosis repetidas por (`owner_id`, `assignment_id`, `dose_number`).
5. Comprueba que las asignaciones de dosis existan y pertenezcan al mismo owner, y que una evidencia vinculada apunte a una dosis existente del mismo owner.
6. Devuelve conteos por grupo, `valid`, códigos de problema y fingerprints HMAC por ejecución. Nunca escribe ni modifica las entradas.

## Evidencia esperada para T-02/T-03

### Ensayo institucional futuro

- autorización del dataset y evidencia de que el export corresponde al corte anterior/posterior aprobado;
- manifiestos de conteos por tipo, generados por custodio, que concuerden con el reporte;
- ejecución reproducible del comparador en entorno aislado, con versiones/commit y salida sin PHI;
- triage firmado por responsables de dominio para cada diferencia: preservada, transformación expresamente autorizada o defecto pendiente;
- para T-02, muestras de auditoría de cada una de las cinco clases de cambio y confirmación de snapshot v1/historial retenido;
- para T-03, clasificación humana de cada valor legacy ambiguo; el validador no debe convertir `reviewed` a APROBADO ni asignar evidencias a dosis por heurística.

### Evidencia de infraestructura en esta preparación

- Casos sintéticos focalizados T-02/T-03: **14 passed**.
- Reconciliación sintética de sexo/programa/campus sobre PostgreSQL: **3 passed**.
- Suite completa backend sobre PostgreSQL local desechable y bases migratorias vacías: **348 passed, 7 warnings**; incluye migraciones, concurrencia y E2E.
- E2E clínico `tests/test_phase1_e2e.py` sobre PostgreSQL: **7 passed**.
- Smoke del CLI comparando los fixtures T-03: **PASS**, `valid: true`, 0 hallazgos y sin valores de filas en salida.
- Ruff check/format: **PASS**, 142 archivos verificados. `git diff --check`: **PASS** en la revisión final.

Esto no cambia T-02/T-03 a DONE. No se generó migración ni se conectaron bases con datos institucionales.

## Condiciones de cierre

- **T-02 permanece PARTIAL** hasta obtener evidencia autorizada de los cinco tipos de reconciliación sobre el dataset institucional aprobado, con histórico v1 intacto, estado/configuración nueva correcta, revisión de dosis/titulaciones conservadas y diferencias triageadas.
- **T-03 permanece PARTIAL** hasta ejecutar el comparador en exports institucionales autorizados, resolver cada hallazgo con decisión humana y demostrar que ninguna pérdida, mutación de estado/fecha/revisión, duplicado, asociación incorrecta o cambio inesperado de elegibilidad queda sin explicación aprobada.
- Los fixtures y tests sintéticos permanecen como arnés de regresión. Nunca cuentan por sí solos como validación institucional ni como cierre de Fase 3B.

No se modificaron reglas clínicas; no se implementaron PDF, QR, Maps ni Azure. No se hizo commit.
