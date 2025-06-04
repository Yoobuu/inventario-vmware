#!/usr/bin/env python3
import ssl
import requests
import urllib3
from getpass import getpass

# ───────────────────────────────────────────────────────────────────────
# Configuración (REST)
# ───────────────────────────────────────────────────────────────────────
VCENTER_HOST = "https://p-vc-01.usfq.edu.ec"
VCENTER_USER = "api-inventory@vsphere.local"
VCENTER_PASS = r"2V\u3U71Vmuz=2"
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ───────────────────────────────────────────────────────────────────────
# Mapeo de versiones VMX → descripción humana
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
    "VMX_21": "ESXi 8.0 U2 and later (VM version 21)",  # :contentReference[oaicite:0]{index=0}
}

def main():
    vm_id = input("MoID de la VM (p.e. vm-10005): ").strip()

    # 1) Autenticación y token
    sess = requests.post(
        f"{VCENTER_HOST}/rest/com/vmware/cis/session",
        auth=(VCENTER_USER, VCENTER_PASS),
        verify=False, timeout=5
    )
    sess.raise_for_status()
    token = sess.json()["value"]
    headers = {"vmware-api-session-id": token}

    # 2) Petición: hardware details
    resp = requests.get(
        f"{VCENTER_HOST}/rest/vcenter/vm/{vm_id}/hardware",
        headers=headers, verify=False, timeout=5
    )
    resp.raise_for_status()
    hw = resp.json().get("value", {})

    # 3) Extraer y mapear
    vmx = hw.get("version", "<no disponible>")
    friendly = COMPAT_MAP.get(vmx, vmx)

    # 4) Salida
    print(f"\nVM {vm_id}")
    print("────────────────────────")
    print(f"raw version code        : {vmx}")
    print(f"human-friendly version: {friendly}")

if __name__ == "__main__":
    main()
