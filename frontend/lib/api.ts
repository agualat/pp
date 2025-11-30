import axios from 'axios';

// En el cliente (navegador), usar localhost. En el servidor (SSR), usar la URL del contenedor
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Cliente: usar localhost para acceder desde el navegador del usuario
    return 'http://localhost:8000';
  }
  // Servidor (SSR): usar el nombre del servicio de Docker
  return process.env.NEXT_PUBLIC_API_URL || 'http://api:8000';
};

const API_URL = getApiUrl();

// Obtener la URL base del WebSocket
export const getWebSocketURL = () => {
  // SIEMPRE usar localhost en el navegador, nunca nombres de contenedores Docker
  if (typeof window !== 'undefined') {
    // Cliente: construir URL desde localhost
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Usar el mismo host que el navegador pero puerto 8000
    const host = window.location.hostname;
    return `${protocol}//${host}:8000`;
  }
  // Servidor (SSR): no debería usarse para WebSockets, pero por si acaso
  return 'ws://localhost:8000';
};

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token a las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('[API] Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', error.response?.status, error.config?.url, error.response?.data);
    if (error.response?.status === 401) {
      console.warn('[API] Unauthorized - redirecting to login');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Funciones de autenticación
export const authService = {
  async login(username: string, password: string) {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  async signup(username: string, email: string, password: string) {
    const response = await api.post('/auth/signup', { username, email, password });
    return response.data;
  },

  async verifyToken() {
    const response = await api.get('/auth/verify');
    return response.data;
  },

  logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  },

  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token: string) {
    localStorage.setItem('token', token);
  },
};
