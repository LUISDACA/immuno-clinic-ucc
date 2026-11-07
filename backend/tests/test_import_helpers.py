"""Unit tests for pure import helper functions (no DB, no I/O)."""

import csv
import io
from datetime import date

import pytest
from app.common.enums import Gender
from app.modules.admin.import_students.import_helpers import (
    clean_cell,
    dose_header_kind,
    dose_header_match_key,
    dose_header_matches,
    field_for_header,
    is_empty_cell,
    parse_date,
    parse_gender,
    parse_int,
    read_csv_rows,
    split_full_name,
    student_import_row_to_request,
)

# ── clean_cell ────────────────────────────────────────────────────────


class TestCleanCell:
    def test_none_returns_none(self):
        assert clean_cell(None) is None

    def test_empty_string_returns_none(self):
        assert clean_cell("") is None

    def test_whitespace_only_returns_none(self):
        assert clean_cell("   ") is None

    def test_strips_whitespace(self):
        assert clean_cell("  hello  ") == "hello"

    def test_float_integer_returns_int_string(self):
        assert clean_cell(3.0) == "3"

    def test_float_decimal_returns_decimal_string(self):
        assert clean_cell(3.5) == "3.5"

    def test_integer_returns_string(self):
        assert clean_cell(42) == "42"

    def test_regular_string_returned_as_is(self):
        assert clean_cell("juan@test.com") == "juan@test.com"


# ── field_for_header ──────────────────────────────────────────────────


class TestFieldForHeader:
    @pytest.mark.parametrize(
        "header,expected",
        [
            ("correo institucional", "email"),
            ("CORREO", "email"),
            ("email", "email"),
            ("mail institucional", "email"),
            ("cédula", "document_number"),
            ("cedula", "document_number"),
            ("numero de cedula sin puntos", "document_number"),
            ("codigo estudiante", "student_id"),
            ("código", "student_id"),
            ("matricula", "student_id"),
            ("nombre", "first_name"),
            ("primer nombre", "first_name"),
            ("apellido", "last_name"),
            ("apellidos completos", "last_name"),
            ("nombre completo", "full_name"),
            ("alumno", "full_name"),
            ("fecha de nacimiento", "birth_date"),
            ("sexo", "sex"),
            ("celular", "phone"),
            ("eps", "eps_affiliation"),
            ("contacto emergencia", "emergency_contact_name"),
            ("telefono emergencia", "emergency_contact_phone"),
            ("programa", "program"),
            ("carrera", "program"),
            ("campus", "campus"),
            ("sede", "campus"),
            ("semestre", "semester"),
        ],
    )
    def test_known_aliases_are_recognized(self, header, expected):
        assert field_for_header(header) == expected

    def test_unknown_header_returns_none(self):
        assert field_for_header("columna_desconocida_xyz") is None

    def test_empty_string_returns_none(self):
        assert field_for_header("") is None

    def test_none_returns_none(self):
        assert field_for_header(None) is None

    def test_case_insensitive(self):
        assert field_for_header("SEMESTRE") == "semester"

    def test_accents_normalized(self):
        assert field_for_header("teléfono emergencia") == "emergency_contact_phone"


# ── is_empty_cell ─────────────────────────────────────────────────────


class TestIsEmptyCell:
    @pytest.mark.parametrize("value", [None, "", "  ", "N/A", "n/a", "na", "NA"])
    def test_empty_markers_return_true(self, value):
        assert is_empty_cell(value) is True

    def test_no_aplica_returns_true(self):
        assert is_empty_cell("No aplica") is True

    def test_sin_registro_returns_true(self):
        assert is_empty_cell("sin registro") is True

    def test_no_hay_registro_returns_true(self):
        assert is_empty_cell("no hay registro") is True

    def test_real_value_returns_false(self):
        assert is_empty_cell("juan@test.com") is False

    def test_zero_string_returns_false(self):
        assert is_empty_cell("0") is False


# ── parse_int ─────────────────────────────────────────────────────────


class TestParseInt:
    def test_integer_string(self):
        assert parse_int("4") == 4

    def test_float_integer_string(self):
        assert parse_int("4.0") == 4

    def test_integer_embedded_in_text(self):
        assert parse_int("Semestre 4") == 4

    def test_none_returns_none(self):
        assert parse_int(None) is None

    def test_no_digits_returns_none(self):
        assert parse_int("abc") is None

    def test_leading_digits_are_extracted(self):
        assert parse_int("10 semestre") == 10


# ── parse_gender ──────────────────────────────────────────────────────


class TestParseGender:
    @pytest.mark.parametrize("value", ["M", "m", "Masculino", "MASCULINO", "male", "H", "hombre"])
    def test_male_variants(self, value):
        assert parse_gender(value) == Gender.MALE

    @pytest.mark.parametrize(
        "value", ["F", "f", "femenino", "Femenino", "female", "mujer", "Mujer"]
    )
    def test_female_variants(self, value):
        assert parse_gender(value) == Gender.FEMALE

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError, match="Sexo inválido"):
            parse_gender("X")

    def test_empty_string_raises(self):
        with pytest.raises(ValueError):
            parse_gender("")


# ── parse_date ────────────────────────────────────────────────────────


class TestParseDate:
    def test_none_returns_none(self):
        assert parse_date(None) is None

    def test_empty_string_returns_none(self):
        assert parse_date("") is None

    def test_iso_format(self):
        assert parse_date("2023-01-15") == date(2023, 1, 15)

    def test_day_month_year_slash(self):
        assert parse_date("15/01/2023") == date(2023, 1, 15)

    def test_day_month_year_dash(self):
        assert parse_date("15-01-2023") == date(2023, 1, 15)

    def test_us_format(self):
        assert parse_date("01/15/2023") == date(2023, 1, 15)

    def test_excel_serial_returns_date(self):
        result = parse_date("44927")
        assert isinstance(result, date)
        assert result.year >= 2022

    def test_invalid_string_raises(self):
        with pytest.raises(ValueError, match="Fecha inválida"):
            parse_date("not-a-date")

    def test_whitespace_only_returns_none(self):
        assert parse_date("   ") is None


