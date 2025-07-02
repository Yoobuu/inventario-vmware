from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Carga las variables de entorno desde .env
load_dotenv()

# Importación de cachés para limpiarlas al iniciar la aplicación
from app.vms.vm_service import vm_cache, network_cache, identity_cache

# Importación de routers de autenticación y VMs
from app.auth import auth_router
from app.vms import vm_router

# —————— Creación de la aplicación FastAPI ——————
app = FastAPI()

# —————— Evento de arranque ——————
@app.on_event("startup")
async def clear_caches():
    """
    Al iniciar la app:
    1. Vacía los cachés usados para VMs, redes e identidad de guest.
    2. Imprime un mensaje de debug para confirmar la limpieza.
    """
    vm_cache.clear()
    network_cache.clear()
    identity_cache.clear()
    print("[DEBUG] Cachés limpiadas al arranque")

# —————— Configuración de CORS ——————
# Se permite que el front-end (origen definido en .env) interactúe con esta API.
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# —————— Registro de routers ——————
# Todas las rutas de autenticación estarán bajo /api
app.include_router(auth_router.router, prefix="/api")
# Todas las rutas de VM estarán también bajo /api
app.include_router(vm_router.router, prefix="/api")
