import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginForm from './components/LoginForm'
import VMTable   from './components/VMTable'
import Navbar    from './components/Navbar'

export default function App() {
  // —————— Estado de autenticación ——————
  // 'logged' indica si hay un token en localStorage
  const [logged, setLogged] = useState(!!localStorage.getItem('token'))

  // —————— Sincronización de login entre pestañas ——————
  // Escucha cambios en localStorage para mantener 'logged' actualizado
  useEffect(() => {
    const handler = e => {
      if (e.key === 'token') setLogged(!!e.newValue)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // —————— Handlers para login y logout ——————
  const onLogin  = () => setLogged(true)
  const onLogout = () => {
    localStorage.removeItem('token')
    setLogged(false)
  }

  // —————— Configuración de rutas protegidas y públicas ——————
  return (
    <BrowserRouter>
      <Routes>

        {/* Ruta pública: formulario de login en pantalla completa */}
        <Route
          path="/login"
          element={
            logged
              // Si ya está logueado, redirige a la raíz
              ? <Navigate to="/" replace />
              // Si no, muestra el LoginForm centrado en blanco
              : (
                <div className="center-screen bg-white">
                  <LoginForm onLogin={onLogin} />
                </div>
              )
          }
        />

        {/* Rutas protegidas: Navbar + VMTable */}
        <Route
          path="/*"
          element={
            logged
              // Si está autenticado, muestra la app principal
              ? (
                <div className="min-h-screen bg-gray-50 flex flex-col">
                  <Navbar onLogout={onLogout} />
                  <VMTable />
                </div>
              )
              // Si no, redirige al login
              : <Navigate to="/login" replace />
          }
        />

      </Routes>
    </BrowserRouter>
  )
}
