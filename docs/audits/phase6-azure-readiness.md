# Fase 6 — preparación de Azure

## Alcance de este bloque

Preparación local y reversible de imágenes de contenedor para FastAPI y Next.js, más una verificación de la arquitectura actual. No se creó ningún recurso de Azure, no se configuraron secretos ni dominios y no se ejecutó un despliegue.

Fase 5B se mantiene en el estado documentado previamente; esta entrega no la cierra.
Fase 3B, incluidos T-02 y T-03, continúa PARTIAL. Este trabajo no valida datos institucionales ni declara el sistema listo para producción.

## Estado actual verificado

- El despliegue documentado y `render.yaml` usan Render, PostgreSQL administrado allí, storage S3 compatible, correo y Firebase.
- No existían Dockerfiles, configuración de Azure, IaC ni workflow de despliegue Azure.
- FastAPI requiere Python 3.12; el servicio Render usa dos workers y el engine PostgreSQL está configurado por proceso con pool 20 y overflow 10.
- La aplicación ejecuta seeds/sincronización del catálogo, limpieza de tokens y tareas en el `lifespan`. La limpieza de rate-limit corre por proceso; el recordatorio interno también puede correr por proceso. El endpoint protegido `/api/v1/notifications/cron/vaccine-reminders` permite usar un scheduler externo, pero antes de escalar debe ser el único disparador de recordatorios.
- Next.js es una aplicación Node.js con BFF dinámico, usa `pg` para sesiones y necesita `API_INTERNAL_URL`, `BFF_ORIGIN`, `BFF_DATABASE_URL` y `BFF_SESSION_KEY` en runtime. No es un sitio estático.
- Evidencias y certificados usan la abstracción de almacenamiento actual: local o S3. No existe aún adaptador privado para Azure Blob/Managed Identity.
- El health check `/` valida conectividad con la base de datos y responde 503 si no está disponible.
- No se detectaron `az`, Bicep ni Docker Compose. Docker está instalado, pero el usuario del entorno no tiene acceso al socket Docker, por lo que las imágenes aún no se pudieron construir localmente.
- La versión instalada de Node es 22 y CI fija Node 20; la imagen Next se alinea con CI. Next 16 requiere Node >=20.9.

## Arquitectura objetivo propuesta

```text
Flutter ────────────────┐
                        ├─ HTTPS → Azure Container Apps: FastAPI (ingress público)
Navegador → ACA: Next BFF┘                         │
                                                   ├─ PostgreSQL Flexible Server
                                                   ├─ Blob privado (Managed Identity)
                                                   ├─ Key Vault (secrets referenciados)
                                                   └─ Monitor / Log Analytics

GitHub Actions ─ OIDC ─ ACR ─ imágenes ─ ACA
Container Apps Job ─ recordatorios programados (UTC) ─ API protegida
```

La API sigue siendo la autoridad. La conexión de Next a FastAPI debe usar el nombre interno de la API cuando la topología de red elegida lo permita; clientes Flutter requieren una URL HTTPS pública estable. Blob debe permanecer privado y las descargas deben seguir pasando por autorización FastAPI. Las identidades administradas deben reemplazar claves de storage donde sea posible. Los secretos externos que no soportan identidad administrada permanecen en Key Vault.

La programación de Container Apps Jobs usa UTC; la tarea diaria debe calcular fechas clínicas con `America/Bogota` dentro de la aplicación y el horario del Job debe configurarse teniendo en cuenta el desfase institucional.

## Cambios locales de este bloque

- `backend/Dockerfile`: imagen Python 3.12, usuario sin privilegios, dependencias declaradas y arranque Gunicorn/Uvicorn con un worker.
- `backend/.dockerignore`: excluye entornos, archivos locales, datos, pruebas y posibles credenciales del contexto de imagen.
- `frontend-next/Dockerfile`: imagen multi-stage Node 20, build standalone, runtime no-root.
- `frontend-next/.dockerignore`: excluye entorno local, dependencias y artefactos de build del contexto.
- `frontend-next/next.config.ts`: habilita el output standalone requerido por la imagen Node.
- `.github/workflows/ci.yml`: compila ambas imágenes en CI sin publicarlas ni desplegarlas.

