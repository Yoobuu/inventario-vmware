
# 🖥️ Inventario VMware

Aplicación web que extrae, clasifica y muestra información de máquinas virtuales (VMs) desde un entorno VMware vCenter utilizando las APIs REST y SOAP.

- 🔒 Acceso protegido mediante autenticación JWT.
- ⚙️ Backend en FastAPI.
- 🎨 Frontend en React + Vite + Tailwind.
- 🧪 Soporte para múltiples entornos: Producción, Test, Sandbox, Desarrollo.

---

## 🚀 Estructura del proyecto

```
INVENTARIO_VMWARE/
├── backend/
│   ├── app/              # Lógica principal FastAPI
│   ├── scripts/          # Script de usuario inicial
│   └── app.db            # (Ignorado en Git)
├── frontend/
│   ├── src/              # Código React
│   └── .env              # (Ignorado en Git)
```

---

## ⚙️ Requisitos

- Python 3.13+
- Node.js 18+
- Acceso a un servidor vCenter
- pip, uvicorn, virtualenv, etc.

---

## 📦 Instalación

### 🔧 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # o venv\Scripts\activate en Windows
pip install -r requirements.txt
```

#### 🧩 Variables de entorno (crear `.env`)

```env
VCENTER_HOST=https://<IP_o_dominio_vcenter>
VCENTER_USER=usuario@vsphere.local
VCENTER_PASS=contraseña
SECRET_KEY=clave_super_secreta
INITIAL_ADMIN_PASS=admin123
```

#### ▶️ Ejecutar backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

### 🌐 2. Frontend

```bash
cd frontend
npm install
```

#### ⚙️ Variables de entorno (crear `.env`)

```env
VITE_API_URL=http://<IP_de_backend>:8000/api
```

> Ejemplo local: `http://127.0.0.1:8000/api`

#### ▶️ Ejecutar frontend

```bash
npm run dev
```

---

## 🔐 Acceso

1. Ingresa a `/login`
2. Usa las credenciales definidas en `.env` (`INITIAL_ADMIN_PASS` + username del script)
3. Se generará un JWT válido para consumir rutas protegidas.

---

## 🛠️ Funcionalidad

- Listado filtrable de VMs
- Detalle individual de VMs
- Acciones: encender, apagar, reiniciar
- Identificación por ambiente: test, prod, sandbox, desarrollo
- Seguridad con token JWT
- Protección de rutas en frontend y backend

---

## 🚫 Ignorado por `.gitignore`

- `.env` y `.env.*`
- `.db`, certificados, claves privadas
- `node_modules/`, `__pycache__/`, `.vscode/`, `dist/`, etc.

---

## 👨‍💻 Autor

**Paulo Cantos** – Universidad San Francisco de Quito – 2025
**Pasante #8** – Departamento TI USFQ – 2025


---


