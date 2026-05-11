# Contributing to ImmunoClinic

## Convenciones de Código

### Backend (Python)

- **Formateo**: Seguir PEP 8 con líneas de máximo 100 caracteres.
- **Tipos**: Usar type hints en todas las funciones públicas.
- **Docstrings**: Obligatorios en clases y funciones públicas.
- **Imports**: Ordenados con `isort` (stdlib → third-party → local).
- **Logging**: Usar `logging.getLogger(__name__)`, nunca `print()`.
- **Excepciones**: Usar las excepciones definidas en `app/core/exceptions.py`.

### Frontend (Flutter/Dart)

- **Modelos**: Toda data de la API debe pasar por un modelo tipado (nunca `Map<String, dynamic>` en providers).
- **Providers**: Usar `StateNotifier` + `StateNotifierProvider` para estado mutable.
- **Pantallas**: Máximo ~500 líneas por archivo. Extraer widgets a archivos separados.
- **Nombres**: Archivos en `snake_case`, clases en `PascalCase`.

---

## Estructura de un Módulo Backend

Cada módulo en `app/modules/` debe tener:

```
module_name/
├── __init__.py
├── models.py      # Modelos SQLAlchemy (ORM)
├── schemas.py     # Schemas Pydantic (DTOs)
├── repository.py  # Acceso a datos (queries)
├── service.py     # Lógica de negocio
└── router.py      # Endpoints HTTP (sin lógica)
```

**Regla**: El router NUNCA debe contener lógica de negocio ni queries SQL directamente.

---

## Flujo de Branches

```
main ← develop ← feature/nombre-del-feature
```

1. Crear branch desde `develop`: `git checkout -b feature/mi-feature`
2. Hacer commits descriptivos en español
3. Abrir Pull Request hacia `develop`
4. Merge a `main` solo para releases

---

## Cómo Correr Tests

### Verificación completa local

Backend:

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests
ruff check app tests
ruff format --check app tests
```

Frontend:

```bash
cd frontend
flutter analyze
flutter test
```

> `pytest` debe ejecutarse contra `tests` para evitar que carpetas temporales locales
> entren en la recolección.

### Solo tests backend

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests/ -v
```

---

## Cómo Agregar un Nuevo Módulo

1. Crear directorio en `app/modules/nuevo_modulo/`
2. Crear `models.py`, `schemas.py`, `repository.py`, `service.py`, `router.py`
3. Registrar modelos en `app/db/models_registry.py`
4. Registrar router en `app/main.py`
5. Crear migración: `alembic revision --autogenerate -m "add nuevo_modulo"`
6. Agregar tests en `tests/test_nuevo_modulo.py`