## Bloqueos y riesgos antes de desplegar

1. **Storage:** implementar y probar Azure Blob privado con Managed Identity; planear migración y reconciliación de objetos desde S3. No cambiar `STORAGE_TYPE` hasta tener pruebas de lectura/escritura/autorización y rollback.
2. **Startup:** separar seeds y sincronización del catálogo de cada arranque de API. Deben ser una operación explícita, idempotente y ejecutada una sola vez. Hasta entonces no habilitar despliegues con réplicas/revisiones simultáneas.
3. **Tareas:** deshabilitar el loop de recordatorios dentro de los workers y usar una sola tarea programada; comprobar idempotencia concurrente antes de programarla.
4. **Conexiones:** parametrizar/medir el pool SQLAlchemy y el pool `pg` de Next contra el máximo de conexiones del plan PostgreSQL y el máximo de réplicas. El valor actual podría multiplicarse por worker y réplica.
5. **Migraciones:** ejecutar Alembic como paso único previo al tráfico, con copia recuperable y prueba de restauración. No ejecutar migraciones automáticamente por cada réplica.
6. **Red/identidad:** faltan decisiones verificables sobre región/data residency, dominio, presupuesto, entornos y conectividad privada. No inventar esos valores ni abrir firewall al público por defecto.
7. **CI/CD:** añadir después autenticación GitHub→Azure mediante OIDC y permisos mínimos. No almacenar credenciales Azure duraderas en GitHub.
8. **Datos:** T-02/T-03 requieren validación institucional autorizada; por tanto, cualquier despliegue durante esta fase debe ser entorno de prueba con datos sintéticos.
9. **Operación:** faltan estrategia de backups/PITR, retención, alertas, runbook y procedimiento de rollback/cutover desde Render.

## Plan de bloques de Fase 6

| Bloque | Entregable | Gate |
|---|---|---|
| 6A | Imágenes de API y BFF reproducibles, build en CI | Ambas imágenes construyen y no incluyen secretos |
| 6B | Adaptador Azure Blob privado y pruebas con emulador/cuenta de prueba | Tests de upload/download/delete y autorización, sin endpoint público |
| 6C | Separar bootstrap y tareas periódicas de los workers | Pruebas de concurrencia/idempotencia y arranque en múltiples réplicas |
| 6D | IaC parametrizada para entorno no productivo (ACA, PostgreSQL, Storage, Key Vault, ACR, observabilidad) | Validación del template y revisión de red/coste antes de provisionar |
| 6E | Workflow CI/CD con OIDC, migración única, despliegue gradual y smoke tests | Aprobación humana y secretos externos configurados por el propietario |
| 6F | Ensayo de migración y cutover de staging desde Render | Backup restaurado, conteos/checksums reconciliados, rollback ensayado |
| 6G | Producción | Bloqueado por T-02/T-03, validación de almacenamiento real, decisiones institucionales y aprobación explícita |

## Verificación y estado

- Next: `npm test` **PASS** (582 passed, 3 skipped), `npm run lint` **PASS**, TypeScript `tsc --noEmit` **PASS**, `next build --webpack` **PASS**.
- Flutter: `flutter analyze --no-pub` **PASS**; `flutter test --no-pub` **PASS**.
- Backend: Ruff check **PASS** y format check **PASS**. Pytest en SQLite **PASS** (380 passed, 37 skipped; 7 warnings). No se ejecutó PostgreSQL real; el motivo individual de cada skip no se recopiló para esta ejecución.
- `docker build backend`: **BLOCKED**, socket Docker inaccesible para este usuario del entorno.
- `docker build frontend-next`: **BLOCKED**, misma causa; la compilación queda configurada como gate de CI.
- No se ejecutaron comandos `az`, despliegues, migraciones de datos ni llamadas a recursos externos.
- Estado Fase 6: **IN PROGRESS — 6A PREPARED, CONTAINER BUILDS NOT VERIFIED**.

## Rollback

Los cambios son aditivos. Revertir el bloque elimina los Dockerfiles, `.dockerignore`, el job de build y `output: standalone`; los servicios Render y artefactos actuales no cambian. No hay recursos Azure que revertir porque no se desplegó nada.
