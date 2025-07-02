import ssl                                # SOAP interaction
import requests
import urllib3
from fastapi import HTTPException
from cachetools import TTLCache
from typing import List, Dict, Tuple     # SOAP placement returns Tuple

from pyVim.connect import SmartConnect, Disconnect        # SOAP client
from pyVmomi import vim                                   # vSphere SDK types

from app.config import VCENTER_HOST, VCENTER_USER, VCENTER_PASS
from app.vms.vm_models import VMBase, VMDetail

# ───────────────────────────────────────────────────────────────────────
# Configuración global y mapeos
# ───────────────────────────────────────────────────────────────────────
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Mapa de versiones VMX → descripción humana
COMPAT_MAP = {
    "VMX_03": "ESXi 2.5 and later (VM version 3)",
    # ... (otros mapeos intermedios) ...
    "VMX_21": "ESXi 8.0 U2 and later (VM version 21)",
}

# CACHÉS de datos para evitar llamadas repetidas
vm_cache        = TTLCache(maxsize=1,    ttl=300)   # listado de VMs
identity_cache  = TTLCache(maxsize=1000, ttl=300)  # información de guest identity
network_cache   = TTLCache(maxsize=2000, ttl=300)  # nombres de red individuales
net_list_cache  = TTLCache(maxsize=1,    ttl=300)  # mapeo completo de redes
host_cache      = TTLCache(maxsize=200,  ttl=300)  # nombres de host
placement_cache = TTLCache(maxsize=2000, ttl=300)  # host y cluster (SOAP)

# Configuración para conexión SOAP a vCenter
SOAP_CONF = {
    "host": VCENTER_HOST.replace("https://", "").replace("http://", ""),
    "user": VCENTER_USER,
    "pwd":  VCENTER_PASS,
    "port": 443,
}

def _soap_connect():
    """
    Crea una conexión no verificada al vCenter via pyVmomi
    y devuelve el ServiceInstance y su Content.
    """
    ctx = ssl._create_unverified_context()
    si = SmartConnect(
        host=SOAP_CONF["host"],
        user=SOAP_CONF["user"],
        pwd=SOAP_CONF["pwd"],
        port=SOAP_CONF["port"],
        sslContext=ctx
    )
    return si, si.RetrieveContent()

def get_host_cluster_soap(vm_id: str) -> Tuple[str, str]:
    """
    Obtiene el nombre del host y cluster que hospedan la VM.
    Utiliza pyVmomi (SOAP) y cache para mejorar rendimiento.
    """
    if vm_id in placement_cache:
        return placement_cache[vm_id]

    host_name, clus_name = "<sin datos host>", "<sin datos cluster>"
    try:
        si, content = _soap_connect()
        view = content.viewManager.CreateContainerView(
            content.rootFolder, [vim.VirtualMachine], True
        )
        for vm in view.view:
            if vm._moId == vm_id:
                host_obj    = vm.summary.runtime.host
                cluster_obj = host_obj.parent
                host_name   = getattr(host_obj,    "name", host_name)
                clus_name   = getattr(cluster_obj, "name", clus_name)
                break
        view.Destroy()
    except Exception as e:
        print(f"[DEBUG] SOAP placement ({vm_id}) fail → {e}")
    finally:
        try: Disconnect(si)
        except: pass

    placement_cache[vm_id] = (host_name, clus_name)
    return host_name, clus_name

def get_session_token() -> str:
    """
    Autentica contra la API REST de vCenter para obtener un token de sesión.
    Lanza HTTPException en caso de fallo.
    """
    try:
        r = requests.post(
            f"{VCENTER_HOST}/rest/com/vmware/cis/session",
            auth=(VCENTER_USER, VCENTER_PASS),
            verify=False, timeout=5
        )
        r.raise_for_status()
        return r.json()["value"]
    except Exception as e:
        code = getattr(e, "response", None) and e.response.status_code or 500
        raise HTTPException(status_code=code, detail=f"Auth failed: {e}")

def infer_environment(name: str) -> str:
    """
    Inferencia de entorno (test, producción, sandbox, desarrollo)
    a partir del prefijo del nombre de la VM.
    """
    p = (name or "").upper()
    if p.startswith("T-"): return "test"
    if p.startswith("P-"): return "producción"
    if p.startswith("S"): return "sandbox"
    if p.startswith("D-"): return "desarrollo"
    return "desconocido"

