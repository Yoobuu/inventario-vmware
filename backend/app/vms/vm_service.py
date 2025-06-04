# app/vms/vm_service.py
import ssl                                # <<< AÑADIDO SOAP >>>
import requests
import urllib3
from fastapi import HTTPException
from cachetools import TTLCache
from typing import List, Dict, Tuple     # <<< AÑADIDO SOAP >>>

from pyVim.connect import SmartConnect, Disconnect        # <<< AÑADIDO SOAP >>>
from pyVmomi import vim                                   # <<< AÑADIDO SOAP >>>

from app.config import VCENTER_HOST, VCENTER_USER, VCENTER_PASS
from app.vms.vm_models import VMBase, VMDetail

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
# ───────────────────────────────────────────────────────────────────────
# Mapa de versiones VMX → descripción humana
# ───────────────────────────────────────────────────────────────────────
COMPAT_MAP = {
    "VMX_03": "ESXi 2.5 and later (VM version 3)",
    "VMX_04": "ESXi 3.0 and later (VM version 4)",
    "VMX_06": "ESXi 4.0 and later (VM version 6)",
    "VMX_07": "ESXi 4.0 and later (VM version 7)",
    "VMX_08": "ESXi 5.0 and later (VM version 8)",
    "VMX_09": "ESXi 5.1 and later (VM version 9)",
    "VMX_10": "ESXi 5.5 and later (VM version 10)",
    "VMX_11": "ESXi 6.0 and later (VM version 11)",
    "VMX_12": "ESXi 6.5 and later (VM version 12)",
    "VMX_13": "ESXi 6.5 and later (VM version 13)",
    "VMX_14": "ESXi 6.7 and later (VM version 14)",
    "VMX_15": "ESXi 6.7 U2 and later (VM version 15)",
    "VMX_16": "ESXi 7.0 and later (VM version 16)",
    "VMX_17": "ESXi 7.0 and later (VM version 17)",
    "VMX_18": "ESXi 7.0 U1 and later (VM version 18)",
    "VMX_19": "ESXi 7.0 U2 and later (VM version 19)",
    "VMX_20": "ESXi 8.0 and later (VM version 20)",
    "VMX_21": "ESXi 8.0 U2 and later (VM version 21)",
}
# ---------------------------------------------------------------------
# CACHÉS
# ---------------------------------------------------------------------
vm_cache        = TTLCache(maxsize=1,    ttl=300)
identity_cache  = TTLCache(maxsize=1000, ttl=300)
network_cache   = TTLCache(maxsize=2000, ttl=300)
net_list_cache  = TTLCache(maxsize=1,    ttl=300)
host_cache      = TTLCache(maxsize=200,  ttl=300)
placement_cache = TTLCache(maxsize=2000, ttl=300)   # <<< AÑADIDO SOAP >>>

# ---------------------------------------------------------------------
# CONFIG SOAP (host + cluster)
# ---------------------------------------------------------------------
SOAP_CONF = {
    "host": VCENTER_HOST.replace("https://", "").replace("http://", ""),
    "user": VCENTER_USER,
    "pwd":  VCENTER_PASS,
    "port": 443,
}

def _soap_connect():
    ctx = ssl._create_unverified_context()
    si = SmartConnect(
        host=SOAP_CONF["host"],
        user=SOAP_CONF["user"],
        pwd= SOAP_CONF["pwd"],
        port=SOAP_CONF["port"],
        sslContext=ctx
    )
    return si, si.RetrieveContent()

def get_host_cluster_soap(vm_id: str) -> Tuple[str, str]:
    """
    Devuelve (host_name, cluster_name) por pyVmomi.
    """
    if vm_id in placement_cache:
        return placement_cache[vm_id]

    try:
        si, content = _soap_connect()
        view = content.viewManager.CreateContainerView(
            content.rootFolder, [vim.VirtualMachine], True
        )
        host_name = "<sin datos host>"
        clus_name = "<sin datos cluster>"

        for vm in view.view:
            if vm._moId == vm_id:
                host_obj    = vm.summary.runtime.host
                cluster_obj = host_obj.parent
                host_name   = getattr(host_obj,    "name", "<sin datos host>")
                clus_name   = getattr(cluster_obj, "name", "<sin datos cluster>")
                break
        view.Destroy()
    except Exception as e:
        host_name, clus_name = "<error host>", "<error cluster>"
        print(f"[DEBUG] SOAP placement ({vm_id}) fail → {e}")
    finally:
        try: Disconnect(si)
        except: pass

    placement_cache[vm_id] = (host_name, clus_name)
    return host_name, clus_name

# ---------------------------------------------------------------------
# AUTH / UTIL REST
# ---------------------------------------------------------------------
def get_session_token() -> str:
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
    p = (name or "").upper()
    if p.startswith("T-"): return "test"
    if p.startswith("P-"): return "producción"
    if p.startswith("S"): return "sandbox"
    if p.startswith("D-"): return "desarrollo"
    return "desconocido"

# ---------------------------------------------------------------------
# FUNCIONES AUXILIARES REDES (REST)
# ---------------------------------------------------------------------
def load_network_map(headers: dict) -> Dict[str, str]:
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
    if network_id in network_cache:
        return network_cache[network_id]
    try:
        r = requests.get(
            f"{VCENTER_HOST}/rest/vcenter/network/{network_id}",
            headers=headers, verify=False, timeout=5
        )
        r.raise_for_status()
        return r.json().get("value", {}).get("name", "<sin nombre>")
    except Exception as e:
        print(f"[DEBUG] get_network_name {network_id} fail → {e}")
        return "<error>"