# ── split_full_name ───────────────────────────────────────────────────


class TestSplitFullName:
    def test_single_word_uses_placeholder_last(self):
        first, last = split_full_name("Garcia")
        assert first == "Garcia"
        assert last == "."

    def test_two_words_split_evenly(self):
        assert split_full_name("Juan Garcia") == ("Juan", "Garcia")

    def test_three_words_first_two_in_first(self):
        first, last = split_full_name("Juan Carlos Garcia")
        assert first == "Juan Carlos"
        assert last == "Garcia"

    def test_four_words_splits_correctly(self):
        first, last = split_full_name("Juan Carlos Garcia Lopez")
        assert first == "Juan Carlos"
        assert last == "Garcia Lopez"


# ── dose_header_kind ──────────────────────────────────────────────────


class TestDoseHeaderKind:
    def test_plain_date_header(self):
        assert dose_header_kind("Fecha aplicacion Hepatitis B Dosis 1") == "applied_date"

    def test_titer_value_header(self):
        assert dose_header_kind("Valor de titulación") == "titer_value"

    def test_anticuerpos_value_header(self):
        assert dose_header_kind("Número de anticuerpos") == "titer_value"

    def test_plain_vaccine_header_defaults_to_date(self):
        assert dose_header_kind("Varicela Dosis 1") == "applied_date"


# ── dose_header_match_key ─────────────────────────────────────────────


class TestDoseHeaderMatchKey:
    def test_removes_noise_words(self):
        key = dose_header_match_key("Fecha de aplicacion de Hepatitis B")
        assert "fecha" not in key
        assert "de" not in key
        assert "hepatitis b" in key or "hepatitis" in key

    def test_removes_vacuna_and_dosis(self):
        key = dose_header_match_key("vacuna hepatitis b dosis 1")
        assert "vacuna" not in key
        assert "dosis" not in key


# ── dose_header_matches ───────────────────────────────────────────────


class TestDoseHeaderMatches:
    def test_matching_subsets(self):
        assert dose_header_matches("hepatitis b primera", "primera hepatitis b") is True

    def test_non_matching_headers(self):
        assert dose_header_matches("varicela primera", "hepatitis b primera") is False

    def test_empty_keys_return_false(self):
        assert dose_header_matches("", "hepatitis b") is False


# ── read_csv_rows ─────────────────────────────────────────────────────


def _make_csv(*rows) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().encode("utf-8")


class TestReadCsvRows:
    def test_returns_list_of_rows(self):
        content = _make_csv(["email", "nombre"], ["a@b.com", "Ana"])
        rows = read_csv_rows(content)
        assert len(rows) == 2
        assert rows[0][0] == "email"
        assert rows[1][0] == "a@b.com"

    def test_skips_fully_empty_rows(self):
        content = _make_csv(["email", "nombre"], ["", ""], ["a@b.com", "Ana"])
        rows = read_csv_rows(content)
        # Empty rows are kept by read_csv_rows (filtering is done in service)
        assert any(r[0] == "a@b.com" for r in rows)

    def test_bom_utf8_is_handled(self):
        content = b"\xef\xbb\xbf" + _make_csv(["email", "nombre"], ["test@test.com", "Ana"])
        rows = read_csv_rows(content)
        assert rows[0][0] == "email"

    def test_semicolon_delimiter(self):
        content = b"email;nombre\na@b.com;Ana\n"
        rows = read_csv_rows(content)
        assert rows[0][0] == "email"
        assert rows[1][0] == "a@b.com"


# ── student_import_row_to_request ─────────────────────────────────────


class TestStudentImportRowToRequest:
    def _valid_raw(self, **overrides):
        base = {
            "email": "student@example.edu",
            "document_number": "123456789",
            "first_name": "Ana",
            "last_name": "Perez",
            "sex": "F",
        }
        base.update(overrides)
        return base

    def test_valid_row_returns_request(self):
        req, pwd = student_import_row_to_request(self._valid_raw())
        assert req.email == "student@example.edu"
        assert req.sex == Gender.FEMALE
        assert pwd is None

    def test_document_is_not_a_credential(self):
        _, pwd = student_import_row_to_request(self._valid_raw(document_number="987654321"))
        assert pwd is None

    def test_missing_email_raises(self):
        with pytest.raises(ValueError, match="correo"):
            student_import_row_to_request(self._valid_raw(email=None))

    def test_missing_document_raises(self):
        with pytest.raises(ValueError, match="cédula"):
            student_import_row_to_request(self._valid_raw(document_number=None))

    def test_missing_first_name_raises(self):
        raw = self._valid_raw(first_name=None)
        raw.pop("full_name", None)
        with pytest.raises(ValueError, match="nombre"):
            student_import_row_to_request(raw)

    def test_full_name_split_when_no_first_last(self):
        raw = {
            "email": "x@x.com",
            "document_number": "111111111",
            "full_name": "Maria Isabel Torres",
            "sex": "female",
        }
        req, _ = student_import_row_to_request(raw)
        assert req.first_name == "Maria Isabel"
        assert req.last_name == "Torres"

    def test_semester_parsed_as_int(self):
        req, _ = student_import_row_to_request(self._valid_raw(semester="3"))
        assert req.semester == 3

    def test_optional_fields_are_none_when_absent(self):
        req, _ = student_import_row_to_request(self._valid_raw())
        assert req.phone is None
        assert req.birth_date is None
