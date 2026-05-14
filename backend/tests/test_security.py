import unittest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)


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


if __name__ == "__main__":
    unittest.main()
