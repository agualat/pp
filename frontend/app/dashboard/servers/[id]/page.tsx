'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { serversService, Server, Metric } from '@/lib/services';

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = parseInt(params.id as string);
  
  const [server, setServer] = useState<Server | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (serverId) {
      loadServerData();
    }
  }, [serverId]);

  const loadServerData = async () => {
    try {
      const [serverData, metricsData] = await Promise.all([
        serversService.getById(serverId),
        serversService.getMetrics(serverId),
      ]);
      setServer(serverData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Error loading server data:', error);
      setError('Error al cargar los datos del servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!server) return;

    try {
      if (server.status === 'online') {
        await serversService.setOffline(server.id);
      } else {
        await serversService.setOnline(server.id);
      }
      await loadServerData();
    } catch (error) {
      console.error('Error toggling status:', error);
      setError('Error al cambiar el estado del servidor');
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
              {server.status === 'online' ? 'Marcar Offline' : 'Marcar Online'}
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Última Métrica</h2>
          {metrics.length > 0 ? (
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-600">CPU:</dt>
                <dd className="text-sm text-gray-900">{metrics[0].cpu_usage}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-600">Memoria:</dt>
                <dd className="text-sm text-gray-900">{metrics[0].memory_usage}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-600">Disco:</dt>
                <dd className="text-sm text-gray-900">{metrics[0].disk_usage}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-600">GPU:</dt>
                <dd className="text-sm text-gray-900">{metrics[0].gpu_usage}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-600">Timestamp:</dt>
                <dd className="text-sm text-gray-900">{new Date(metrics[0].timestamp).toLocaleString()}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-600 text-sm">No hay métricas disponibles</p>
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
                    <td className="px-4 py-3 text-sm text-gray-900">{metric.cpu_usage}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{metric.memory_usage}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{metric.disk_usage}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{metric.gpu_usage}</td>
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
