"""Pure parsing helpers for student CSV/XLSX import — no I/O, no DB, no side-effects."""

from __future__ import annotations

import csv
import io
import re
import unicodedata
import zipfile
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree as ET

from app.common.enums import Gender
from app.modules.admin.schemas import CreateStudentRequest
from app.modules.vaccination_scheme.models import StudentVaccineDose

HEADER_ALIASES: dict[str, set[str]] = {
    "email": {
        "correo institucional",
        "correo electronico institucional",
        "correo electrónico institucional",
        "correo_institucional",
        "correo",
        "email",
        "mail",
        "mail institucional",
        "email institucional",
    },
    "document_number": {
        "cedula",
        "cédula",
        "numero de cedula",
        "número de cédula",
        "numero de cedula sin puntos",
        "número de cédula sin puntos",
        "documento",
        "numero documento",
        "número documento",
        "numero de documento",
        "número de documento",
        "identificacion",
        "identificación",
        "document_number",
    },
    "student_id": {
        "codigo",
        "código",
        "codigo estudiante",
        "código estudiante",
        "codigo estudiantil",
        "código estudiantil",
        "id estudiante",
        "id estudiantil",
        "id institucional",
        "matricula",
        "matrícula",
        "student_id",
    },
    "first_name": {"nombre", "nombres", "primer nombre", "first_name"},
    "last_name": {
        "apellido",
        "apellidos",
        "apellido completo",
        "apellidos completos",
        "last_name",
    },
    "full_name": {
        "nombre completo",
        "nombres completos",
        "estudiante",
        "nombre estudiante",
        "alumno",
    },
    "birth_date": {
        "fecha nacimiento",
        "fecha de nacimiento",
        "nacimiento",
        "birth_date",
    },
    "sex": {"sexo", "genero", "género", "sex"},
    "phone": {
        "telefono",
        "teléfono",
        "celular",
        "numero de celular",
        "número de celular",
        "phone",
    },
    "eps_affiliation": {
        "eps",
        "eps afiliacion",
        "eps afiliación",
        "eps a la que se encuentra afiliado",
    },
    "emergency_contact_name": {
        "contacto emergencia",
        "contacto de emergencia",
        "nombre contacto emergencia",
        "escriba el nombre de contacto de emergencia",
    },
    "emergency_contact_phone": {
        "telefono emergencia",
        "teléfono emergencia",
        "telefono contacto emergencia",
        "teléfono contacto emergencia",
        "numero de telefono de contacto de emergencia",
        "número de teléfono de contacto de emergencia",
    },
    "program": {
        "programa",
        "carrera",
        "titulacion",
        "titulación",
        "program",
    },
    "campus": {"campus", "sede", "sede campus"},
    "semester": {"semestre", "semester"},
}


def _normalize_header(value: object) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


NORMALIZED_HEADER_ALIASES: dict[str, set[str]] = {
    field: {_normalize_header(alias) for alias in aliases}
    for field, aliases in HEADER_ALIASES.items()
}


def field_for_header(header: object) -> str | None:
    normalized = _normalize_header(header)
    if not normalized:
        return None
    for field, aliases in NORMALIZED_HEADER_ALIASES.items():
        if normalized in aliases:
            return field
    return None


_EMPTY_NORMALIZED: frozenset[str] = frozenset(
    _normalize_header(v) for v in ("no aplica", "n/a", "na", "sin registro", "no hay registro")
)


def is_empty_cell(value: object) -> bool:
    text = clean_cell(value)
    if text is None:
        return True
    return _normalize_header(text) in _EMPTY_NORMALIZED


