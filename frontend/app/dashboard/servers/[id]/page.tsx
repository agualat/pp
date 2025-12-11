'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { serversService, Server, Metric } from '@/lib/services';

// Helper para formatear métricas del historial
const formatHistoricalMetric = (value: string, type: 'cpu' | 'memory' | 'disk' | 'gpu') => {
  if (!value || value === 'N/A') return 'N/A';
  
  try {
    const parsed = JSON.parse(value);
    
    switch (type) {
      case 'cpu':
        // Extraer usage_percent del CPU
        if (parsed.usage_percent !== undefined) {
          return `${parsed.usage_percent.toFixed(1)}%`;
        }
        break;
        
      case 'memory':
        // Extraer used de memoria
        if (parsed.used !== undefined && parsed.total !== undefined) {
          const usedGB = (parsed.used / (1024 ** 3)).toFixed(2);
          const totalGB = (parsed.total / (1024 ** 3)).toFixed(2);
          const percent = parsed.percent ? parsed.percent.toFixed(1) : 'N/A';
          return `${usedGB}/${totalGB} GB (${percent}%)`;
        }
        break;
        
      case 'disk':
        // Extraer usage.percent del disco
        if (parsed.usage && parsed.usage.percent !== undefined) {
          return `${parsed.usage.percent.toFixed(1)}%`;
        }
        break;
        
      case 'gpu':
        // Formatear GPU
        if (parsed.summary && parsed.summary !== 'N/A') {
          const summary = typeof parsed.summary === 'string' ? JSON.parse(parsed.summary) : parsed.summary;
          if (summary.load_percent !== undefined) {
            return `${summary.load_percent.toFixed(1)}% (${summary.temp_c}°C)`;
          }
        }
        if (parsed.devices && parsed.devices.length > 0) {
          const first = parsed.devices[0];
          return `${first.load.toFixed(1)}%`;
        }
        break;
    }
    
    // Si no se pudo parsear correctamente, devolver el valor original
    return value;
  } catch {
    // Si no es JSON, devolver como está
    return value;
  }
};

