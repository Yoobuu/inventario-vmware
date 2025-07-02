// —————— Módulo de configuración de Axios con manejo de JWT ——————
import axios from "axios";
import { jwtDecode } from "jwt-decode";

// —————— Instancia base de Axios ——————
const api = axios.create({
  // URL base configurada desde variable de entorno o localhost por defecto
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
});

// —————— Interceptor de petición: inyecta y valida el token JWT ——————
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    // Decodifica el expiración del token para forzar logout si ya caducó
    const { exp } = jwtDecode(token);
    if (exp * 1000 < Date.now()) {
      localStorage.removeItem("token");
      window.location.href = "/login";  // Redirige al login si expiró
      return Promise.reject(new Error("Token expirado"));
    }
    // Añade el header Authorization con el Bearer token
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// —————— Interceptor de respuesta: detecta 401 para forzar logout ——————
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Si la API responde con 401, limpia el token y redirige al login
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// —————— Exportación de la instancia para su uso en toda la app ——————
export default api;
