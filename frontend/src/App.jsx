// src/App.jsx
import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginForm from './components/LoginForm'
import VMTable   from './components/VMTable'
import Navbar    from './components/Navbar'

export default function App() {
  const [logged, setLogged] = useState(!!localStorage.getItem('token'))

  useEffect(() => {
    const handler = e => { 
      if (e.key === 'token') setLogged(!!e.newValue) 
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const onLogin  = () => setLogged(true)
  const onLogout = () => {
    localStorage.removeItem('token')
    setLogged(false)
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* LOGIN: fondo blanco y form FULL-SCREEN centrado */}
        <Route
          path="/login"
          element={
            logged
              ? <Navigate to="/" replace />
              : (
                <div className="center-screen bg-white">
                  <LoginForm onLogin={onLogin} />
                </div>
              )
          }
        />

        {/* APP PROTEGIDA */}
        <Route
          path="/*"
          element={
            logged
              ? (
                <div className="min-h-screen bg-gray-50 flex flex-col">
                  <Navbar onLogout={onLogout} />
                  <VMTable />
                </div>
              )
              : <Navigate to="/login" replace />
          }
        />

      </Routes>
    </BrowserRouter>
  )
}