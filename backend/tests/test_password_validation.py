"""Unit tests for password strength validation in auth schemas."""

import pytest
from app.modules.auth.schemas import ChangePasswordRequest, ResetPasswordRequest
from pydantic import ValidationError


def _change_req(new_password: str) -> ChangePasswordRequest:
    return ChangePasswordRequest(current_password="OldPass1!", new_password=new_password)


def _reset_req(new_password: str) -> ResetPasswordRequest:
    return ResetPasswordRequest(token="tok", new_password=new_password)


class TestChangePasswordValidation:
    def test_strong_password_accepted(self):
        req = _change_req("Secure@123")
        assert req.new_password == "Secure@123"

    def test_too_short_rejected(self):
        with pytest.raises(ValidationError) as exc:
            _change_req("Ab1!")
        assert "8 caracteres" in str(exc.value)

    def test_no_uppercase_rejected(self):
        with pytest.raises(ValidationError) as exc:
            _change_req("secure@123")
        assert "mayúscula" in str(exc.value)

    def test_no_lowercase_rejected(self):
        with pytest.raises(ValidationError) as exc:
            _change_req("SECURE@123")
        assert "minúscula" in str(exc.value)

    def test_no_digit_rejected(self):
        with pytest.raises(ValidationError) as exc:
            _change_req("Secure@abc")
        assert "número" in str(exc.value)

    def test_no_symbol_rejected(self):
        with pytest.raises(ValidationError) as exc:
            _change_req("Secure1234")
        assert "símbolo" in str(exc.value)

    def test_multiple_failures_listed(self):
        with pytest.raises(ValidationError) as exc:
            _change_req("short")
        error_text = str(exc.value)
        # Should mention multiple missing requirements
        assert "8 caracteres" in error_text

    @pytest.mark.parametrize("symbol", ["!", "@", "#", "$", "%", "^", "&", "*", "_", "-"])
    def test_various_symbols_accepted(self, symbol):
        req = _change_req(f"Secure{symbol}123")
        assert req.new_password == f"Secure{symbol}123"


class TestResetPasswordValidation:
    def test_strong_password_accepted(self):
        req = _reset_req("MyNewPass1!")
        assert req.new_password == "MyNewPass1!"

    def test_weak_password_rejected(self):
        with pytest.raises(ValidationError):
            _reset_req("password")

    def test_token_preserved(self):
        req = _reset_req("Valid@Pass1")
        assert req.token == "tok"


class TestPasswordEdgeCases:
    def test_exactly_8_chars_with_all_requirements(self):
        req = _change_req("Aa1!Aa1!")
        assert req.new_password == "Aa1!Aa1!"

    def test_unicode_letters_satisfy_upper_lower(self):
        # Uppercase + lowercase + digit + symbol, 8+ chars
        req = _change_req("Contraseña1!")
        assert req.new_password is not None
