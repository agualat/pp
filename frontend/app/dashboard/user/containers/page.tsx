"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService, api } from "@/lib/api";
import CreateContainerModal from "@/app/components/CreateContainerModal";
import {
    cn,
    getButtonClass,
    getAlertClass,
    getSpinnerClass,
    getIconContainerClass,
} from "@/lib/styles";

interface Container {
    id: number;
    name: string;
    server_id: number;
    server_name: string;
    image: string;
    status: string;
    ports: string;
    created_at: string;
}

export default function UserContainersPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [containers, setContainers] = useState<Container[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        const verifyAuth = async () => {
            try {
                const response = await authService.verifyToken();
                if (!response.valid) {
                    router.push("/login");
                    return;
                }

                // Si es admin, redirigir al dashboard admin
                if (response.is_admin === 1) {
                    router.push("/dashboard");
                    return;
                }

                setCurrentUser(response);
            } catch (error) {
                router.push("/login");
            } finally {
                setAuthLoading(false);
            }
        };

        verifyAuth();
    }, [router]);

    useEffect(() => {
        if (currentUser && currentUser.is_admin !== 1) {
            loadContainers();
        }
    }, [currentUser]);

    const loadContainers = async () => {
        try {
            setLoading(true);
            // TODO: Implementar endpoint en backend
            // const response = await api.get('/containers/my');
            // setContainers(response.data);

            // Por ahora, datos de ejemplo
            setContainers([]);
        } catch (error) {
            console.error("Error loading containers:", error);
            setError("Error al cargar contenedores");
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className={getSpinnerClass("lg")}></div>
                    <p className="mt-4 text-muted">
                        {authLoading
                            ? "Verificando sesión..."
                            : "Cargando contenedores..."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Mis Contenedores</h1>
                    <p className="page-subtitle">
                        Gestiona tus contenedores Docker
                    </p>
                </div>

                <button
                    onClick={() => setShowCreateModal(true)}
                    className={cn(
                        getButtonClass("primary"),
                        "flex items-center",
                    )}
                >
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
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    Crear Contenedor
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

            {/* Info Card */}
            <div className="card mb-6">
                <div className="flex items-start space-x-3">
                    <div className={getIconContainerClass("info")}>
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
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            📦 Información sobre Contenedores
                        </h3>
                        <ul className="text-sm text-muted space-y-1">
                            <li>
                                • Puedes crear{" "}
                                <strong>
                                    máximo 1 contenedor por servidor
                                </strong>
                            </li>
                            <li>
                                • Los contenedores se ejecutan en servidores
                                disponibles
                            </li>
                            <li>
                                • Asegúrate de detener contenedores cuando no
                                los uses
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Containers List */}
            {containers.length === 0 ? (
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
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                    </svg>
                    <h3 className="empty-state-title">
                        No tienes contenedores
                    </h3>
                    <p className="empty-state-description">
                        Comienza creando tu primer contenedor Docker
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className={getButtonClass("primary")}
                    >
                        Crear Contenedor
                    </button>
                </div>
            ) : (
                <div className="grid-3-cols">
                    {containers.map((container) => (
                        <ContainerCard
                            key={container.id}
                            container={container}
                            onRefresh={loadContainers}
                        />
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <CreateContainerModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    setShowCreateModal(false);
                    loadContainers();
                }}
            />
        </div>
    );
}

function ContainerCard({
    container,
    onRefresh,
}: {
    container: Container;
    onRefresh: () => void;
}) {
    const [loading, setLoading] = useState(false);

    const handleStart = async () => {
        setLoading(true);
        try {
            // TODO: Implementar endpoint
            // await api.post(`/containers/${container.id}/start`);
            onRefresh();
        } catch (error) {
            console.error("Error starting container:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        setLoading(true);
        try {
            // TODO: Implementar endpoint
            // await api.post(`/containers/${container.id}/stop`);
            onRefresh();
        } catch (error) {
            console.error("Error stopping container:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (
            !confirm("¿Estás seguro de que quieres eliminar este contenedor?")
        ) {
            return;
        }

        setLoading(true);
        try {
            // TODO: Implementar endpoint
            // await api.delete(`/containers/${container.id}`);
            onRefresh();
        } catch (error) {
            console.error("Error deleting container:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        {container.name}
                    </h3>
                    <p className="text-sm text-muted">{container.image}</p>
                </div>
                <span
                    className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                        container.status === "running"
                            ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700"
                            : "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600",
                    )}
                >
                    {container.status === "running" ? "Activo" : "Detenido"}
                </span>
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm">
                    <svg
                        className="icon-sm mr-2 text-muted"
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
                    <span className="text-muted">{container.server_name}</span>
                </div>
                <div className="flex items-center text-sm">
                    <svg
                        className="icon-sm mr-2 text-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                    <span className="text-muted">
                        Puertos: {container.ports || "N/A"}
                    </span>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                {container.status === "running" ? (
                    <button
                        onClick={handleStop}
                        disabled={loading}
                        className={cn(
                            getButtonClass("secondary"),
                            "flex-1 text-sm",
                        )}
                    >
                        Detener
                    </button>
                ) : (
                    <button
                        onClick={handleStart}
                        disabled={loading}
                        className={cn(
                            getButtonClass("primary"),
                            "flex-1 text-sm",
                        )}
                    >
                        Iniciar
                    </button>
                )}
                <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2"
                    title="Eliminar"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}
