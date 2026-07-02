from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

from core.database import get_db
from core.security import hash_password, verify_password, create_access_token, get_current_user
from models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2)
    phone: str
    email: Optional[str] = None
    password: str = Field(min_length=6)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # Strip formatting characters, then remove +977 / 977 country code if present
        phone = re.sub(r"[\s\-\(\)]", "", v.strip())
        phone = re.sub(r"^\+?977", "", phone)
        if not re.fullmatch(r"9[6-9]\d{8}", phone):
            raise ValueError("Enter a valid Nepal mobile number (e.g. 98XXXXXXXX)")
        return phone

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v


class LoginRequest(BaseModel):
    phone: str
    password: str

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        phone = re.sub(r"[\s\-\(\)]", "", v.strip())
        phone = re.sub(r"^\+?977", "", phone)
        return phone


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    email: Optional[str]
    is_admin: bool

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.phone == req.phone).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This phone number is already registered",
        )
    user = User(
        name=req.name,
        phone=req.phone,
        email=req.email or None,
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "user": user}


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == req.phone).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password",
        )
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "user": user}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
