from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import AuthResponse, GoogleAuthRequest, LoginRequest, SignupRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "An account with this email already exists.")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    # Same generic message whether the account doesn't exist, has no password
    # (a Google-only account), or the password is wrong — don't leak which.
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.")
    return _auth_response(user)


@router.post("/google", response_model=AuthResponse)
def google_signin(payload: GoogleAuthRequest, db: Session = Depends(get_db)) -> AuthResponse:
    if not settings.google_oauth_client_id:
        raise HTTPException(503, "Google sign-in isn't configured on the server.")

    try:
        claims = google_id_token.verify_oauth2_token(
            payload.id_token, google_requests.Request(), settings.google_oauth_client_id
        )
    except ValueError as exc:
        raise HTTPException(401, f"Google sign-in failed: {exc}") from exc

    google_sub = claims["sub"]
    email = claims["email"].strip().lower()
    name = claims.get("name") or email

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if not user:
        # A password-signup account with this email exists — link this
        # Google identity onto it instead of creating a duplicate account.
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_sub = google_sub
        else:
            user = User(google_sub=google_sub, email=email, name=name, password_hash=None)
            db.add(user)
        db.commit()
        db.refresh(user)

    return _auth_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
