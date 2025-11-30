'use client';

import { useEffect, useState } from 'react';
import { usersService, User } from '@/lib/services';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    is_admin: 0,
  });
  const [creating, setCreating] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await usersService.getAll();
      setUsers(data);
      setError('');
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(error.response?.data?.detail || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    
    try {
      await usersService.create(formData);
      setShowCreateModal(false);
      setFormData({ username: '', email: '', password: '', is_admin: 0 });
      loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      setError(error.response?.data?.detail || 'Error al crear usuario');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      if (user.is_active) {
        await usersService.deactivate(user.id);
      } else {
        await usersService.activate(user.id);
      }
      loadUsers();
    } catch (error: any) {
      console.error('Error toggling user active status:', error);
      setError(error.response?.data?.detail || 'Error al cambiar estado del usuario');
    }
  };

  const handleToggleAdmin = async (user: User) => {
    try {
      await usersService.toggleAdmin(user.id);
      loadUsers();
    } catch (error: any) {
      console.error('Error toggling admin status:', error);
      setError(error.response?.data?.detail || 'Error al cambiar estado de administrador');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return;
    }
    try {
      await usersService.delete(id);
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setError(error.response?.data?.detail || 'Error al eliminar usuario');
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      setError('Selecciona un archivo');
      return;
    }

    setUploading(true);
    try {
      const result = await usersService.bulkUpload(bulkFile);
      setBulkResult(result);
      loadUsers();
      setBulkFile(null);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      setError(error.response?.data?.detail || 'Error al cargar archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'csv' || ext === 'txt') {
        setBulkFile(file);
        setError('');
      } else {
        setError('Solo se permiten archivos .csv o .txt');
        e.target.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-600 mt-1">Administra los usuarios del sistema</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowBulkUploadModal(true)}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Carga Masiva</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Nuevo Usuario</span>
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

      {/* Users Table */}
      {users.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay usuarios</h3>
          <p className="text-gray-600 mb-4">Crea el primer usuario del sistema</p>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            Crear Usuario
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System UID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      #{user.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {user.username}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      {user.system_uid}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          user.is_admin
                            ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {user.is_admin ? '👑 Admin' : 'Usuario'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {user.is_active ? '✓ Activo' : '✗ Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Crear Nuevo Usuario</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="user@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_admin"
                    checked={!!formData.is_admin}
                    onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="is_admin" className="ml-2 text-sm font-medium text-gray-700">
                    Es Administrador
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 btn btn-secondary"
                    disabled={creating}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 btn btn-primary disabled:opacity-50"
                    disabled={creating}
                  >
                    {creating ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Carga Masiva de Usuarios</h2>
                <button
                  onClick={() => {
                    setShowBulkUploadModal(false);
                    setBulkResult(null);
                    setBulkFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {!bulkResult ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">📋 Formatos Soportados:</h3>
                    <div className="text-sm text-blue-800 space-y-2">
                      <div>
                        <strong>CSV:</strong> Archivo con una columna <code className="bg-blue-100 px-1 rounded">username</code>
                        <pre className="mt-1 bg-blue-100 p-2 rounded text-xs">
username{'\n'}
juan{'\n'}
maria
                        </pre>
                      </div>
                      <div>
                        <strong>TXT:</strong> Un username por línea
                        <pre className="mt-1 bg-blue-100 p-2 rounded text-xs">
juan{'\n'}
maria{'\n'}
pedro
                        </pre>
                      </div>
                      <p className="mt-2 text-xs text-blue-700">
                        📧 El email se genera automáticamente: <code className="bg-blue-100 px-1 rounded">{'{username}'}@estud.usfq.edu.ec</code>
                      </p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-semibold text-yellow-900 mb-2">🔐 Contraseña por Defecto:</h3>
                    <p className="text-sm text-yellow-800">
                      <code className="bg-yellow-100 px-2 py-1 rounded">{'{username}'}{new Date().getFullYear()}</code>
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Ejemplo: Para el usuario "juan" → <code className="bg-yellow-100 px-1 rounded">juan{new Date().getFullYear()}</code>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleccionar Archivo (.csv o .txt)
                    </label>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {bulkFile && (
                      <p className="mt-2 text-sm text-green-600">
                        ✓ Archivo seleccionado: {bulkFile.name}
                      </p>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkUploadModal(false);
                        setBulkFile(null);
                      }}
                      className="flex-1 btn btn-secondary"
                      disabled={uploading}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleBulkUpload}
                      className="flex-1 btn btn-primary disabled:opacity-50"
                      disabled={!bulkFile || uploading}
                    >
                      {uploading ? 'Cargando...' : 'Cargar Usuarios'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-900 mb-2">✓ Carga Completada</h3>
                    <p className="text-sm text-green-800">
                      Se crearon <strong>{bulkResult.created}</strong> usuarios correctamente
                    </p>
                    {bulkResult.failed > 0 && (
                      <p className="text-sm text-orange-700 mt-1">
                        Fallaron <strong>{bulkResult.failed}</strong> usuarios
                      </p>
                    )}
                  </div>

                  {bulkResult.users_created.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Usuarios Creados:</h4>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                        <ul className="text-sm space-y-1">
                          {bulkResult.users_created.map((user: any) => (
                            <li key={user.id} className="text-gray-700">
                              ✓ {user.username} ({user.email})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {bulkResult.users_failed.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-red-900 mb-2">Usuarios con Errores:</h4>
                      <div className="bg-red-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                        <ul className="text-sm space-y-1">
                          {bulkResult.users_failed.map((user: any, idx: number) => (
                            <li key={idx} className="text-red-700">
                              ✗ {user.username}: {user.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowBulkUploadModal(false);
                      setBulkResult(null);
                      setBulkFile(null);
                    }}
                    className="w-full btn btn-primary"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
