"""Tests for password hashing."""
import pytest
from services.auth import pwd_context, verify_password, hash_password


class TestPasswordHashing:
    def test_hash_returns_string(self):
        result = hash_password("test-password-123")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_verify_correct_password(self):
        hashed = hash_password("my-secret")
        assert verify_password("my-secret", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("my-secret")
        assert verify_password("wrong-password", hashed) is False

    def test_different_passwords_different_hashes(self):
        h1 = hash_password("password-a")
        h2 = hash_password("password-b")
        assert h1 != h2

    def test_bcrypt_scheme(self):
        hashed = hash_password("test")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
