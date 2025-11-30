from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from ..utils.db import get_db
from ..utils.auth import authenticate_user, get_user_from_token, hash_password
from ..models.models import (
    User,
    SignupRequest,
    LoginRequest,
    TokenResponse,
    VerifyTokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def get_current_staff_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    user = get_user_from_token(db, token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if getattr(user, "is_active", 0) == 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    if getattr(user, "is_admin", 0) != 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff only")
    return user


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email already exists")
    # Crear usuario
    hashed = hash_password(payload.password)
    user = User(username=payload.username, email=payload.email, password_hash=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    # Devolver token
    token = authenticate_user(db, payload.username, payload.password)
    assert token is not None
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    # Validar que el usuario exista y sea staff
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or getattr(user, "is_admin", 0) != 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff only")
    token = authenticate_user(db, payload.username, payload.password)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=token)


@router.get("/verify", response_model=VerifyTokenResponse)
def verify(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        return VerifyTokenResponse(valid=False)
    user = get_user_from_token(db, token)
    if not user:
        return VerifyTokenResponse(valid=False)
    return VerifyTokenResponse(valid=True, user_id=user.id, username=user.username)
