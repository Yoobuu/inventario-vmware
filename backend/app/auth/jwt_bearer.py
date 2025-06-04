# backend/app/auth/jwt_bearer.py
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.status import HTTP_403_FORBIDDEN
from app.auth.jwt_handler import decode_token

class JWTBearer(HTTPBearer):
    def __init__(self, auto_error: bool = True):
        super(JWTBearer, self).__init__(auto_error=auto_error)

    async def __call__(self, request: Request):
        credentials: HTTPAuthorizationCredentials = await super(JWTBearer, self).__call__(request)
        if credentials:
            if not credentials.scheme == "Bearer":
                raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="Formato inválido de autenticación")
            if not self.verify_jwt(credentials.credentials):
                raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="Token inválido o expirado")
            return credentials.credentials
        else:
            raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="No se proporcionó token")

    def verify_jwt(self, jwt_token: str) -> bool:
        try:
            payload = decode_token(jwt_token)
            return payload is not None
        except:
            return False
