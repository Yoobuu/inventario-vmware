from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError
from app.config import SECRET_KEY, ALGORITHM
from sqlmodel import Session
from app.db import engine

# —————— Seguridad y autenticación JWT ——————
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    1. Extrae el token Bearer de la cabecera Authorization.
    2. Decodifica y valida el JWT (firma y expiración).
    3. Recupera el campo 'sub' (username) del payload.
    4. Lanza 401 si el token está expirado, inválido o carece de 'sub'.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido (sin 'sub')"
            )
        return username
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado"
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )

def get_session():
    """
    Proporciona una sesión de base de datos:
    - Crea un contexto de sesión SQLModel ligado al engine configurado.
    - Yield de la sesión para inyectarla en dependencias de rutas.
    - Cierra la sesión automáticamente al finalizar.
    """
    with Session(engine) as session:
        yield session
