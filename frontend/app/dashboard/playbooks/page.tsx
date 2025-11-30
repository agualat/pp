'use client';

import { useEffect, useState } from 'react';
import { playbooksService, Playbook, serversService, Server } from '@/lib/services';
import { useRouter } from 'next/navigation';

export default function PlaybooksPage() {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [selectedServers, setSelectedServers] = useState<number[]>([]);
  const [dryRun, setDryRun] = useState(false);
  
  // Form data para crear playbook
  const [formData, setFormData] = useState({
    name: '',
    playbook: '',
  });

  // Files para upload
  const [playbookFile, setPlaybookFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playbooksData, serversData] = await Promise.all([
        playbooksService.getAll(),
        serversService.getAll(),
      ]);
      setPlaybooks(playbooksData);
      setServers(serversData);
      setError('');
    } catch (error: any) {
      console.error('Error loading data:', error);
      setError(error.response?.data?.detail || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      let playbookPath = formData.playbook;

      // Subir archivo de playbook si se seleccionó
      if (playbookFile) {
        const playbookUpload = await playbooksService.uploadPlaybookFile(playbookFile);
        playbookPath = playbookUpload.path;
      }

      // Crear playbook con la ruta (inventario se genera dinámicamente al ejecutar)
      await playbooksService.create({
        name: formData.name,
        playbook: playbookPath,
        inventory: 'dynamic', // Siempre dinámico
      });

      setShowCreateModal(false);
      setFormData({ name: '', playbook: '' });
      setPlaybookFile(null);
      loadData();
    } catch (error: any) {
      console.error('Error creating playbook:', error);
      setError(error.response?.data?.detail || 'Error al crear el playbook');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePlaybook = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este playbook?')) {
      return;
    }
    try {
      await playbooksService.delete(id);
      loadData();
    } catch (error: any) {
      console.error('Error deleting playbook:', error);
      setError(error.response?.data?.detail || 'Error al eliminar el playbook');
    }
  };

  const handleRunPlaybook = async () => {
    if (!selectedPlaybook || selectedServers.length === 0) {
      setError('Selecciona al menos un servidor');
      return;
    }
    
    try {
      const result = await playbooksService.run(selectedPlaybook.id, selectedServers, dryRun);
      setShowRunModal(false);
      setSelectedPlaybook(null);
      setSelectedServers([]);
      setDryRun(false);
      alert(`Playbook ${dryRun ? '(Dry Run) ' : ''}ejecutado. Execution ID: ${result.execution_id}`);
      router.push(`/dashboard/executions/${result.execution_id}`);
    } catch (error: any) {
      console.error('Error running playbook:', error);
      setError(error.response?.data?.detail || 'Error al ejecutar el playbook');
    }
  };

  const toggleServerSelection = (serverId: number) => {
    setSelectedServers(prev => 
      prev.includes(serverId)
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    );
  };



  const openRunModal = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setSelectedServers([]);
    setDryRun(false);
    setShowRunModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Cargando playbooks...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Playbooks de Ansible</h1>
          <p className="text-gray-600 mt-1">Gestiona y ejecuta tus playbooks de Ansible</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Nuevo Playbook</span>
        </button>
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

      {/* Playbooks Grid */}
      {playbooks.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay playbooks</h3>
          <p className="text-gray-600 mb-4">Crea tu primer playbook de Ansible</p>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            Crear Playbook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playbooks.map((playbook) => (
            <div key={playbook.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{playbook.name}</h3>
                  <p className="text-sm text-gray-600">ID: {playbook.id}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div>
                  <span className="text-xs font-medium text-gray-500">Playbook:</span>
                  <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded mt-1 truncate">
                    {playbook.playbook}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">Inventory:</span>
                  <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded mt-1 truncate">
                    {playbook.inventory}
                  </p>
                </div>
              </div>

              <div className="flex space-x-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => openRunModal(playbook)}
                  className="flex-1 btn btn-primary text-sm py-2"
                >
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Ejecutar
                </button>
                <button
                  onClick={() => handleDeletePlaybook(playbook.id)}
                  className="btn bg-red-600 text-white hover:bg-red-700 text-sm py-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Playbook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Crear Nuevo Playbook</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreatePlaybook} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Playbook
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="ej: setup-web-server"
                    required
                  />
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Archivo Playbook (YAML)
                  </label>
                  <input
                    type="file"
                    accept=".yml,.yaml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPlaybookFile(file);
                        setFormData({ ...formData, playbook: '' });
                      }
                    }}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  {playbookFile && (
                    <p className="text-xs text-green-600 mt-2">✓ {playbookFile.name}</p>
                  )}
                  
                  <div className="flex items-center my-3">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-3 text-xs text-gray-500">O</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  <input
                    type="text"
                    value={formData.playbook}
                    onChange={(e) => {
                      setFormData({ ...formData, playbook: e.target.value });
                      setPlaybookFile(null);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                    placeholder="/path/to/playbook.yml"
                    disabled={!!playbookFile}
                  />
                  <p className="text-xs text-gray-500 mt-1">Sube un archivo o ingresa la ruta manualmente</p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setPlaybookFile(null);
                    }}
                    className="flex-1 btn btn-secondary"
                    disabled={uploading}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 btn btn-primary disabled:opacity-50"
                    disabled={uploading || (!formData.playbook && !playbookFile)}
                  >
                    {uploading ? 'Subiendo...' : 'Crear Playbook'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Run Playbook Modal */}
      {showRunModal && selectedPlaybook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Ejecutar Playbook</h2>
                <button
                  onClick={() => setShowRunModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedPlaybook.name}</h3>
                <p className="text-sm text-gray-600">Selecciona los servidores donde ejecutar este playbook</p>
              </div>

              <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                {servers.length === 0 ? (
                  <p className="text-gray-600 text-center py-4">No hay servidores disponibles</p>
                ) : (
                  servers.map((server) => (
                    <label
                      key={server.id}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedServers.includes(server.id)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedServers.includes(server.id)}
                        onChange={() => toggleServerSelection(server.id)}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{server.name}</span>
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
                        <span className="text-sm text-gray-600">{server.ip_address}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>

              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">Dry Run (Check Mode)</span>
                    <p className="text-xs text-gray-600">Ejecuta el playbook en modo prueba sin hacer cambios reales</p>
                  </div>
                </label>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowRunModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRunPlaybook}
                  disabled={selectedServers.length === 0}
                  className={`flex-1 btn disabled:opacity-50 disabled:cursor-not-allowed ${
                    dryRun ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'btn-primary'
                  }`}
                >
                  {dryRun ? '🔍 Dry Run' : '▶️ Ejecutar'} en {selectedServers.length} servidor(es)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
