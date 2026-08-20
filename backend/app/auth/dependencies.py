"""
FastAPI auth dependencies. Uses `HTTPBearer`, not `OAuth2PasswordBearer` —
there's no `/token` OAuth2 flow here, just a plain `Authorization: Bearer
<jwt>` header issued by /api/auth/signup|login|google.
"""
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.database import get_db
from app.models import User

# auto_error=False so a missing header doesn't short-circuit before our own
# code runs — needed so get_optional_current_user can distinguish "no token
# given" (fine, returns None) from "token given but invalid" (still a 401).
_bearer_scheme = HTTPBearer(auto_error=False)


def _resolve_user(token: str, db: Session) -> User:
    try:
        user_id = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired session — please log in again.")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(401, "Invalid or expired session — please log in again.")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(401, "Log in to continue.")
    return _resolve_user(credentials.credentials, db)


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user, but returns None instead of raising when no
    token was given at all. A token that IS given but invalid/expired still
    raises 401 — that's a real error, not "no auth attempted"."""
    if not credentials:
        return None
    return _resolve_user(credentials.credentials, db)


def get_current_subscribed_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_subscribed:
        raise HTTPException(
            403, "An active subscription is required to use saved templates."
        )
    return user
