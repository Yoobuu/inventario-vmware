from typing import List, Optional
from pydantic import BaseModel

class VMBase(BaseModel):
    id: str
    name: str
    power_state: str
    cpu_count: int
    memory_size_MiB: int
    environment: str
    guest_os: Optional[str]
    host: str
    cluster: str
    compatibility_code: str      # p.e. "VMX_21"
    compatibility_human: str     # p.e. "ESXi 8.0 U2 and later (VM version 21)"
    networks: List[str]

class VMDetail(VMBase):
    ip_addresses: List[str]
    disks: List[str]
    nics: List[str]
