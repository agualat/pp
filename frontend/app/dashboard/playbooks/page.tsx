"use client";

import { useEffect, useState } from "react";
import {
    playbooksService,
    Playbook,
    serversService,
    Server,
} from "@/lib/services";
import { useRouter } from "next/navigation";
import {
    cn,
    getSpinnerClass,
    getAlertClass,
    getButtonClass,
    getStatusBadgeClass,
    getIconContainerClass,
} from "@/lib/styles";
import { useToast } from "@/app/contexts/ToastContext";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { authService } from "@/lib/api";

export default function PlaybooksPage() {
    const router = useRouter();
    const toast = useToast();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showRunModal, setShowRunModal] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [playbookToDelete, setPlaybookToDelete] = useState<number | null>(
        null,
    );
    const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(
        null,
    );
    const [selectedServers, setSelectedServers] = useState<number[]>([]);
    const [dryRun, setDryRun] = useState(false);

    // Estado para el modal de contraseña SSH
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [serversNeedingPassword, setServersNeedingPassword] = useState<
        Server[]
    >([]);
    const [sshPasswords, setSshPasswords] = useState<Record<number, string>>(
        {},
    );
    const [savingPasswords, setSavingPasswords] = useState(false);

    // Form data para crear playbook
    const [formData, setFormData] = useState({
        name: "",
        playbook: "",
    });

    // Files para upload
    const [playbookFile, setPlaybookFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const verifyAuth = async () => {
            try {
                const response = await authService.verifyToken();
                if (!response.valid) {
                    router.push("/login");
                    return;
                }
                setCurrentUser(response);

                // Si no es admin, redirigir
                if (response.is_admin !== 1) {
                    router.push("/dashboard/user");
                    return;
                }
            } catch (error) {
                router.push("/login");
            } finally {
                setAuthLoading(false);
            }
        };

        verifyAuth();
    }, [router]);

    useEffect(() => {
        if (currentUser && currentUser.is_admin === 1) {
            loadData();
        }
    }, [currentUser]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [playbooksData, serversData] = await Promise.all([
                playbooksService.getAll(),
                serversService.getAll(),
            ]);
            setPlaybooks(playbooksData);
            setServers(serversData);
            setError("");
        } catch (error: any) {
            console.error("Error loading data:", error);
            setError(
                error.response?.data?.detail || "Error al cargar los datos",
            );
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
                const playbookUpload =
                    await playbooksService.uploadPlaybookFile(playbookFile);
                playbookPath = playbookUpload.path;
            }

            // Crear playbook con la ruta (inventario se genera dinámicamente al ejecutar)
            await playbooksService.create({
                name: formData.name,
                playbook: playbookPath,
                inventory: "dynamic", // Siempre dinámico
            });

            setShowCreateModal(false);
            setFormData({ name: "", playbook: "" });
            setPlaybookFile(null);
            loadData();
        } catch (error: any) {
            console.error("Error creating playbook:", error);
            setError(
                error.response?.data?.detail || "Error al crear el playbook",
            );
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePlaybook = async () => {
        if (playbookToDelete === null) return;

        try {
            await playbooksService.delete(playbookToDelete);
            toast.success("Playbook eliminado correctamente");
            setShowConfirmDelete(false);
            setPlaybookToDelete(null);
            loadData();
        } catch (error: any) {
            console.error("Error deleting playbook:", error);
            const errorMsg =
                error.response?.data?.detail || "Error al eliminar el playbook";
            toast.error(errorMsg);
            setError(errorMsg);
            setShowConfirmDelete(false);
            setPlaybookToDelete(null);
        }
    };

    const confirmDelete = (id: number) => {
        setPlaybookToDelete(id);
        setShowConfirmDelete(true);
    };

    const handleRunPlaybook = async () => {
        if (!selectedPlaybook || selectedServers.length === 0) {
            toast.warning("Selecciona al menos un servidor");
            setError("Selecciona al menos un servidor");
            return;
        }

        // Verificar si hay servidores sin contraseña guardada
        const serversWithoutPassword = servers.filter(
            (s) => selectedServers.includes(s.id) && !s.has_ssh_password,
        );

        if (serversWithoutPassword.length > 0) {
            // Mostrar modal para pedir contraseñas
            setServersNeedingPassword(serversWithoutPassword);
            setShowPasswordModal(true);
            return;
        }

        // Ejecutar directamente si todos tienen contraseña
        await executePlaybook();
    };

    const executePlaybook = async () => {
        if (!selectedPlaybook) return;

        try {
            const result = await playbooksService.run(
                selectedPlaybook.id,
                selectedServers,
                dryRun,
            );
            setShowRunModal(false);
            setSelectedPlaybook(null);
            setSelectedServers([]);
            setDryRun(false);
            toast.success(
                `Playbook ${dryRun ? "(Dry Run) " : ""}ejecutado correctamente. Redirigiendo...`,
                3000,
            );
            setTimeout(() => {
                router.push(`/dashboard/executions/${result.execution_id}`);
            }, 1000);
        } catch (error: any) {
            console.error("Error running playbook:", error);
            const errorMsg =
                error.response?.data?.detail || "Error al ejecutar el playbook";
            toast.error(errorMsg);
            setError(errorMsg);
        }
    };

    const handleSavePasswords = async () => {
        setSavingPasswords(true);

        try {
            // Guardar contraseñas para cada servidor
            const promises = serversNeedingPassword.map(async (server) => {
                const password = sshPasswords[server.id];
                if (!password) {
                    throw new Error(`Contraseña requerida para ${server.name}`);
                }

                return await serversService.saveSSHPassword(
                    server.id,
                    password,
                );
            });

            await Promise.all(promises);

            toast.success("Contraseñas guardadas exitosamente");

            // Actualizar la lista de servidores
            await loadData();

            // Cerrar modal de contraseñas y ejecutar playbook
            setShowPasswordModal(false);
            setServersNeedingPassword([]);
            setSshPasswords({});

            // Ejecutar el playbook
            await executePlaybook();
        } catch (error: any) {
            console.error("Error saving passwords:", error);
            const errorMsg =
                error.response?.data?.detail ||
                error.message ||
                "Error al guardar contraseñas";
            toast.error(errorMsg);
            setError(errorMsg);
        } finally {
            setSavingPasswords(false);
        }
    };

    const toggleServerSelection = (serverId: number) => {
        setSelectedServers((prev) =>
            prev.includes(serverId)
                ? prev.filter((id) => id !== serverId)
                : [...prev, serverId],
        );
    };

    const selectAllServers = () => {
        setSelectedServers(servers.map((s) => s.id));
    };

    const deselectAllServers = () => {
        setSelectedServers([]);
    };

    const openRunModal = (playbook: Playbook) => {
        setSelectedPlaybook(playbook);
        setSelectedServers([]);
        setDryRun(false);
        setShowRunModal(true);
    };

    if (authLoading || loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className={getSpinnerClass("lg")}></div>
                    <p className="mt-4 text-muted">
                        {authLoading
                            ? "Verificando permisos..."
                            : "Cargando playbooks..."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ProtectedRoute
            user={currentUser}
            requireAdmin={true}
            loading={authLoading}
        >
            <div>
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Playbooks de Ansible</h1>
                        <p className="page-subtitle">
                            Gestiona y ejecuta tus playbooks de Ansible
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className={cn(
                            getButtonClass("primary"),
                            "flex items-center space-x-2",
                        )}
                    >
                        <svg
                            className="icon-sm"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        <span>Nuevo Playbook</span>
                    </button>
                </div>

                {/* Error message */}
                {error && (
                    <div className={cn(getAlertClass("error"), "mb-6")}>
                        <span>{error}</span>
                        <button
                            onClick={() => setError("")}
                            className="text-red-700 hover:text-red-900"
                        >
                            <svg
                                className="icon-md"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Playbooks Grid */}
                {playbooks.length === 0 ? (
                    <div className="empty-state">
                        <svg
                            className="empty-state-icon text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                        <h3 className="empty-state-title">No hay playbooks</h3>
                        <p className="empty-state-description">
                            Crea tu primer playbook de Ansible
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className={getButtonClass("primary")}
                        >
                            Crear Playbook
                        </button>
                    </div>
                ) : (
                    <div className="grid-3-cols">
                        {playbooks.map((playbook) => (
                            <div
                                key={playbook.id}
                                className="card hover:shadow-lg transition-shadow"
                            >
                                <div className="item-card-header">
                                    <div className="flex-1">
                                        <h3 className="item-card-title">
                                            {playbook.name}
                                        </h3>
                                        <p className="text-sm text-muted">
                                            ID: {playbook.id}
                                        </p>
                                    </div>
                                    <div
                                        className={cn(
                                            getIconContainerClass("primary"),
                                            "flex-shrink-0",
                                        )}
                                    >
                                        <svg
                                            className="icon-lg"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                            />
                                        </svg>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div>
                                        <span className="text-xs font-medium text-gray-500">
                                            Playbook:
                                        </span>
                                        <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded mt-1 truncate">
                                            {playbook.playbook}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-gray-500">
                                            Inventory:
                                        </span>
                                        <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded mt-1 truncate">
                                            {playbook.inventory}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex space-x-2 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => openRunModal(playbook)}
                                        className={cn(
                                            getButtonClass("primary"),
                                            "flex-1 text-sm py-2",
                                        )}
                                    >
                                        <svg
                                            className="icon-xs inline mr-1"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                            />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        Ejecutar
                                    </button>
                                    <button
                                        onClick={() =>
                                            confirmDelete(playbook.id)
                                        }
                                        className={cn(
                                            getButtonClass("danger"),
                                            "text-sm py-2",
                                        )}
                                    >
                                        <svg
                                            className="icon-xs"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Playbook Modal */}
                {showCreateModal && (
                    <div
                        className="modal-overlay"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <div
                            className="modal-content max-w-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2 className="modal-title">
                                    Crear Nuevo Playbook
                                </h2>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg
                                        className="icon-md"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form
                                    onSubmit={handleCreatePlaybook}
                                    className="space-y-4"
                                >
                                    <div className="form-group">
                                        <label
                                            htmlFor="playbook-name"
                                            className="label"
                                        >
                                            Nombre del Playbook
                                        </label>
                                        <input
                                            id="playbook-name"
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    name: e.target.value,
                                                })
                                            }
                                            className="input"
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
                                                const file =
                                                    e.target.files?.[0];
                                                if (file) {
                                                    setPlaybookFile(file);
                                                    setFormData({
                                                        ...formData,
                                                        playbook: "",
                                                    });
                                                }
                                            }}
                                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                        />
                                        {playbookFile && (
                                            <p className="text-xs text-green-600 mt-2">
                                                ✓ {playbookFile.name}
                                            </p>
                                        )}

                                        <div className="flex items-center my-3">
                                            <div className="flex-1 border-t border-gray-300"></div>
                                            <span className="px-3 text-xs text-gray-500">
                                                O
                                            </span>
                                            <div className="flex-1 border-t border-gray-300"></div>
                                        </div>

                                        <input
                                            type="text"
                                            value={formData.playbook}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    playbook: e.target.value,
                                                });
                                                setPlaybookFile(null);
                                            }}
                                            className="input font-mono text-sm"
                                            placeholder="/path/to/playbook.yml"
                                            disabled={!!playbookFile}
                                        />
                                        <p className="form-help">
                                            Sube un archivo o ingresa la ruta
                                            manualmente
                                        </p>
                                    </div>

                                    <div className="modal-footer">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCreateModal(false);
                                                setPlaybookFile(null);
                                            }}
                                            className={getButtonClass(
                                                "secondary",
                                            )}
                                            disabled={uploading}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className={getButtonClass(
                                                "primary",
                                            )}
                                            disabled={
                                                uploading ||
                                                (!formData.playbook &&
                                                    !playbookFile)
                                            }
                                        >
                                            {uploading ? (
                                                <>
                                                    <div
                                                        className={cn(
                                                            getSpinnerClass(
                                                                "sm",
                                                            ),
                                                            "mr-2",
                                                        )}
                                                    ></div>
                                                    Subiendo...
                                                </>
                                            ) : (
                                                "Crear Playbook"
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Run Playbook Modal */}
                {showRunModal && selectedPlaybook && (
                    <div
                        className="modal-overlay"
                        onClick={() => setShowRunModal(false)}
                    >
                        <div
                            className="modal-content max-w-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2 className="modal-title">
                                    Ejecutar Playbook
                                </h2>
                                <button
                                    onClick={() => setShowRunModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg
                                        className="icon-md"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        {selectedPlaybook.name}
                                    </h3>
                                    <p className="text-sm text-muted">
                                        Selecciona los servidores donde ejecutar
                                        este playbook
                                    </p>
                                </div>

                                {/* Select All / Deselect All buttons */}
                                {servers.length > 0 && (
                                    <div className="flex space-x-2 mb-4">
                                        <button
                                            type="button"
                                            onClick={selectAllServers}
                                            className={cn(
                                                getButtonClass("secondary"),
                                                "text-sm flex-1",
                                            )}
                                        >
                                            ✓ Seleccionar Todos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={deselectAllServers}
                                            className={cn(
                                                getButtonClass("secondary"),
                                                "text-sm flex-1",
                                            )}
                                        >
                                            ✗ Deseleccionar Todos
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                                    {servers.length === 0 ? (
                                        <p className="text-muted text-center py-4">
                                            No hay servidores disponibles
                                        </p>
                                    ) : (
                                        servers.map((server) => (
                                            <label
                                                key={server.id}
                                                className={cn(
                                                    "flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors",
                                                    selectedServers.includes(
                                                        server.id,
                                                    )
                                                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-400"
                                                        : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedServers.includes(
                                                        server.id,
                                                    )}
                                                    onChange={() =>
                                                        toggleServerSelection(
                                                            server.id,
                                                        )
                                                    }
                                                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                                />
                                                <div className="ml-3 flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                            {server.name}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border",
                                                                server.status ===
                                                                    "online"
                                                                    ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700"
                                                                    : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700",
                                                            )}
                                                        >
                                                            {server.status}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm text-muted">
                                                        {server.ip_address}
                                                    </span>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>

                                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/30 dark:border-blue-700">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={dryRun}
                                            onChange={(e) =>
                                                setDryRun(e.target.checked)
                                            }
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        <div className="ml-3">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                Dry Run (Check Mode)
                                            </span>
                                            <p className="text-xs text-muted">
                                                Ejecuta el playbook en modo
                                                prueba sin hacer cambios reales
                                            </p>
                                        </div>
                                    </label>
                                </div>

                                <div className="modal-footer">
                                    <button
                                        onClick={() => setShowRunModal(false)}
                                        className={getButtonClass("secondary")}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleRunPlaybook}
                                        disabled={selectedServers.length === 0}
                                        className={cn(
                                            "flex-1",
                                            dryRun
                                                ? "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                : getButtonClass("primary"),
                                            "disabled:opacity-50 disabled:cursor-not-allowed",
                                        )}
                                    >
                                        {dryRun ? "🔍 Dry Run" : "▶️ Ejecutar"}{" "}
                                        en {selectedServers.length} servidor(es)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Delete Dialog */}
                <ConfirmDialog
                    isOpen={showConfirmDelete}
                    title="Eliminar Playbook"
                    message="¿Estás seguro de que quieres eliminar este playbook? Esta acción no se puede deshacer."
                    confirmText="Eliminar"
                    cancelText="Cancelar"
                    type="danger"
                    onConfirm={handleDeletePlaybook}
                    onCancel={() => {
                        setShowConfirmDelete(false);
                        setPlaybookToDelete(null);
                    }}
                />

                {/* SSH Password Modal */}
                {showPasswordModal && (
                    <div
                        className="modal-overlay"
                        onClick={() => {
                            setShowPasswordModal(false);
                            setSshPasswords({});
                        }}
                    >
                        <div
                            className="modal-content max-w-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2 className="modal-title">
                                    Contraseñas SSH Requeridas
                                </h2>
                                <button
                                    onClick={() => {
                                        setShowPasswordModal(false);
                                        setSshPasswords({});
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg
                                        className="icon-md"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/30 dark:border-yellow-700">
                                    <div className="flex items-start">
                                        <svg
                                            className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        <div>
                                            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                                Contraseñas SSH no guardadas
                                            </h3>
                                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                                Los siguientes servidores no
                                                tienen contraseña SSH guardada.
                                                Necesitamos la contraseña para
                                                ejecutar comandos con
                                                privilegios (sudo). Las
                                                contraseñas se guardarán de
                                                forma segura y encriptada.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {serversNeedingPassword.map((server) => (
                                        <div
                                            key={server.id}
                                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                                        >
                                            <div className="mb-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        {server.name}
                                                    </span>
                                                    <span className="text-sm text-muted">
                                                        {server.ip_address}
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Contraseña SSH
                                                </label>
                                                <input
                                                    type="password"
                                                    value={
                                                        sshPasswords[
                                                            server.id
                                                        ] || ""
                                                    }
                                                    onChange={(e) =>
                                                        setSshPasswords({
                                                            ...sshPasswords,
                                                            [server.id]:
                                                                e.target.value,
                                                        })
                                                    }
                                                    className="input-field w-full"
                                                    placeholder="Ingresa la contraseña SSH"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="modal-footer mt-6">
                                    <button
                                        onClick={() => {
                                            setShowPasswordModal(false);
                                            setSshPasswords({});
                                        }}
                                        className={getButtonClass("secondary")}
                                        disabled={savingPasswords}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSavePasswords}
                                        disabled={
                                            savingPasswords ||
                                            serversNeedingPassword.some(
                                                (s) => !sshPasswords[s.id],
                                            )
                                        }
                                        className={cn(
                                            getButtonClass("primary"),
                                            "disabled:opacity-50 disabled:cursor-not-allowed",
                                        )}
                                    >
                                        {savingPasswords ? (
                                            <>
                                                <div
                                                    className={cn(
                                                        getSpinnerClass("sm"),
                                                        "mr-2",
                                                    )}
                                                ></div>
                                                Guardando...
                                            </>
                                        ) : (
                                            "Guardar y Ejecutar"
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