// Helper para parsear métricas
const parseMetric = (value: any) => {
  if (!value) return 'N/A';
  
  // Si ya es un objeto, devolverlo
  if (typeof value === 'object') return value;
  
  // Si es string "N/A"
  if (value === 'N/A') return 'N/A';
  
  // Intentar parsear JSON
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Helper para formatear CPU
const formatCPU = (metric: RealtimeMetric) => {
  const cpu = metric.cpu || parseMetric(metric.cpu_usage);
  if (cpu === 'N/A') return 'N/A';
  
  // Si es un número o string numérico simple
  if (typeof cpu === 'string' || typeof cpu === 'number') {
    const val = parseFloat(cpu as string);
    if (!isNaN(val)) {
      return `${val.toFixed(1)}%`;
    }
  }
  
  // Si es objeto con usage_percent
  if (cpu && typeof cpu === 'object' && cpu.usage_percent !== undefined) {
    return `${cpu.usage_percent.toFixed(1)}%`;
  }
  
  return 'N/A';
};

// Helper para formatear Memoria
const formatMemory = (metric: RealtimeMetric) => {
  const mem = metric.ram || parseMetric(metric.memory_usage);
  if (mem === 'N/A') return 'N/A';
  
  // Si es un número o string numérico simple
  if (typeof mem === 'string' || typeof mem === 'number') {
    const val = parseFloat(mem as string);
    if (!isNaN(val)) {
      return `${val.toFixed(1)}%`;
    }
  }
  
  // Si es objeto con percent
  if (mem && typeof mem === 'object' && mem.percent !== undefined) {
    const usedGB = mem.used ? (mem.used / (1024 ** 3)).toFixed(2) : '?';
    const totalGB = mem.total ? (mem.total / (1024 ** 3)).toFixed(2) : '?';
    return `${mem.percent.toFixed(1)}% (${usedGB}/${totalGB} GB)`;
  }
  
  return 'N/A';
};

// Helper para formatear Disco
const formatDisk = (metric: RealtimeMetric) => {
  const disk = metric.disk?.usage || parseMetric(metric.disk_usage);
  if (disk === 'N/A') return 'N/A';
  
  // Si es un número o string numérico simple
  if (typeof disk === 'string' || typeof disk === 'number') {
    const val = parseFloat(disk as string);
    if (!isNaN(val)) {
      return `${val.toFixed(1)}%`;
    }
  }
  
  // Si es objeto con percent
  if (disk && typeof disk === 'object' && disk.percent !== undefined) {
    return `${disk.percent.toFixed(1)}%`;
  }
  
  return 'N/A';
};

// Helper para formatear GPU
const formatGPU = (metric: RealtimeMetric) => {
  const gpu = metric.gpu || parseMetric(metric.gpu_usage);
  if (gpu === 'N/A' || !gpu) return 'N/A';
  
  // Si es string simple
  if (typeof gpu === 'string') {
    return gpu;
  }
  
  // Si es objeto con summary
  if (gpu && typeof gpu === 'object') {
    if (gpu.summary && gpu.summary !== 'N/A') {
      const summary = typeof gpu.summary === 'string' ? parseMetric(gpu.summary) : gpu.summary;
      if (summary.load_percent !== undefined) {
        return `${summary.load_percent.toFixed(1)}% (${summary.temp_c}°C)`;
      }
    }
    
    if (gpu.devices && gpu.devices.length > 0) {
      const first = gpu.devices[0];
      return `${first.name}: ${first.load.toFixed(1)}% (${first.temperature}°C)`;
    }
  }
  
  return 'N/A';
};

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = parseInt(params.id as string);
  
  const [server, setServer] = useState<Server | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Verificar que el serverId sea válido
  useEffect(() => {
    console.log('[ServerDetail] Params:', params);
    console.log('[ServerDetail] Server ID:', serverId);
    if (isNaN(serverId)) {
      console.error('[ServerDetail] Invalid server ID:', params.id);
      setError('ID de servidor inválido');
      setLoading(false);
      return;
    }
  }, [params, serverId]);

  useEffect(() => {
    if (serverId && !isNaN(serverId)) {
      console.log('[ServerDetail] Loading data for server ID:', serverId);
      setLoading(true);
      setError('');
      setServer(null);
      loadServerData();
    }
  }, [serverId]);

  const loadServerData = async () => {
    try {
      console.log('[ServerDetail] Fetching server data for ID:', serverId);
      const [serverData, metricsData] = await Promise.all([
        serversService.getById(serverId),
        serversService.getMetrics(serverId),
      ]);
      console.log('[ServerDetail] Server data loaded:', serverData);
      setServer(serverData);
      setMetrics(metricsData);
      setError('');
    } catch (error: any) {
      console.error('[ServerDetail] Error loading server data:', error);
      console.error('[ServerDetail] Error details:', error.response?.data);
      setError(error.response?.data?.detail || 'Error al cargar los datos del servidor');
      setServer(null);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!server) return;

    try {
      const updatedServer = await serversService.getById(serverId);
      setServer(updatedServer);
    } catch (error) {
      console.error('Error refreshing server:', error);
      setError('Error al refrescar el estado del servidor');
    }
  };

  const handleDelete = async () => {
    if (!server || !confirm('¿Estás seguro de que quieres eliminar este servidor?')) {
      return;
    }

    try {
      await serversService.delete(server.id);
      router.push('/dashboard/servers');
    } catch (error) {
      console.error('Error deleting server:', error);
      setError('Error al eliminar el servidor');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Cargando datos del servidor...</p>
        </div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="card text-center py-12">
        <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Servidor no encontrado</h3>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <p className="text-gray-600 mb-4">ID solicitado: {serverId}</p>
        <button onClick={() => router.push('/dashboard/servers')} className="btn btn-primary mt-4">
          Volver a Servidores
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/servers')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a Servidores
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{server.name}</h1>
              <p className="text-gray-600">{server.ip_address}</p>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                server.status === 'online'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mr-2 ${
                  server.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></span>
              {server.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex space-x-3">
            <button onClick={handleToggleStatus} className="btn btn-secondary">
              Refrescar Estado
            </button>
            <button onClick={handleDelete} className="btn bg-red-600 text-white hover:bg-red-700">
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-700 hover:text-red-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Server Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Servidor</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">ID:</dt>
              <dd className="text-sm text-gray-900">{server.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">Nombre:</dt>
              <dd className="text-sm text-gray-900">{server.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">IP:</dt>
              <dd className="text-sm text-gray-900">{server.ip_address}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">Usuario SSH:</dt>
              <dd className="text-sm text-gray-900">{server.ssh_user}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">Estado:</dt>
              <dd className="text-sm text-gray-900 capitalize">{server.status}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Métricas en Tiempo Real</h2>
            <div className="flex items-center space-x-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></span>
              <span className="text-sm text-gray-600">
                {wsConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
          {realtimeMetric ? (
            <dl className="space-y-3">
              <div className="flex justify-between items-center">
                <dt className="text-sm font-medium text-gray-600">CPU:</dt>
                <dd className="text-sm font-semibold text-gray-900">{formatCPU(realtimeMetric)}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm font-medium text-gray-600">Memoria:</dt>
                <dd className="text-sm font-semibold text-gray-900">{formatMemory(realtimeMetric)}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm font-medium text-gray-600">Disco:</dt>
                <dd className="text-sm font-semibold text-gray-900">{formatDisk(realtimeMetric)}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm font-medium text-gray-600">GPU:</dt>
                <dd className="text-sm font-semibold text-gray-900">{formatGPU(realtimeMetric)}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm font-medium text-gray-600">Última actualización:</dt>
                <dd className="text-sm text-gray-900">{new Date(realtimeMetric.timestamp).toLocaleTimeString()}</dd>
              </div>
            </dl>
          ) : (
            <div className="text-center py-8">
              {wsConnected ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                  <p className="text-gray-600 text-sm">Esperando métricas...</p>
                </>
              ) : (
                <p className="text-gray-600 text-sm">WebSocket desconectado. Refresca la página.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics History */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Historial de Métricas</h2>
        {metrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disco</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GPU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metrics.slice(0, 10).map((metric) => (
                  <tr key={metric.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(metric.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatHistoricalMetric(metric.cpu_usage, 'cpu')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatHistoricalMetric(metric.memory_usage, 'memory')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatHistoricalMetric(metric.disk_usage, 'disk')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatHistoricalMetric(metric.gpu_usage, 'gpu')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 text-center py-8">No hay métricas registradas</p>
        )}
      </div>
    </div>
  );
}
