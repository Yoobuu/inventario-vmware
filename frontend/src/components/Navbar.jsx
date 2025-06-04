// src/components/Navbar.jsx
import { Link } from "react-router-dom";

export default function Navbar({ onLogout }) {
  return (
    <nav className="p-4 bg-gray-800 text-white flex justify-between">
    
      <div>
        <button
          onClick={onLogout}
          className="px-3 py-1 bg-red-600 rounded hover:bg-red-500"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
