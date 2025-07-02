from fastapi import APIRouter, HTTPException, status, Depends
from sqlmodel import Session, select
from pydantic import BaseModel
from app.auth.jwt_handler import create_access_token
from app.auth.user_model import User
from passlib.hash import bcrypt
from app.dependencies import get_session  # inyección de sesión de base de datos

router = APIRouter()


# —————— Esquemas de datos ——————
class LoginRequest(BaseModel):
    """
    Modelo de entrada para la petición de login.
    Contiene las credenciales que el cliente debe enviar.
    """
    username: str
    password: str


class TokenResponse(BaseModel):
    """
    Modelo de salida para la respuesta de login.
    Devuelve el token generado y su tipo.
    """
    access_token: str
    token_type: str = "bearer"


# —————— Punto de entrada: autenticación ——————
@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, session: Session = Depends(get_session)):
    """
    Endpoint POST /login
    1. Busca al usuario en la base de datos por username.
    2. Verifica que la contraseña enviada coincida con el hash almacenado.
    3. Si las credenciales son válidas, genera y retorna un JWT.
    4. En caso contrario, devuelve un 401 Unauthorized.
    """
    # Construye y ejecuta la consulta para obtener el usuario
    statement = select(User).where(User.username == request.username)
    user = session.exec(statement).first()

    # Logs para depuración del proceso de autenticación
    print("🔎 Intento login con:", request.username)
    if not user:
        print("❌ Usuario no encontrado en la base")
    else:
        print("✅ Usuario encontrado:", user.username)
        print("🔐 Comparando hash:")
        print("Contraseña enviada:", request.password)
        print("Hash guardado:", user.hashed_password)
        print("Verificación:", bcrypt.verify(request.password, user.hashed_password))

    # Validación de credenciales
    if not user or not bcrypt.verify(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )

    # Generación del token de acceso
    token = create_access_token({"sub": user.username})
    return {"access_token": token}
