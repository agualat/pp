"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { authService } from "@/lib/api";
import CreateContainerModal from "@/app/components/CreateContainerModal";
import { useToast } from "@/app/contexts/ToastContext";
import {
    cn,
    getStatusBadgeClass,
    getButtonClass,
    getAlertClass,
    getCardClass,
    getSpinnerClass,
    getInputClass,
    getIconClass,
} from "@/lib/styles";

interface Container {
    id: number;
    name: string;
    user_id: number;
    username?: string;
    server_id: number;
    server_name: string;
    image: string;
    ports: string;
    status: string;
    is_public: boolean;
    container_id: string | null;
    created_at: string;
}

interface Server {
    id: number;
    name: string;
}

interface User {
    id: number;
    username: string;
    email: string;
    is_admin: number;
    is_active: number;
}

export default function AllContainersPage() {
    const router = useRouter();
    const toast = useToast();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [containers, setContainers] = useState<Container[]>([]);
    const [servers, setServers] = useState<Server[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filtros
    const [serverFilter, setServerFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [publicFilter, setPublicFilter] = useState<string>("");
    const [containerNameSearch, setContainerNameSearch] = useState<string>("");
    const [showFilters, setShowFilters] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSyncDropdown, setShowSyncDropdown] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (currentUser) {
            fetchServers();
            fetchUsers();
            fetchContainers();
        }
    }, [currentUser]);

    // Aplicar filtros en tiempo real cuando cambian
    useEffect(() => {
        if (currentUser) {
            fetchContainers();
        }
    }, [serverFilter, statusFilter, publicFilter, containerNameSearch]);

    const checkAuth = async () => {
        try {
            const response = await authService.verifyToken();
            if (!response.valid) {
                router.push("/login");
                return;
            }
            setCurrentUser(response);

            // Si no es admin, redirigir
            if (response.is_admin !== 1) {
                router.push("/dashboard");
                return;
            }
        } catch (error) {
            console.error("Error checking auth:", error);
            router.push("/login");
        } finally {
            setAuthLoading(false);
        }
    };

    const fetchServers = async () => {
        try {
            const response = await fetch("/api/servers");
            if (response.ok) {
                const data = await response.json();
                setServers(data);
            }
        } catch (err) {
            console.error("Error fetching servers:", err);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch("/api/users");
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    };

    const fetchContainers = async () => {
        try {
            // Solo mostrar loading completo en la carga inicial
            if (containers.length === 0) {
                setLoading(true);
            }
            setError("");

            // Construir query params
            const params = new URLSearchParams();
            if (serverFilter) params.append("server_id", serverFilter);
            if (statusFilter) params.append("status", statusFilter);
            if (publicFilter) params.append("is_public", publicFilter);

            const queryString = params.toString();
            const url = `/api/containers/all${queryString ? `?${queryString}` : ""}`;

            const response = await fetch(url);

            if (response.status === 403) {
                setError("No tienes permisos para ver todos los contenedores");
                router.push("/dashboard/user");
                return;
            }

            if (!response.ok) {
                throw new Error("Error al cargar contenedores");
            }

            const data = await response.json();

            // Filtrar por nombre localmente si hay búsqueda
            let filteredData = data;
            if (containerNameSearch.trim()) {
                filteredData = data.filter((container: Container) =>
                    container.name
                        .toLowerCase()
                        .includes(containerNameSearch.toLowerCase()),
                );
            }

            setContainers(filteredData);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Error al cargar contenedores",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setServerFilter("");
        setStatusFilter("");
        setPublicFilter("");
        setContainerNameSearch("");
        // No necesitamos llamar fetchContainers() aquí porque el useEffect lo hará
    };

    const handleStartContainer = async (containerId: number) => {
        try {
            const response = await fetch(
                `/api/containers/${containerId}/start`,
                {
                    method: "POST",
                },
            );

            if (response.ok) {
                toast.success("Contenedor iniciado exitosamente ▶️");
                fetchContainers();
            } else {
                const data = await response.json();
                const errorMsg = data.detail || "Error al iniciar contenedor";
                toast.error(errorMsg);
            }
        } catch (err) {
            toast.error("Error al iniciar contenedor");
        }
    };

    const handleStopContainer = async (containerId: number) => {
        try {
            const response = await fetch(
                `/api/containers/${containerId}/stop`,
                {
                    method: "POST",
                },
            );

            if (response.ok) {
                toast.success("Contenedor detenido exitosamente ⏸️");
                fetchContainers();
            } else {
                const data = await response.json();
                const errorMsg = data.detail || "Error al detener contenedor";
                toast.error(errorMsg);
            }
        } catch (err) {
            toast.error("Error al detener contenedor");
        }
    };

    const handleDeleteContainer = async (
        containerId: number,
        containerName: string,
    ) => {
        if (
            !confirm(
                `¿Estás seguro de eliminar el contenedor "${containerName}"?`,
            )
        ) {
            return;
        }

        try {
            const response = await fetch(`/api/containers/${containerId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                toast.success(
                    `Contenedor "${containerName}" eliminado exitosamente 🗑️`,
                );
                fetchContainers();
            } else {
                const data = await response.json();
                const errorMsg = data.detail || "Error al eliminar contenedor";
                toast.error(errorMsg);
            }
        } catch (err) {
            toast.error("Error al eliminar contenedor");
        }
    };

    const handleSyncServer = async (serverId: number, serverName: string) => {
        try {
            toast.info(`Actualizando estado desde ${serverName}...`);
            const response = await fetch(
                `/api/containers/sync/server/${serverId}`,
                {
                    method: "POST",
                },
            );

            if (response.ok) {
                const data = await response.json();
                const updated = data.update_result?.updated_count || 0;
                toast.success(
                    `Estado actualizado desde ${serverName}: ${updated} cambios ✅`,
                );
                fetchContainers();
            } else {
                let errorMsg = "Error al actualizar estado";
                try {
                    const data = await response.json();
                    errorMsg = data.detail || errorMsg;
                } catch {
                    errorMsg = `Error ${response.status}: ${response.statusText}`;
                }
                toast.error(`❌ ${errorMsg}`);
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Error de conexión";
            toast.error(`❌ Error al actualizar estado: ${errorMessage}`);
        }
    };

    const handleSyncAllServers = async () => {
        try {
            toast.info("Actualizando estado desde todos los servidores...");
            const response = await fetch(`/api/containers/sync/all`, {
                method: "POST",
            });

            if (response.ok) {
                const data = await response.json();
                toast.success(data.message + " ✅");
                fetchContainers();
            } else {
                let errorMsg = "Error al actualizar estado";
                try {
                    const data = await response.json();
                    errorMsg = data.detail || errorMsg;
                } catch {
                    errorMsg = `Error ${response.status}: ${response.statusText}`;
                }
                toast.error(`❌ ${errorMsg}`);
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Error de conexión";
            toast.error(
                `❌ Error al actualizar estado desde todos los servidores: ${errorMessage}`,
            );
        }
    };

    const handleGetServerStatus = async (
        serverId: number,
        serverName: string,
    ) => {
        try {
            toast.info(`Obteniendo estado de contenedores en ${serverName}...`);
            const response = await fetch(
                `/api/containers/status/server/${serverId}`,
            );

            if (response.ok) {
                const data = await response.json();
                toast.success(
                    `Estado obtenido: ${data.containers_count} contenedores en ${serverName}`,
                );
                console.log("Estado de contenedores:", data);
                fetchContainers();
            } else {
                let errorMsg = "Error al obtener estado";
                try {
                    const data = await response.json();
                    errorMsg = data.detail || errorMsg;
                } catch {
                    errorMsg = `Error ${response.status}: ${response.statusText}`;
                }
                toast.error(`❌ ${errorMsg}`);
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Error de conexión";
            toast.error(`❌ Error al obtener estado: ${errorMessage}`);
        }
    };

    const getContainerStatusBadge = (status: string) => {
        const baseClass =
            "inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all";
        const statusMap: Record<string, string> = {
            running: `${baseClass} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800`,
            stopped: `${baseClass} bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700`,
            error: `${baseClass} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800`,
            creating: `${baseClass} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800`,
            created: `${baseClass} bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800`,
        };
        return (
            statusMap[status] ||
            `${baseClass} bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700`
        );
    };

    const getStatusText = (status: string) => {
        const statusMap: Record<string, string> = {
            running: "▶️ En ejecución",
            stopped: "⏸️ Detenido",
            error: "❌ Error",
            creating: "⚙️ Creando",
            created: "✨ Creado",
            exited: "🚪 Finalizado",
            paused: "⏸️ Pausado",
            restarting: "🔄 Reiniciando",
        };
        return statusMap[status] || `⚪ ${status}`;
    };

    const stats = {
        total: containers.length,
        running: containers.filter((c) => c.status === "running").length,
        stopped: containers.filter((c) => c.status === "stopped").length,
        public: containers.filter((c) => c.is_public).length,
    };

    if (authLoading || loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className={getSpinnerClass("lg")}></div>
                    <p className="mt-4 text-muted">
                        {authLoading
                            ? "Verificando permisos..."
                            : "Cargando contenedores..."}
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
            <div className="space-y-6">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">
                            🐳 Gestión de Contenedores
                        </h1>
                        <p className="page-subtitle">
                            Administra todos los contenedores Docker del sistema
                        </p>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className={getButtonClass("primary")}
                            title="Crear contenedor"
                        >
                            <span className="mr-2">➕</span>
                            Nuevo Contenedor
                        </button>
                        <button
                            onClick={() => fetchContainers()}
                            className={getButtonClass("secondary")}
                            title="Actualizar"
                        >
                            <span className="mr-2">🔄</span>
                            Actualizar
                        </button>
                    </div>
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className={getCardClass()}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted">Total</p>
                                <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                                    {stats.total}
                                </p>
                            </div>
                            <div className="icon-container icon-container-primary">
                                <span className="text-2xl">📦</span>
                            </div>
                        </div>
                    </div>

                    <div className={getCardClass()}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted">
                                    En Ejecución
                                </p>
                                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                    {stats.running}
                                </p>
                            </div>
                            <div className="icon-container icon-container-success">
                                <span className="text-2xl">▶️</span>
                            </div>
                        </div>
                    </div>

                    <div className={getCardClass()}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted">Detenidos</p>
                                <p className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                                    {stats.stopped}
                                </p>
                            </div>
                            <div className="icon-container icon-container-warning">
                                <span className="text-2xl">⏸️</span>
                            </div>
                        </div>
                    </div>

                    <div className={getCardClass()}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted">Públicos</p>
                                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                    {stats.public}
                                </p>
                            </div>
                            <div className="icon-container icon-container-primary">
                                <span className="text-2xl">🌐</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filtros */}
                <div className={getCardClass()}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <h2 className="card-header mb-0">Filtros</h2>
                            {(serverFilter ||
                                statusFilter ||
                                publicFilter ||
                                containerNameSearch) && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                    {
                                        [
                                            serverFilter,
                                            statusFilter,
                                            publicFilter,
                                            containerNameSearch,
                                        ].filter(Boolean).length
                                    }{" "}
                                    activo
                                    {[
                                        serverFilter,
                                        statusFilter,
                                        publicFilter,
                                        containerNameSearch,
                                    ].filter(Boolean).length !== 1
                                        ? "s"
                                        : ""}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                "text-sm",
                                getButtonClass("secondary"),
                            )}
                        >
                            {showFilters ? "Ocultar" : "Mostrar"} filtros
                        </button>
                    </div>

                    {showFilters && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="label">Servidor</label>
                                    <select
                                        value={serverFilter}
                                        onChange={(e) => {
                                            setServerFilter(e.target.value);
                                        }}
                                        className="select"
                                    >
                                        <option value="">
                                            Todos los servidores
                                        </option>
                                        {servers.map((server) => (
                                            <option
                                                key={server.id}
                                                value={server.id}
                                            >
                                                {server.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="label">Estado</label>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => {
                                            setStatusFilter(e.target.value);
                                        }}
                                        className="select"
                                    >
                                        <option value="">
                                            Todos los estados
                                        </option>
                                        <option value="running">
                                            En ejecución
                                        </option>
                                        <option value="stopped">
                                            Detenido
                                        </option>
                                        <option value="error">Error</option>
                                        <option value="creating">
                                            Creando
                                        </option>
                                    </select>
                                </div>

                                <div>
                                    <label className="label">Visibilidad</label>
                                    <select
                                        value={publicFilter}
                                        onChange={(e) => {
                                            setPublicFilter(e.target.value);
                                        }}
                                        className="select"
                                    >
                                        <option value="">Todos</option>
                                        <option value="true">Públicos</option>
                                        <option value="false">Privados</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="label">
                                        🔍 Buscar por Nombre
                                    </label>
                                    <input
                                        type="text"
                                        value={containerNameSearch}
                                        onChange={(e) => {
                                            setContainerNameSearch(
                                                e.target.value,
                                            );
                                        }}
                                        placeholder="Ej: nginx, colab, api..."
                                        className="input"
                                    />
                                    {containerNameSearch && (
                                        <p className="text-xs text-muted mt-1">
                                            Mostrando contenedores que contienen
                                            &quot;{containerNameSearch}&quot;
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleClearFilters}
                                    className={getButtonClass("secondary")}
                                    disabled={
                                        !serverFilter &&
                                        !statusFilter &&
                                        !publicFilter &&
                                        !containerNameSearch
                                    }
                                >
                                    <span className="mr-2">✖️</span>
                                    Limpiar Filtros
                                </button>
                                <div className="flex items-center text-xs text-muted ml-auto">
                                    <span className="mr-2">✨</span>
                                    <span>
                                        Los filtros se aplican automáticamente
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Sección de Actualización de Estado - Dropdown */}
                <div className={getCardClass()}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <span className="text-xl">🔄</span>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <h3 className="text-lg font-semibold text-primary">
                                        Actualización de Estado (Docker)
                                    </h3>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                        {servers.filter((s) => s.id).length}{" "}
                                        {servers.filter((s) => s.id).length ===
                                        1
                                            ? "servidor"
                                            : "servidores"}
                                    </span>
                                </div>
                                <p className="text-sm text-muted">
                                    Sincroniza el estado real desde los
                                    servidores
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() =>
                                setShowSyncDropdown(!showSyncDropdown)
                            }
                            className={cn(
                                getButtonClass("secondary"),
                                "transition-all duration-300",
                                showSyncDropdown && "rotate-180",
                            )}
                            title={
                                showSyncDropdown
                                    ? "Ocultar opciones"
                                    : "Mostrar opciones"
                            }
                        >
                            <span className="text-lg">▼</span>
                        </button>
                    </div>

                    <div
                        className={cn(
                            "overflow-hidden transition-all duration-300 ease-in-out",
                            showSyncDropdown
                                ? "max-h-[800px] opacity-100 mt-4"
                                : "max-h-0 opacity-0",
                        )}
                    >
                        <div className="pt-4 border-t border-border dark:border-dark-border space-y-4">
                            {/* Actualizar todos */}
                            <div className="space-y-2 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
                                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center space-x-2">
                                    <span>🌐</span>
                                    <span>Todos los Servidores</span>
                                </p>
                                <button
                                    onClick={handleSyncAllServers}
                                    className={cn(
                                        getButtonClass("primary"),
                                        "w-full justify-center",
                                    )}
                                    title="Actualizar estado desde todos los servidores activos"
                                >
                                    <span className="mr-2">🔄</span>
                                    Actualizar Todos los Servidores
                                </button>
                            </div>

                            {/* Por servidor específico */}
                            <div className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                                    <span>🖥️</span>
                                    <span>Por Servidor Específico</span>
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {servers
                                        .filter((s) => s.id)
                                        .map((server) => (
                                            <div
                                                key={server.id}
                                                className="flex gap-1"
                                            >
                                                <button
                                                    onClick={() =>
                                                        handleSyncServer(
                                                            server.id,
                                                            server.name,
                                                        )
                                                    }
                                                    className={cn(
                                                        getButtonClass(
                                                            "secondary",
                                                        ),
                                                        "flex-1 text-sm justify-start",
                                                    )}
                                                    title={`Actualizar estado desde Docker en ${server.name}`}
                                                >
                                                    <span className="mr-2">
                                                        🔄
                                                    </span>
                                                    {server.name}
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleGetServerStatus(
                                                            server.id,
                                                            server.name,
                                                        )
                                                    }
                                                    className={cn(
                                                        getButtonClass(
                                                            "secondary",
                                                        ),
                                                        "text-sm px-3",
                                                    )}
                                                    title={`Ver reporte detallado de Docker en ${server.name}`}
                                                >
                                                    <span>📊</span>
                                                </button>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className={getAlertClass("error")}>
                        <span className="mr-2">⚠️</span>
                        {error}
                    </div>
                )}

                {/* Grid de Contenedores con diseño moderno */}
                {!error && (
                    <div className="space-y-4">
                        {/* Header de la lista */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <h2 className="text-xl font-semibold text-primary">
                                    📦 Contenedores ({containers.length})
                                </h2>
                                {(serverFilter ||
                                    statusFilter ||
                                    publicFilter ||
                                    containerNameSearch) && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        Filtrado
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-muted">
                                Última actualización:{" "}
                                {new Date().toLocaleTimeString("es-ES")}
                            </div>
                        </div>

                        {containers.length === 0 ? (
                            <div className={getCardClass()}>
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                        <span className="text-5xl">📭</span>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-lg font-semibold text-primary">
                                            No se encontraron contenedores
                                        </p>
                                        <p className="text-sm text-muted">
                                            {serverFilter ||
                                            statusFilter ||
                                            publicFilter ||
                                            userIdFilter
                                                ? "Intenta ajustar los filtros de búsqueda"
                                                : "Crea tu primer contenedor para comenzar"}
                                        </p>
                                    </div>
                                    {(serverFilter ||
                                        statusFilter ||
                                        publicFilter ||
                                        containerNameSearch) && (
                                        <button
                                            onClick={handleClearFilters}
                                            className={getButtonClass(
                                                "secondary",
                                            )}
                                        >
                                            <span className="mr-2">✖️</span>
                                            Limpiar filtros
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {containers.map((container) => (
                                    <div
                                        key={container.id}
                                        className={cn(
                                            getCardClass(),
                                            "hover:shadow-lg transition-all duration-200 hover:scale-[1.01]",
                                        )}
                                    >
                                        {/* Header del contenedor */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-md">
                                                    <span className="text-2xl">
                                                        🐳
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-lg text-primary truncate">
                                                        {container.name}
                                                    </h3>
                                                    <div className="flex items-center flex-wrap gap-2 text-xs mt-1">
                                                        <span className="font-mono text-muted">
                                                            ID: {container.id}
                                                        </span>
                                                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-700">
                                                            <span>👤</span>
                                                            <span className="font-medium">
                                                                {container.username ||
                                                                    users.find(
                                                                        (u) =>
                                                                            u.id ===
                                                                            container.user_id,
                                                                    )
                                                                        ?.username ||
                                                                    `User ${container.user_id}`}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span
                                                className={cn(
                                                    getContainerStatusBadge(
                                                        container.status,
                                                    ),
                                                    "flex-shrink-0 ml-2",
                                                )}
                                            >
                                                {getStatusText(
                                                    container.status,
                                                )}
                                            </span>
                                        </div>

                                        {/* Información del contenedor */}
                                        <div className="space-y-3 mb-4">
                                            {/* Servidor */}
                                            <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                <span className="text-lg">
                                                    🖥️
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-muted">
                                                        Servidor
                                                    </div>
                                                    <div className="font-medium text-sm truncate">
                                                        {container.server_name}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Imagen */}
                                            <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                <span className="text-lg">
                                                    📦
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-muted">
                                                        Imagen Docker
                                                    </div>
                                                    <div className="font-mono text-xs truncate">
                                                        {container.image}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Puertos y Visibilidad */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                    <span className="text-lg">
                                                        🔌
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs text-muted">
                                                            Puertos
                                                        </div>
                                                        <div className="font-mono text-xs truncate">
                                                            {container.ports ||
                                                                "N/A"}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                    {container.is_public ? (
                                                        <>
                                                            <span className="text-lg">
                                                                🌐
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs text-muted">
                                                                    Visibilidad
                                                                </div>
                                                                <div className="text-xs font-medium text-green-600 dark:text-green-400">
                                                                    Público
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-lg">
                                                                🔒
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs text-muted">
                                                                    Visibilidad
                                                                </div>
                                                                <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                                    Privado
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Acciones */}
                                        <div className="flex gap-2 pt-3 border-t border-border dark:border-dark-border">
                                            {container.status === "stopped" ? (
                                                <button
                                                    onClick={() =>
                                                        handleStartContainer(
                                                            container.id,
                                                        )
                                                    }
                                                    className={cn(
                                                        getButtonClass(
                                                            "primary",
                                                        ),
                                                        "flex-1 bg-green-600 hover:bg-green-700 text-white",
                                                    )}
                                                    title="Iniciar contenedor"
                                                >
                                                    <span className="mr-2">
                                                        ▶️
                                                    </span>
                                                    Iniciar
                                                </button>
                                            ) : container.status ===
                                              "running" ? (
                                                <button
                                                    onClick={() =>
                                                        handleStopContainer(
                                                            container.id,
                                                        )
                                                    }
                                                    className={cn(
                                                        getButtonClass(
                                                            "secondary",
                                                        ),
                                                        "flex-1 bg-yellow-500 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700",
                                                    )}
                                                    title="Detener contenedor"
                                                >
                                                    <span className="mr-2">
                                                        ⏸️
                                                    </span>
                                                    Detener
                                                </button>
                                            ) : (
                                                <button
                                                    disabled
                                                    className={cn(
                                                        getButtonClass(
                                                            "secondary",
                                                        ),
                                                        "flex-1 opacity-50 cursor-not-allowed",
                                                    )}
                                                    title={`Estado: ${container.status}`}
                                                >
                                                    <span className="mr-2">
                                                        ⚙️
                                                    </span>
                                                    {container.status}
                                                </button>
                                            )}
                                            <button
                                                onClick={() =>
                                                    handleDeleteContainer(
                                                        container.id,
                                                        container.name,
                                                    )
                                                }
                                                className={cn(
                                                    getButtonClass("secondary"),
                                                    "bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800",
                                                )}
                                                title="Eliminar contenedor"
                                            >
                                                <span className="text-lg">
                                                    🗑️
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Modal de Creación */}
                <CreateContainerModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        fetchContainers();
                    }}
                />
            </div>
        </ProtectedRoute>
    );
}