def clean_cell(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
    elif isinstance(value, float) and value.is_integer():
        text = str(int(value))
    else:
        text = str(value).strip()
    return text or None


def parse_int(value: object) -> int | None:
    text = clean_cell(value)
    if text is None:
        return None
    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else None


def parse_gender(value: object) -> Gender:
    text = _normalize_header(value)
    if text in {"m", "masculino", "h", "hombre", "male"}:
        return Gender.MALE
    if text in {"f", "femenino", "mujer", "female"}:
        return Gender.FEMALE
    raise ValueError("Sexo inválido. Usa Masculino/Femenino, M/F o male/female.")


def parse_date(value: object) -> date | None:
    text = clean_cell(value)
    if text is None:
        return None
    try:
        serial = Decimal(text.replace(",", "."))
        if serial > 0:
            # Excel's 1900 date system includes a historical leap-year bug.
            return date(1899, 12, 30) + timedelta(days=int(serial))
    except (InvalidOperation, ValueError):
        pass

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Fecha inválida: {text}")


def split_full_name(full_name: str) -> tuple[str, str]:
    parts = [part for part in full_name.split() if part]
    if len(parts) <= 1:
        return full_name, "."
    if len(parts) == 2:
        return parts[0], parts[1]
    return " ".join(parts[:2]), " ".join(parts[2:])


def dose_header_kind(header: object) -> str:
    normalized = _normalize_header(header)
    has_titer = any(
        word in normalized for word in ("titul", "titulo", "titer", "anticuerpo", "anticuerpos")
    )
    has_value = any(
        word in normalized for word in ("valor", "numero", "resultado", "value", "nivel")
    )
    if has_titer and has_value:
        return "titer_value"
    return "applied_date"


def dose_header_match_key(header: object) -> str:
    normalized = _normalize_header(header)
    for word in (
        "fecha",
        "aplicacion",
        "aplicada",
        "aplicado",
        "valor",
        "numero",
        "resultado",
        "value",
        "nivel",
        "vacuna",
        "dosis",
        "de",
        "del",
        "la",
        "el",
    ):
        normalized = re.sub(rf"\b{word}\b", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def _dose_tokens(value: str) -> set[str]:
    aliases = {
        "primer": "primera",
        "primero": "primera",
        "segundo": "segunda",
        "tercer": "tercera",
        "tercero": "tercera",
        "cuarto": "cuarta",
        "quinto": "quinta",
    }
    return {
        aliases.get(token, token)
        for token in dose_header_match_key(value).split()
        if token and token not in {"si", "lo", "tiene", "solo", "mujeres", "no", "debe"}
    }


def dose_header_matches(header_key: str, candidate_key: str) -> bool:
    header_tokens = _dose_tokens(header_key)
    candidate_tokens = _dose_tokens(candidate_key)
    if not header_tokens or not candidate_tokens:
        return False
    return candidate_tokens.issubset(header_tokens) or header_tokens.issubset(candidate_tokens)


def imported_dose_ready_for_approval(dose: StudentVaccineDose) -> bool:
    if dose.applied_date is None:
        return False

    is_titer = bool(dose.dose_config and dose.dose_config.dose_type.value == "titer")
    if not is_titer:
        return True

    vaccine = dose.student_vaccine.vaccine if dose.student_vaccine else None
    requires_value = bool(vaccine and vaccine.has_titer_value)
    return not requires_value or clean_cell(dose.titer_value) is not None


def dose_candidate_keys(dose: StudentVaccineDose) -> list[str]:
    vaccine = dose.student_vaccine.vaccine if dose.student_vaccine else None
    config = dose.dose_config
    vaccine_names = [
        value
        for value in (
            vaccine.name if vaccine else None,
            vaccine.code if vaccine else None,
        )
        if value
    ]
    label = config.label if config else f"Dosis {dose.dose_number}"
    keys: list[str] = []
    for vaccine_name in vaccine_names:
        keys.extend(
            [
                _normalize_header(f"{vaccine_name} {label}"),
                _normalize_header(f"{vaccine_name} dosis {dose.dose_number}"),
                _normalize_header(f"{vaccine_name} {dose.dose_number}"),
            ]
        )
        if config and config.dose_type.value == "titer":
            keys.extend(
                [
                    _normalize_header(f"{vaccine_name} titul"),
                    _normalize_header(f"{vaccine_name} titulacion"),
                    _normalize_header(f"{vaccine_name} titulo"),
                    _normalize_header(f"{vaccine_name} titer"),
                ]
            )
    return sorted(set(keys), key=len, reverse=True)


def _column_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref.upper())
    if not letters:
        return 0
    index = 0
    for char in letters.group(0):
        index = index * 26 + (ord(char) - ord("A") + 1)
    return index - 1


def _read_shared_strings(root: ET.Element) -> list[str]:
    values: list[str] = []
    for item in root:
        texts = [node.text or "" for node in item.iter() if node.tag.endswith("}t")]
        values.append("".join(texts))
    return values


def read_xlsx_rows(content: bytes) -> list[list[object]]:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            shared_strings: list[str] = []
            if "xl/sharedStrings.xml" in archive.namelist():
                shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
                shared_strings = _read_shared_strings(shared_root)

            sheet_name = "xl/worksheets/sheet1.xml"
            if sheet_name not in archive.namelist():
                sheet_name = next(
                    name
                    for name in archive.namelist()
                    if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
                )
            root = ET.fromstring(archive.read(sheet_name))
    except (KeyError, StopIteration, zipfile.BadZipFile, ET.ParseError) as exc:
        raise ValueError("El archivo debe ser un .xlsx válido.") from exc

    rows: list[list[object]] = []
    for row in root.iter():
        if not row.tag.endswith("}row"):
            continue
        values: list[object] = []
        for cell in row:
            if not cell.tag.endswith("}c"):
                continue
            ref = cell.attrib.get("r", "")
            index = _column_index(ref)
            while len(values) <= index:
                values.append(None)

            cell_type = cell.attrib.get("t")
            raw_value = None
            for child in cell:
                if child.tag.endswith("}v"):
                    raw_value = child.text
                    break
                if child.tag.endswith("}is"):
                    raw_value = "".join(
                        node.text or "" for node in child.iter() if node.tag.endswith("}t")
                    )
                    break

            if raw_value is None:
                continue
            if cell_type == "s":
                value = shared_strings[int(raw_value)] if raw_value.isdigit() else raw_value
            else:
                value = raw_value
            values[index] = value
        if any(clean_cell(value) for value in values):
            rows.append(values)
    return rows


def read_csv_rows(content: bytes) -> list[list[object]]:
    text = content.decode("utf-8-sig")
    if not text.strip():
        return []
    sample = text[:2048]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;")
    except csv.Error:
        dialect = csv.excel
    return [list(row) for row in csv.reader(io.StringIO(text), dialect)]


def student_import_row_to_request(
    raw: dict[str, object],
) -> tuple[CreateStudentRequest, None]:
    email = clean_cell(raw.get("email"))
    document_number = clean_cell(raw.get("document_number"))
    if not email:
        raise ValueError("Falta el correo institucional")
    if not document_number:
        raise ValueError("Falta la cédula/documento")

    first_name = clean_cell(raw.get("first_name"))
    last_name = clean_cell(raw.get("last_name"))
    full_name = clean_cell(raw.get("full_name"))
    if (not first_name or not last_name) and full_name:
        split_first, split_last = split_full_name(full_name)
        first_name = first_name or split_first
        last_name = last_name or split_last
    if not first_name:
        raise ValueError("Falta el nombre")
    if not last_name:
        raise ValueError("Falta el apellido")

    return CreateStudentRequest(
        email=email,
        first_name=first_name,
        last_name=last_name,
        document_number=document_number,
        student_id=clean_cell(raw.get("student_id")),
        birth_date=parse_date(raw.get("birth_date")),
        sex=parse_gender(raw.get("sex")),
        phone=clean_cell(raw.get("phone")),
        eps_affiliation=clean_cell(raw.get("eps_affiliation")),
        emergency_contact_name=clean_cell(raw.get("emergency_contact_name")),
        emergency_contact_phone=clean_cell(raw.get("emergency_contact_phone")),
        program=clean_cell(raw.get("program")),
        campus=clean_cell(raw.get("campus")),
        semester=parse_int(raw.get("semester")),
    ), None
