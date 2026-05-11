# ImmunoClinic v2.0

Sistema de gestión de esquemas de vacunación para estudiantes universitarios. Plataforma full-stack con backend API REST y aplicación móvil Flutter.

---

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 |
| **Base de datos** | PostgreSQL (producción), SQLite (tests) |
| **Frontend** | Flutter 3.x, Riverpod, Go Router, Dio |
| **Autenticación** | JWT (access + refresh tokens), bcrypt |
| **Notificaciones** | Firebase Cloud Messaging |
| **Despliegue** | Render (backend + PostgreSQL) |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                   Flutter App                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │   Auth   │  │  Student  │  │      Admin       │   │
│  │ Feature  │  │  Feature  │  │     Feature      │   │
│  └────┬─────┘  └────┬─────┘  └──────┬───────────┘   │
│       └──────────────┼───────────────┘               │
│                 Dio + JWT Interceptor                 │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS
┌─────────────────────┴───────────────────────────────┐
│                  FastAPI Backend                     │
│  ┌──────────────────────────────────────────────┐   │
│  │              Router Layer (HTTP)              │   │
│  ├──────────────────────────────────────────────┤   │
│  │            Service Layer (Business)           │   │
│  ├──────────────────────────────────────────────┤   │
│  │         Repository Layer (Data Access)        │   │
│  ├──────────────────────────────────────────────┤   │
│  │         SQLAlchemy Models + Pydantic          │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                                │
│              PostgreSQL (async)                      │
└─────────────────────────────────────────────────────┘
```

### Módulos Backend

| Módulo | Descripción |
|---|---|
| `auth` | Login, refresh tokens, forgot/reset password |
| `users` | Perfil de usuario, cambio de contraseña |
| `vaccines` | Catálogo parametrizable de vacunas |
| `vaccination_scheme` | Esquema de vacunación por estudiante, reglas de dominio |
| `evidence` | Carga y gestión de evidencia (PDFs) |
| `admin` | CRUD de estudiantes, revisión de dosis, estadísticas, importación Excel |
| `certificates` | Generación de certificados PDF |
| `notifications` | Notificaciones in-app + push (FCM), recordatorios automáticos |
| `communications` | Mensajería entre admin y estudiante |
| `audit` | Registro de acciones sensibles para trazabilidad |

---

## Setup Local

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL y SECRET_KEY

# Ejecutar migraciones
alembic upgrade head

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
flutter pub get
flutter run
```

### Variables de Entorno (.env)

| Variable | Descripción | Requerida |
|---|---|---|
| `DATABASE_URL` | URL de conexión PostgreSQL | ✅ |
| `SECRET_KEY` | Clave para firmar JWT access tokens | ✅ |
| `REFRESH_SECRET_KEY` | Clave para firmar JWT refresh tokens | ✅ |
| `DEBUG` | Modo debug (true/false) | No (default: false) |
| `CORS_ORIGINS` | Orígenes permitidos como JSON array | No |
| `ADMIN_EMAIL` | Email del admin semilla | No |
| `ADMIN_PASSWORD` | Password del admin semilla | No |
| `FCM_ENABLED` | Habilitar notificaciones push | No (default: false) |
| `FIREBASE_CREDENTIALS_JSON` | JSON de service account Firebase | Solo si FCM_ENABLED |

> ⚠️ **Seguridad**: Las SECRET_KEY deben ser aleatorias y fuertes en producción. El sistema rechazará claves inseguras cuando DEBUG=false.

---

## Reglas de Dominio — Vacunación

El sistema implementa las siguientes reglas de negocio:

1. **Asignación automática**: Al crear un estudiante, se asignan las 8 vacunas del catálogo con sus dosis según el sexo (ej: VPH solo para mujeres).

2. **Fechas de vencimiento calculadas**: Las dosis subsiguientes tienen fechas calculadas basadas en la dosis anterior:
   - Hepatitis B: 1ª → +1 mes → 2ª → +6 meses → 3ª
   - Hepatitis A: 1ª → +6 meses → 2ª
   - Varicela: 1ª → +1 mes → 2ª
   - Influenza: renovación anual

3. **Titulación como alternativa**: Si una vacuna permite titulación y el estudiante no tiene dosis aplicadas, una titulación aprobada cuenta como esquema completo.

4. **Cambio de sexo**: Si el admin cambia el sexo de un estudiante, el esquema se regenera preservando dosis ya aprobadas.

5. **Certificado**: Solo se genera cuando TODAS las vacunas están aprobadas (por dosis completas o titulación).

---

## Tests

```bash
cd backend

# Ejecutar todos los tests
python -m pytest tests/ -v

# Solo tests de seguridad
python -m pytest tests/test_security.py -v

# Solo tests de reglas de vacunación
python -m pytest tests/test_vaccination_rules.py -v

# Tests de integración
python -m pytest tests/test_auth_integration.py tests/test_admin_integration.py -v
```

---

## Despliegue

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para instrucciones de despliegue en Render.

---

## Licencia

Proyecto académico — Universidad Cooperativa de Colombia.
