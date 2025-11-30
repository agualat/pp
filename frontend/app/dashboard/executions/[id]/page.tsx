'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { executionsService, Execution, playbooksService, Playbook, serversService, Server } from '@/lib/services';

export default function ExecutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = parseInt(params.id as string);

  const [execution, setExecution] = useState<Execution | null>(null);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (executionId && !isNaN(executionId)) {
      loadExecutionData();
    }
  }, [executionId]);

  const loadExecutionData = async () => {
    try {
      setLoading(true);
      const executionData = await executionsService.getById(executionId);
      setExecution(executionData);

      // Cargar playbook
      const playbookData = await playbooksService.getById(executionData.playbook_id);
      setPlaybook(playbookData);

      // Cargar información de servidores
      const serversData = await Promise.all(
        executionData.servers.map(sid => serversService.getById(sid))
      );
      setServers(serversData);

      setError('');
    } catch (error: any) {
      console.error('Error loading execution data:', error);
      setError(error.response?.data?.detail || 'Error al cargar los datos de la ejecución');
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'dry':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'dry':
        return 'Pendiente';
      case 'running':
        return 'Ejecutando';
      case 'success':
        return 'Exitoso';
      case 'failed':
        return 'Fallido';
      default:
        return state;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Cargando detalles de ejecución...</p>
        </div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="card text-center py-12">
        <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Ejecución no encontrada</h3>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <button onClick={() => router.push('/dashboard/executions')} className="btn btn-primary mt-4">
          Volver a Ejecuciones
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/executions')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a Ejecuciones
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ejecución #{execution.id}</h1>
              <p className="text-gray-600">{playbook?.name || `Playbook #${execution.playbook_id}`}</p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStateColor(execution.state)}`}>
              {getStateLabel(execution.state)}
            </span>
          </div>
          <button
            onClick={loadExecutionData}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Actualizar</span>
          </button>
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

      {/* Execution Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Información de Ejecución</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">ID de Ejecución:</dt>
              <dd className="text-sm text-gray-900 font-mono">#{execution.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">Estado:</dt>
              <dd className="text-sm">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStateColor(execution.state)}`}>
                  {getStateLabel(execution.state)}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">Usuario:</dt>
              <dd className="text-sm text-gray-900">{execution.user_username || `User #${execution.user_id}`}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">Fecha de Ejecución:</dt>
              <dd className="text-sm text-gray-900">{new Date(execution.executed_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-600">Servidores:</dt>
              <dd className="text-sm text-gray-900">{execution.servers.length} servidor(es)</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Playbook</h2>
          {playbook ? (
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-600">Nombre:</dt>
                <dd className="text-sm text-gray-900">{playbook.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-600">ID:</dt>
                <dd className="text-sm text-gray-900">#{playbook.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600 mb-1">Playbook:</dt>
                <dd className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded break-all">
                  {playbook.playbook}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600 mb-1">Inventory:</dt>
                <dd className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded break-all">
                  {playbook.inventory}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-600">Cargando información del playbook...</p>
          )}
        </div>
      </div>

      {/* Servers List */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Servidores Objetivo ({servers.length})
        </h2>
        {servers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((server) => (
              <div
                key={server.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/servers/${server.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{server.name}</h3>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      server.status === 'online'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {server.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{server.ip_address}</p>
                <p className="text-xs text-gray-500 mt-1">SSH User: {server.ssh_user}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-8">No hay servidores asociados</p>
        )}
      </div>
    </div>
  );
}
