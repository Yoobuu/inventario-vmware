// src/api/axios.js
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const api = axios.create({ baseURL: "http://localhost:8000/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    const { exp } = jwtDecode(token);
    if (exp * 1000 < Date.now()) {
      // token expirado → forzamos logout
      localStorage.removeItem("token");
      window.location.href = "/login";
      return Promise.reject(new Error("Token expirado"));
    }
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
