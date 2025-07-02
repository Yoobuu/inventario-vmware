# —————— Importaciones y configuración del router ——————
from fastapi import APIRouter, Depends, Query, Path, HTTPException
from typing import Optional, List
from fastapi.responses import JSONResponse

from app.dependencies import get_current_user
from app.vms.vm_models import VMBase, VMDetail
from app.vms.vm_service import get_vms, get_vm_detail, power_action

router = APIRouter()

# —————— Endpoint: Listar VMs ——————
@router.get("/vms", response_model=List[VMBase])
def list_vms(
    name: Optional[str]        = Query(None, description="Filtrar por nombre parcial"),
    environment: Optional[str] = Query(None, description="Filtrar por ambiente"),
    current_user: str          = Depends(get_current_user),
):
    """
    Lista todas las máquinas virtuales disponibles.
    - Aplica filtros opcionales por nombre y entorno.
    - Requiere autenticación previa.
    - Maneja errores internos al obtener la lista de VMs.
    """
    print("[DEBUG ROUTE] GET /api/vms invoked")

    try:
        vms = get_vms()
    except Exception as e:
        print(f"❌ Error al obtener VMs en get_vms(): {e}")
        raise HTTPException(status_code=500, detail="Error interno al obtener VMs")

    if name:
        vms = [vm for vm in vms if name.lower() in vm.name.lower()]
    if environment:
        vms = [vm for vm in vms if vm.environment == environment.lower()]
    return vms

# —————— Endpoint: Acciones de energía sobre una VM ——————
@router.post("/vms/{vm_id}/power/{action}")
def vm_power_action(
    vm_id: str        = Path(..., description="ID de la VM"),
    action: str       = Path(..., description="Acción: start, stop o reset"),
    current_user: str = Depends(get_current_user),
):
    """
    Ejecuta una acción de power (start, stop o reset) sobre la VM indicada.
    - Valida que la acción sea una de las permitidas.
    - Retorna una respuesta JSON con el resultado o un error 400 si la acción no es válida.
    """
    if action not in {"start", "stop", "reset"}:
        return JSONResponse(status_code=400, content={"error": "Acción no válida"})
    return power_action(vm_id, action)

# —————— Endpoint: Detalle de una VM ——————
@router.get("/vms/{vm_id}", response_model=VMDetail)
def vm_detail(
    vm_id: str        = Path(..., description="ID de la VM"),
    current_user: str = Depends(get_current_user),
):
    """
    Obtiene el detalle completo de una máquina virtual:
    - Reemplaza guiones bajos por medios para sanitizar el ID.
    - Devuelve todos los campos extendidos definidos en VMDetail.
    """
    safe_id = vm_id.replace("_", "-")
    return get_vm_detail(safe_id)
