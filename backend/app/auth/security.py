"""
Password hashing and session-token helpers.

Uses `bcrypt` directly rather than `passlib` (effectively unmaintained, with
known breakage against modern bcrypt releases) — bcrypt's own API is small
enough that wrapping it directly needs no abstraction layer.
"""
from datetime import datetime, timedelta

import bcrypt
import jwt

from app.config import settings

_JWT_ALGORITHM = "HS256"
_ACCESS_TOKEN_LIFETIME = timedelta(days=30)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.utcnow() + _ACCESS_TOKEN_LIFETIME}
    return jwt.encode(payload, settings.session_secret, algorithm=_JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    """Returns the user id (the `sub` claim). Raises jwt.PyJWTError (or a
    subclass, e.g. ExpiredSignatureError/InvalidTokenError) on any invalid
    or expired token — callers turn this into a 401."""
    payload = jwt.decode(token, settings.session_secret, algorithms=[_JWT_ALGORITHM])
    return payload["sub"]
