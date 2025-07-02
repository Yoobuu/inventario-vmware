// src/components/Navbar.jsx

import { Link } from "react-router-dom"

// —————— Componente de navegación principal ——————
// Muestra la barra superior con controles de usuario (p.ej., cierre de sesión).
export default function Navbar({ onLogout }) {
  return (
    // Contenedor principal: fondo oscuro, texto blanco y layout flex
    <nav className="p-4 bg-gray-800 text-white flex justify-between">
      {/* Área de acciones de usuario */}
      <div>
        <button
          onClick={onLogout}
          className="px-3 py-1 bg-red-600 rounded hover:bg-red-500"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
