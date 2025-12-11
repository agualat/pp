import axios from 'axios';

// API Routes - todas las requests van a /api/* que hace proxy al backend
const API_URL = '/api';

export const api = axios.create({
  baseURL: API_URL,
  // No establecer Content-Type por defecto, dejarlo que axios lo maneje automáticamente
  // Esto permite que FormData se envíe correctamente con multipart/form-data
  // withCredentials: true,
});

// Interceptor para logging
api.interceptors.request.use(
  (config) => {
    console.log('[API] Request:', config.method?.toUpperCase(), config.url);
    
    // Solo establecer Content-Type como JSON si no es FormData
    if (!config.data || !(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }
    
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
      // No necesitamos limpiar localStorage porque usamos cookies
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

  async verifyToken() {
    const response = await api.get('/auth/verify');
    return response.data;
  },

  async logout() {
    await api.post('/auth/logout');
    window.location.href = '/login';
  },
};
