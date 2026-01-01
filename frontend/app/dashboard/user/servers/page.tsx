"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, authService } from "@/lib/api";
import { cn, getIconContainerClass, getSpinnerClass } from "@/lib/styles";

interface Server {
    id: number;
    name: string;
    ip_address: string;
    status: string;
    ssh_user: string;
    ssh_status: string;
}

export default function UserServersPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const verifyAuth = async () => {
            try {
                const response = await authService.verifyToken();
                if (!response.valid) {
                    router.push("/login");
                    return;
                }
                setCurrentUser(response);

                // Si es admin, podría redirigir al dashboard admin
                // pero los usuarios también pueden ver servidores
            } catch (error) {
                router.push("/login");
            } finally {
                setAuthLoading(false);
            }
        };

        verifyAuth();
    }, [router]);

    useEffect(() => {
        if (currentUser) {
            loadServers();
        }
    }, [currentUser]);

    const loadServers = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get("/servers/");
            setServers(response.data || []);
        } catch (error: any) {
            console.error("[UserServers] Error loading servers:", error);
            setError(error.response?.data?.detail || "Error al cargar servidores");
        } finally {
            setLoading(false);
        }
    };

    // Filter servers
    const filteredServers = servers.filter((server) => {
        // Status filter
        if (statusFilter === "online" && server.status !== "online") return false;
        if (statusFilter === "offline" && server.status !== "offline") return false;

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (
                server.name.toLowerCase().includes(search) ||
                server.ip_address.toLowerCase().includes(search)
            );
        }

        return true;
    });

    const onlineServers = servers.filter((s) => s.status === "online");
    const offlineServers = servers.filter((s) => s.status === "offline");

    if (authLoading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className={getSpinnerClass("lg")}></div>
                    <p className="mt-4 text-muted">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Servidores Disponibles</h1>
                    <p className="page-subtitle">
                        Consulta el estado de todos los servidores
                    </p>
                </div>
                <button onClick={loadServers} className="btn-secondary">
                    <svg
                        className="icon-sm mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    Actualizar
                </button>
            </div>

            {/* Stats */}
            <div className="grid-3-cols mb-6">
                <StatCard
                    title="Total de Servidores"
                    value={servers.length}
                    icon="server"
                    variant="primary"
                />
                <StatCard
                    title="Servidores Online"
                    value={onlineServers.length}
                    icon="online"
                    variant="success"
                />
                <StatCard
                    title="Servidores Offline"
                    value={offlineServers.length}
                    icon="offline"
                    variant="error"
                />
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <label className="form-label">Buscar servidor</label>
                        <input
                            type="text"
                            placeholder="Nombre o dirección IP..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input w-full"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="w-full md:w-48">
                        <label className="form-label">Estado</label>
                        <select
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(e.target.value as any)
                            }
                            className="input w-full"
                        >
                            <option value="all">Todos</option>
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                        </select>
                    </div>
                </div>

                {/* Active filters badge */}
                {(statusFilter !== "all" || searchTerm) && (
                    <div className="mt-4 flex items-center justify-between">
                        <span className="badge badge-info">
                            {filteredServers.length} servidor(es) encontrado(s)
                        </span>
                        <button
                            onClick={() => {
                                setStatusFilter("all");
                                setSearchTerm("");
                            }}
                            className="text-sm text-primary hover:text-primary-dark"
                        >
                            Limpiar filtros
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="card">
                    <div className="flex items-center justify-center py-12">
                        <div className={getSpinnerClass("lg")}></div>
                        <span className="ml-3 text-muted">Cargando servidores...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="alert alert-error">
                    <svg
                        className="icon-md flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <div>
                        <p className="font-semibold">Error</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            ) : filteredServers.length === 0 ? (
                <div className="card">
                    <div className="text-center py-12">
                        <div className={cn(getIconContainerClass("info"), "mx-auto mb-4")}>
                            <svg
                                className="icon-xl"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                                />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            No se encontraron servidores
                        </h3>
                        <p className="text-muted">
                            {searchTerm || statusFilter !== "all"
                                ? "Intenta ajustar los filtros"
                                : "No hay servidores registrados"}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredServers.map((server) => (
                        <ServerCard key={server.id} server={server} />
                    ))}
                </div>
            )}
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    variant,
}: {
    title: string;
    value: number;
    icon: string;
    variant: "primary" | "success" | "error" | "warning" | "info";
}) {
    const getIcon = (type: string) => {
        switch (type) {
            case "server":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                    />
                );
            case "online":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                );
            case "offline":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-muted mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {value}
                    </p>
                </div>
                <div className={getIconContainerClass(variant)}>
                    <svg
                        className="icon-lg"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        {getIcon(icon)}
                    </svg>
                </div>
            </div>
        </div>
    );
}

function ServerCard({ server }: { server: Server }) {
    const isOnline = server.status === "online";
    const sshDeployed = server.ssh_status === "deployed";

    return (
        <div className="card">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                    <div
                        className={cn(
                            getIconContainerClass(isOnline ? "success" : "error"),
                            "flex-shrink-0",
                        )}
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
                                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                            />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
                            {server.name}
                        </h3>
                        <p className="text-sm text-muted truncate">
                            {server.ip_address}
                        </p>
                    </div>
                </div>
                <span
                    className={cn(
                        "badge flex-shrink-0",
                        isOnline ? "badge-success" : "badge-error",
                    )}
                >
                    {isOnline ? "Online" : "Offline"}
                </span>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Usuario SSH:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                        {server.ssh_user}
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">SSH Status:</span>
                    <span
                        className={cn(
                            "badge badge-sm",
                            sshDeployed
                                ? "badge-success"
                                : server.ssh_status === "pending"
                                  ? "badge-warning"
                                  : "badge-error",
                        )}
                    >
                        {server.ssh_status || "unknown"}
                    </span>
                </div>
            </div>

            {isOnline && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center text-sm text-success">
                        <svg
                            className="icon-sm mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        Disponible para crear contenedores
                    </div>
                </div>
            )}

            {!isOnline && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center text-sm text-error">
                        <svg
                            className="icon-sm mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        Servidor no disponible
                    </div>
                </div>
            )}
        </div>
    );
}
