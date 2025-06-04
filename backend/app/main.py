from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Importa aquí las cachés para poder limpiarlas al iniciar
from app.vms.vm_service import vm_cache, network_cache, identity_cache

from app.auth import auth_router
from app.vms import vm_router

app = FastAPI()

@app.on_event("startup")
async def clear_caches():
    vm_cache.clear()
    network_cache.clear()
    identity_cache.clear()
    print("[DEBUG] Cachés limpiadas al arranque")
    
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Limítalo en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(vm_router.router, prefix="/api")