# ---------------------------------------------------------------------
# GUEST IDENTITY (REST)
# ---------------------------------------------------------------------
def fetch_guest_identity(vm_id: str, headers: dict) -> dict:
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

# ---------------------------------------------------------------------
# LISTADO GENERAL
# ---------------------------------------------------------------------
def get_vms() -> List[VMBase]:
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

        # Summary (REST)
        guest_os = None
        try:
            s = requests.get(
                f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}",
                headers=headers, verify=False, timeout=5
            )
            if s.status_code == 200:
                guest_os = s.json()["value"].get("guest_OS")
        except Exception as e:
            print(f"[DEBUG] VM {vm_id}: summary fail → {e}")
        
         # --- hardware REST para version ---
        hw = requests.get(
            f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}/hardware",
            headers=headers, verify=False, timeout=5
        ).json().get("value", {})

        compat_code  = hw.get("version", "<sin datos>")
        compat_human = COMPAT_MAP.get(compat_code, compat_code)

        # Host + Cluster (SOAP)  <<< AÑADIDO SOAP >>>
        host_name, cluster_name = get_host_cluster_soap(vm_id)

        # NICs / redes
        networks: List[str] = []
        try:
            eth = requests.get(
                f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}/hardware/ethernet",
                headers=headers, verify=False, timeout=5
            )
            if eth.status_code == 200:
                for nic in eth.json().get("value", []):
                    b = nic.get("backing", {})
                    if b.get("network_name"):
                        networks.append(b["network_name"])
                    elif b.get("network"):
                        nid = b["network"]
                        networks.append(net_map.get(nid) or get_network_name(nid, headers))
        except Exception as e:
            print(f"[DEBUG] VM {vm_id}: ethernet fail → {e}")

        # <<< FALLBACK AÑADIDO >>>
        if not networks and s and s.status_code == 200:
            summary_val = s.json().get("value", {})
            for nic in summary_val.get("nics", []):
                v = nic.get("value", {})
                b = v.get("backing", {})
                if b.get("network_name"):
                    networks.append(b["network_name"])
                elif b.get("network"):
                    nid = b["network"]
                    networks.append(net_map.get(nid) or get_network_name(nid, headers))
        # <<< FIN FALLBACK >>>

        if not networks:
            networks = ["<sin datos>"]

        out.append(
            VMBase(
                id                    = vm_id,
                name                  = vm_name,
                power_state           = vm.get("power_state", "unknown"),
                cpu_count             = vm.get("cpu_count", 0),
                memory_size_MiB       = vm.get("memory_size_MiB", 0),
                environment           = env,
                guest_os              = guest_os,
                host                  = host_name,
                cluster               = cluster_name,
                compatibility_code    = compat_code,    # ← nuevo
                compatibility_human   = compat_human,   # ← nuevo
                networks              = networks,
            )
        )

    vm_cache["vms"] = out
    return out

# ---------------------------------------------------------------------
# POWER ACTION
# ---------------------------------------------------------------------
def power_action(vm_id: str, action: str) -> dict:
    token   = get_session_token()
    headers = {"vmware-api-session-id": token}

    r = requests.post(
        f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}/power/{action}",
        headers=headers, verify=False, timeout=5
    )
    if r.status_code == 200:
        return {"message": f"Acción '{action}' ejecutada en VM {vm_id}"}
    raise HTTPException(status_code=r.status_code, detail=r.text)

# ---------------------------------------------------------------------
# DETALLE COMPLETO
# ---------------------------------------------------------------------
def get_vm_detail(vm_id: str) -> VMDetail:
    token   = get_session_token()
    headers = {"vmware-api-session-id": token}

    # Summary (REST)
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

    cpu   = summ.get("cpu", {})
    mem   = summ.get("memory", {})
    cpu_c = cpu.get("count", 0) if isinstance(cpu, dict) else summ.get("cpu_count", 0)
    mem_c = mem.get("size_MiB", 0) if isinstance(mem, dict) else summ.get("memory_size_MiB", 0)

    net_map = load_network_map(headers)

    # Host + Cluster (SOAP)  <<< AÑADIDO SOAP >>>
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
        b = v.get("backing", {})
        if b.get("network_name"):
            networks.append(b["network_name"])
        elif b.get("network"):
            nid = b["network"]
            networks.append(net_map.get(nid) or get_network_name(nid, headers))
    if not networks:
        networks = ["<sin datos>"]

    # Identity
    ident    = fetch_guest_identity(vm_id, headers)
    full     = ident.get("full_name")
    guest_os = (
        full.get("default_message") if isinstance(full, dict) else full
    ) or ident.get("name") or summ.get("guest_OS") or "Desconocido"

    ips = []
    ip_val = ident.get("ip_address")
    if isinstance(ip_val, str):
        ips.append(ip_val)
    elif isinstance(ip_val, list):
        ips.extend(ip_val)

    return VMDetail(
        id                    = vm_id,
        name                  = name,
        power_state           = power_state,
        cpu_count             = cpu_c,
        memory_size_MiB       = mem_c,
        environment           = env,
        guest_os              = guest_os,
        host                  = host_name,
        cluster               = cluster_name,
        compatibility_code    = compat_code,
        compatibility_human   = compat_human,
        networks              = networks,
        ip_addresses          = ips,
        disks                 = disks,
        nics                  = nics,
    )