def load_network_map(headers: dict) -> Dict[str, str]:
    """
    Carga el mapeo completo de IDs de red → nombres legibles.
    Utiliza cache para evitar llamadas REST repetidas.
    """
    if "net_map" in net_list_cache:
        return net_list_cache["net_map"]

    try:
        r = requests.get(
            f"{VCENTER_HOST}/rest/vcenter/network",
            headers=headers, verify=False, timeout=10
        )
        r.raise_for_status()
        mapping = {item["network"]: item["name"] for item in r.json().get("value", [])}
    except Exception as e:
        print(f"[DEBUG] load_network_map fail → {e}")
        mapping = {}

    net_list_cache["net_map"] = mapping
    return mapping

def get_network_name(network_id: str, headers: dict) -> str:
    """
    Consulta el nombre de una red específica por su ID via REST,
    con caching local para mejorar rendimiento.
    """
    if network_id in network_cache:
        return network_cache[network_id]
    try:
        r = requests.get(
            f"{VCENTER_HOST}/rest/vcenter/network/{network_id}",
            headers=headers, verify=False, timeout=5
        )
        r.raise_for_status()
        name = r.json().get("value", {}).get("name", "<sin nombre>")
    except Exception as e:
        print(f"[DEBUG] get_network_name {network_id} fail → {e}")
        name = "<error>"
    network_cache[network_id] = name
    return name

def fetch_guest_identity(vm_id: str, headers: dict) -> dict:
    """
    Obtiene información de identidad del guest OS via REST.
    Guarda en cache los resultados para reuso.
    """
    if vm_id in identity_cache:
        return identity_cache[vm_id]
    try:
        r = requests.get(
            f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}/guest/identity",
            headers=headers, verify=False, timeout=5
        )
        val = r.json().get("value", {}) if r.status_code == 200 else {}
    except:
        val = {}
    identity_cache[vm_id] = val
    return val

def get_vms() -> List[VMBase]:
    """
    Recupera y construye la lista de máquinas virtuales:
      1. Autentica y obtiene token de sesión.
      2. Carga mapeo de redes.
      3. Llama al endpoint REST para listado de VMs.
      4. Por cada VM:
         - Consulta detalles básicos (hardware, guest OS).
         - Obtiene host y cluster por SOAP.
         - Extrae IPs, discos y NICs.
         - Resuelve nombres de redes primarias y fallback.
      5. Cachea el resultado completo.
    """
    if "vms" in vm_cache:
        return vm_cache["vms"]

    token   = get_session_token()
    headers = {"vmware-api-session-id": token}
    net_map = load_network_map(headers)

    r = requests.get(
        f"{VCENTER_HOST}/rest/vcenter/vm",
        headers=headers, verify=False, timeout=10
    )
    r.raise_for_status()

    out: List[VMBase] = []
    for vm in r.json().get("value", []):
        vm_id   = vm["vm"]
        vm_name = vm["name"] or f"<sin nombre {vm_id}>"
        env     = infer_environment(vm_name)

        # Detalles básicos via REST
        s = requests.get(
            f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}",
            headers=headers, verify=False, timeout=5
        )
        guest_os = s.json()["value"].get("guest_OS") if s.status_code == 200 else None

        hw = requests.get(
            f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}/hardware",
            headers=headers, verify=False, timeout=5
        ).json().get("value", {})

        compat_code  = hw.get("version", "<sin datos>")
        compat_human = COMPAT_MAP.get(compat_code, compat_code)

        host_name, cluster_name = get_host_cluster_soap(vm_id)

        # Extracción de IPs, discos y NICs del guest
        ident = fetch_guest_identity(vm_id, headers)
        ips = []
        ip_val = ident.get("ip_address")
        if isinstance(ip_val, str):
            ips.append(ip_val)
        elif isinstance(ip_val, list):
            ips.extend(ip_val)

        disks, nics = [], []
        if s.status_code == 200:
            for d in s.json()["value"].get("disks", []):
                cap = d.get("value", {}).get("capacity")
                if isinstance(cap, int):
                    disks.append(f"{cap // (1024**3)} GB")
            for nic in s.json()["value"].get("nics", []):
                label = nic.get("value", {}).get("label")
                if label:
                    nics.append(label)

        # Resolución de nombres de redes conectadas
        networks: List[str] = []
        try:
            eth = requests.get(
                f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}/hardware/ethernet",
                headers=headers, verify=False, timeout=5
            )
            if eth.status_code == 200:
                for nic in eth.json().get("value", []):
                    backing = nic.get("backing", {})
                    if backing.get("network_name"):
                        networks.append(backing["network_name"])
                    elif backing.get("network"):
                        nid = backing["network"]
                        networks.append(net_map.get(nid) or get_network_name(nid, headers))
        except Exception as e:
            print(f"[DEBUG] VM {vm_id}: ethernet fail → {e}")

        # Fallback si no conseguimos datos de red
        if not networks and s.status_code == 200:
            for nic in s.json()["value"].get("nics", []):
                v = nic.get("value", {})
                backing = v.get("backing", {})
                if backing.get("network_name"):
                    networks.append(backing["network_name"])
                elif backing.get("network"):
                    nid = backing["network"]
                    networks.append(net_map.get(nid) or get_network_name(nid, headers))

        if not networks:
            networks = ["<sin datos>"]

        out.append(
            VMBase(
                id                  = vm_id,
                name                = vm_name,
                power_state         = vm.get("power_state", "unknown"),
                cpu_count           = vm.get("cpu_count", 0),
                memory_size_MiB     = vm.get("memory_size_MiB", 0),
                environment         = env,
                guest_os            = guest_os,
                host                = host_name,
                cluster             = cluster_name,
                compatibility_code  = compat_code,
                compatibility_human = compat_human,
                networks            = networks,
                ip_addresses        = ips,
                disks               = disks,
                nics                = nics,
            )
        )

    vm_cache["vms"] = out
    return out

