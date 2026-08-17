from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

# Configuración del algoritmo de encriptación y firmas de tokens
SECRET_KEY = "INAMHI_SECRET_KEY_SUPER_SECURE_2026" # Clave secreta institucional
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # El token expirará automáticamente en 1 hora

# Contexto para manejar el hashing seguro con BCrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verificar_contrasena(plain_password: str, hashed_password: str) -> bool:
    """Compara una contraseña ingresada con el hash guardado en la Base de Datos"""
    return pwd_context.verify(plain_password, hashed_password)

def obtener_contrasena_encriptada(password: str) -> str:
    """Convierte la contraseña en un hash seguro antes de guardarla"""
    return pwd_context.hash(password)

def crear_token_acceso(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Genera un token firmado JWT que el frontend usará para validar las solicitudes"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


bearer_scheme = HTTPBearer()


def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """Decodifica y valida el JWT recibido en el header Authorization: Bearer <token>."""
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas o sesión expirada",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise credenciales_invalidas

    username = payload.get("sub")
    if username is None:
        raise credenciales_invalidas

    return {
        "username": username,
        "id": payload.get("id"),
        "role": payload.get("role"),
        "nombre": payload.get("nombre"),
    }


def requerir_rol(*roles_permitidos: str):
    """Dependencia factory: exige que el usuario autenticado tenga uno de los roles indicados."""
    def verificador(usuario: dict = Depends(obtener_usuario_actual)):
        if usuario["role"] not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción",
            )
        return usuario
    return verificador