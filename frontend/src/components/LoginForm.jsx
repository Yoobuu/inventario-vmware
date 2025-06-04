// src/components/LoginForm.jsx
import { useState } from 'react'
import api from '../api/axios'
import loginImage from '../assets/login.png'

export default function LoginForm({ onLogin }) {
  const [user, setUser]   = useState('')
  const [pass, setPass]   = useState('')
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.post('/login', {
        username: user,
        password: pass
      })
      localStorage.setItem('token', data.access_token)
      onLogin()
    } catch {
      setError('Credenciales inválidas')
    }
  }

  return (
    <><div className="flex justify-center">
          <img
              src={loginImage}
              alt="Logo"
              className="w-[500px] max-w-full h-auto" />
      </div><div className="w-full max-w-sm mx-auto mt-0">
              {/* Imagen separada arriba del formulario */}


              <form
                  onSubmit={submit}
                  className="bg-white p-8 rounded-xl shadow-xl flex flex-col items-center w-full"
              >
                  <h2 className="text-2xl font-bold mb-6 text-gray-800 tracking-wide text-center">
                      INICIAR SESIÓN
                  </h2>

                  {error && (
                      <div className="text-red-600 mb-4 text-center font-medium">
                          {error}
                      </div>
                  )}

                  <div className="w-full mb-4">
                      <label className="block text-gray-700 font-medium mb-1">USUARIO</label>
                      <input
                          className="w-full p-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5da345]"
                          placeholder="Ingresa tu usuario"
                          value={user}
                          onChange={e => setUser(e.target.value)} />
                  </div>

                  <div className="w-full mb-6">
                      <label className="block text-gray-700 font-medium mb-1">CONTRASEÑA</label>
                      <input
                          type="password"
                          className="w-full p-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5da345]"
                          placeholder="Ingresa tu contraseña"
                          value={pass}
                          onChange={e => setPass(e.target.value)} />
                  </div>

                  <button
                      type="submit"
                      className="w-full py-3 bg-[#5da345] text-white rounded-lg hover:bg-[#4f923e] transition font-semibold tracking-widest uppercase"
                  >
                      ENTRAR
                  </button>
              </form>
          </div></>
  )
}