def power_action(vm_id: str, action: str) -> dict:
    """
    Ejecuta una acción de energía (start/stop/reset) sobre una VM
    vía REST y retorna un mensaje de resultado o lanza error HTTP.
    """
    token   = get_session_token()
    headers = {"vmware-api-session-id": token}

    r = requests.post(
        f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}/power/{action}",
        headers=headers, verify=False, timeout=5
    )
    if r.status_code == 200:
        return {"message": f"Acción '{action}' ejecutada en VM {vm_id}"}
    raise HTTPException(status_code=r.status_code, detail=r.text)

def get_vm_detail(vm_id: str) -> VMDetail:
    """
    Construye y retorna un VMDetail completo:
      - Obtiene summary, hardware y guest identity.
      - Procesa CPU, memoria, discos, NICs y redes.
      - Incluye host/cluster por SOAP y detalle de guest OS.
    """
    token   = get_session_token()
    headers = {"vmware-api-session-id": token}

    # Resumen principal
    s = requests.get(
        f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}",
        headers=headers, verify=False, timeout=10
    )
    if s.status_code != 200:
        raise HTTPException(status_code=s.status_code, detail=s.text)
    summ = s.json()["value"]

    hw = requests.get(
        f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}/hardware",
        headers=headers, verify=False, timeout=5
    ).json().get("value", {})

    compat_code  = hw.get("version", "<sin datos>")
    compat_human = COMPAT_MAP.get(compat_code, compat_code)

    name        = summ["name"]
    env         = infer_environment(name)
    power_state = summ.get("power_state", "unknown")

    # CPU y memoria: manejo de formatos anidados
    cpu = summ.get("cpu", {})
    mem = summ.get("memory", {})
    cpu_c = cpu.get("count", 0) if isinstance(cpu, dict) else summ.get("cpu_count", 0)
    mem_c = mem.get("size_MiB", 0) if isinstance(mem, dict) else summ.get("memory_size_MiB", 0)

    net_map = load_network_map(headers)
    host_name, cluster_name = get_host_cluster_soap(vm_id)

    # Discos
    disks: List[str] = []
    for d in summ.get("disks", []):
        cap = d.get("value", {}).get("capacity")
        if isinstance(cap, int):
            disks.append(f"{cap // (1024**3)} GB")

    # NICs y redes
    nics: List[str] = []
    networks: List[str] = []
    for n in summ.get("nics", []):
        v = n.get("value", {})
        if label := v.get("label"):
            nics.append(label)
        backing = v.get("backing", {})
        if backing.get("network_name"):
            networks.append(backing["network_name"])
        elif backing.get("network"):
            nid = backing["network"]
            networks.append(net_map.get(nid) or get_network_name(nid, headers))
    if not networks:
        networks = ["<sin datos>"]

    # Identidad y guest OS
    ident    = fetch_guest_identity(vm_id, headers)
    full     = ident.get("full_name")
    guest_os = (
        full.get("default_message") if isinstance(full, dict) else full
    ) or ident.get("name") or summ.get("guest_OS") or "Desconocido"

    # IPs
    ips = []
    ip_val = ident.get("ip_address")
    if isinstance(ip_val, str):
        ips.append(ip_val)
    elif isinstance(ip_val, list):
        ips.extend(ip_val)

    return VMDetail(
        id                  = vm_id,
        name                = name,
        power_state         = power_state,
        cpu_count           = cpu_c,
        memory_size_MiB     = mem_c,
        environment         = env,
        guest_os            = guest_os,
        host                = host_name,
        cluster             = cluster_name,
        compatibility_code  = compat_code,
        compatibility_human = compat_human,
        networks            = networks,
        ip_addresses        = ips,
        disks               = disks,
        nics                = nics,
    )
