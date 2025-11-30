'use client';

import { useEffect, useState } from 'react';
import { executionsService, Execution } from '@/lib/services';
import { useRouter } from 'next/navigation';

export default function ExecutionsPage() {
  const router = useRouter();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadExecutions();
  }, [filter]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      let data;
      if (filter === 'all') {
        data = await executionsService.getAll();
      } else {
        data = await executionsService.getByState(filter);
      }
      setExecutions(data);
      setError('');
    } catch (error: any) {
      console.error('Error loading executions:', error);
      setError(error.response?.data?.detail || 'Error al cargar las ejecuciones');
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
          <p className="mt-4 text-gray-600">Cargando ejecuciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Ejecuciones de Playbooks</h1>
        <p className="text-gray-600 mt-1">Historial y estado de ejecuciones de Ansible</p>
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

      {/* Filter Tabs */}
      <div className="mb-6 flex space-x-2 border-b border-gray-200">
        {['all', 'dry', 'running', 'success', 'failed'].map((state) => (
          <button
            key={state}
            onClick={() => setFilter(state)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              filter === state
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {state === 'all' ? 'Todas' : getStateLabel(state)}
          </button>
        ))}
      </div>

      {/* Executions List */}
      {executions.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay ejecuciones</h3>
          <p className="text-gray-600 mb-4">
            {filter === 'all' 
              ? 'Aún no se han ejecutado playbooks'
              : `No hay ejecuciones con estado "${getStateLabel(filter)}"`
            }
          </p>
          <button
            onClick={() => router.push('/dashboard/playbooks')}
            className="btn btn-primary"
          >
            Ir a Playbooks
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Playbook ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servidores</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ejecutado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {executions.map((execution) => (
                  <tr key={execution.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      #{execution.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      Playbook #{execution.playbook_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {execution.user_username || `User #${execution.user_id}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">
                        {execution.servers.length} servidor(es)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStateColor(execution.state)}`}>
                        {getStateLabel(execution.state)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(execution.executed_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => router.push(`/dashboard/executions/${execution.id}`)}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
