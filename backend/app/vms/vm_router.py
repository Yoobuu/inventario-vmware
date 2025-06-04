# app/vms/vm_router.py
from fastapi import APIRouter, Depends, Query, Path
from typing import Optional, List
from fastapi.responses import JSONResponse

from app.dependencies import get_current_user
from app.vms.vm_models import VMBase, VMDetail
from app.vms.vm_service import get_vms, get_vm_detail, power_action

router = APIRouter()

@router.get("/vms", response_model=List[VMBase])
def list_vms(
    name: Optional[str]        = Query(None, description="Filtrar por nombre parcial"),
    environment: Optional[str] = Query(None, description="Filtrar por ambiente"),
    current_user: str          = Depends(get_current_user),
):
    # Este print SÍ va aquí, al inicio del cuerpo
    print("[DEBUG ROUTE] GET /api/vms invoked")

    vms = get_vms()  # ahora siempre incluye guest_os

    if name:
        vms = [vm for vm in vms if name.lower() in vm.name.lower()]

    if environment:
        vms = [vm for vm in vms if vm.environment == environment.lower()]

    return vms

@router.post("/vms/{vm_id}/power/{action}")
def vm_power_action(
    vm_id: str        = Path(..., description="ID de la VM"),
    action: str       = Path(..., description="Acción: start, stop o reset"),
    current_user: str = Depends(get_current_user),
):
    if action not in {"start", "stop", "reset"}:
        return JSONResponse(status_code=400, content={"error": "Acción no válida"})
    return power_action(vm_id, action)

@router.get("/vms/{vm_id}", response_model=VMDetail)
def vm_detail(
    vm_id: str        = Path(..., description="ID de la VM"),
    current_user: str = Depends(get_current_user),
):
    safe_id = vm_id.replace("_", "-")
    return get_vm_detail(safe_id)
