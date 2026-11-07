import unittest
from pathlib import Path

from app.core.config import Settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from pydantic import ValidationError


class SecurityTests(unittest.TestCase):
    def test_password_hash_verification(self) -> None:
        hashed = hash_password("S3cure-passphrase")

        self.assertNotEqual(hashed, "S3cure-passphrase")
        self.assertTrue(verify_password("S3cure-passphrase", hashed))
        self.assertFalse(verify_password("wrong-passphrase", hashed))

    def test_access_and_refresh_tokens_are_not_interchangeable(self) -> None:
        access = create_access_token({"sub": "00000000-0000-0000-0000-000000000001"})
        refresh = create_refresh_token({"sub": "00000000-0000-0000-0000-000000000001"})

        self.assertIsNotNone(decode_access_token(access))
        self.assertIsNone(decode_refresh_token(access))
        self.assertIsNotNone(decode_refresh_token(refresh))
        self.assertIsNone(decode_access_token(refresh))

    def test_env_example_uses_distinct_marked_jwt_placeholders(self) -> None:
        example_path = Path(__file__).resolve().parents[1] / ".env.example"
        values = {}
        for line in example_path.read_text().splitlines():
            key, separator, value = line.partition("=")
            if separator and key in {"SECRET_KEY", "REFRESH_SECRET_KEY"}:
                values[key] = value

        self.assertEqual(set(values), {"SECRET_KEY", "REFRESH_SECRET_KEY"})
        self.assertNotEqual(values["SECRET_KEY"], values["REFRESH_SECRET_KEY"])
        self.assertTrue(all(value.startswith("change-me-") for value in values.values()))

        with self.assertRaises(ValidationError):
            Settings(
                _env_file=None,
                DATABASE_URL="sqlite+aiosqlite:///:memory:",
                SECRET_KEY=values["SECRET_KEY"],
                REFRESH_SECRET_KEY=values["REFRESH_SECRET_KEY"],
                DEBUG=False,
            )


if __name__ == "__main__":
    unittest.main()
