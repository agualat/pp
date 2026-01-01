"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    executionsService,
    Execution,
    playbooksService,
    Playbook,
    serversService,
    Server,
} from "@/lib/services";
import {
    cn,
    getExecutionStateClass,
    getServerStatusClass,
    getSpinnerClass,
    getButtonClass,
    getIconContainerClass,
} from "@/lib/styles";

export default function ExecutionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const executionId = parseInt(params.id as string);

    const [execution, setExecution] = useState<Execution | null>(null);
    const [playbook, setPlaybook] = useState<Playbook | null>(null);
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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
            const playbookData = await playbooksService.getById(
                executionData.playbook_id,
            );
            setPlaybook(playbookData);

            // Cargar información de servidores
            const serversData = await Promise.all(
                executionData.servers.map((sid) => serversService.getById(sid)),
            );
            setServers(serversData);

            setError("");
        } catch (error: any) {
            console.error("Error loading execution data:", error);
            setError(
                error.response?.data?.detail ||
                    "Error al cargar los datos de la ejecución",
            );
        } finally {
            setLoading(false);
        }
    };

    const getStateLabel = (state: string) => {
        switch (state) {
            case "dry":
                return "Pendiente";
            case "running":
                return "Ejecutando";
            case "success":
                return "Exitoso";
            case "failed":
            case "error":
                return "Fallido";
            default:
                return state;
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className={getSpinnerClass("lg")}></div>
                    <p className="mt-4 text-muted">
                        Cargando detalles de ejecución...
                    </p>
                </div>
            </div>
        );
    }

    if (!execution) {
        return (
            <div className="empty-state">
                <svg
                    className="empty-state-icon text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
                <h3 className="empty-state-title">Ejecución no encontrada</h3>
                {error && (
                    <p className="empty-state-description text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}
                <button
                    onClick={() => router.push("/dashboard/executions")}
                    className={getButtonClass("primary")}
                >
                    Volver a Ejecuciones
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <button
                        onClick={() => router.push("/dashboard/executions")}
                        className="btn-back mb-4"
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
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                        </svg>
                        Volver
                    </button>
                    <div className="flex items-center space-x-4">
                        <h1 className="page-title">
                            Ejecución #{execution.id}
                        </h1>
                        <div className="flex items-center">
                            <span
                                className={cn(
                                    "h-3 w-3 rounded-full mr-2",
                                    execution.state === "success" &&
                                        "bg-green-500 shadow-lg shadow-green-500/50",
                                    (execution.state === "failed" ||
                                        execution.state === "error") &&
                                        "bg-red-500 shadow-lg shadow-red-500/50",
                                    execution.state === "running" &&
                                        "bg-yellow-500 shadow-lg shadow-yellow-500/50 animate-pulse",
                                    execution.state === "dry" &&
                                        "bg-gray-400 dark:bg-gray-500",
                                )}
                            ></span>
                            <span
                                className={cn(
                                    "text-sm font-medium",
                                    execution.state === "success" &&
                                        "text-green-700 dark:text-green-400",
                                    (execution.state === "failed" ||
                                        execution.state === "error") &&
                                        "text-red-700 dark:text-red-400",
                                    execution.state === "running" &&
                                        "text-yellow-700 dark:text-yellow-400",
                                    execution.state === "dry" &&
                                        "text-gray-700 dark:text-gray-400",
                                )}
                            >
                                {getStateLabel(execution.state)}
                            </span>
                        </div>
                    </div>
                    <p className="page-subtitle">
                        Ejecutado el{" "}
                        {new Date(execution.executed_at).toLocaleString(
                            "es-ES",
                            {
                                dateStyle: "long",
                                timeStyle: "short",
                            },
                        )}
                    </p>
                </div>
                <button
                    onClick={loadExecutionData}
                    className={cn(
                        getButtonClass("secondary"),
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
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    <span>Actualizar</span>
                </button>
            </div>

            {/* Error message */}
            {error && (
                <div className="alert alert-error mb-6">
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
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <span>{error}</span>
                    <button
                        onClick={() => setError("")}
                        className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200"
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* ID Card */}
                <div className="stat-card stat-card-primary">
                    <div className="stat-card-content">
                        <div>
                            <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mb-1">
                                ID Ejecución
                            </p>
                            <p className="text-3xl font-bold text-primary-700 dark:text-primary-300">
                                #{execution.id}
                            </p>
                        </div>
                        <div className={getIconContainerClass("primary")}>
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
                                    d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* User Card */}
                <div className="stat-card stat-card-info">
                    <div className="stat-card-content">
                        <div>
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
                                Usuario
                            </p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 truncate">
                                {execution.user_username ||
                                    `User #${execution.user_id}`}
                            </p>
                        </div>
                        <div className={getIconContainerClass("info")}>
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
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Servers Card */}
                <div className="stat-card stat-card-warning">
                    <div className="stat-card-content">
                        <div>
                            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">
                                Servidores
                            </p>
                            <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                                {execution.servers.length}
                            </p>
                        </div>
                        <div className={getIconContainerClass("warning")}>
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
                                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Playbook Card */}
                <div className="stat-card stat-card-success">
                    <div className="stat-card-content">
                        <div>
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">
                                Playbook ID
                            </p>
                            <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                                #{execution.playbook_id}
                            </p>
                        </div>
                        <div className={getIconContainerClass("success")}>
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
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Playbook Details */}
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center space-x-3">
                            <div className={getIconContainerClass("primary")}>
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
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                            </div>
                            <h2 className="card-title">Playbook</h2>
                        </div>
                    </div>
                    {playbook ? (
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Nombre
                                </label>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">
                                    {playbook.name}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    ID
                                </label>
                                <p className="text-base font-mono font-semibold text-gray-900 dark:text-white">
                                    #{playbook.id}
                                </p>
                            </div>
                            {playbook.description && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                        Descripción
                                    </label>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        {playbook.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-6">
                            <p className="text-muted text-sm">
                                No se pudo cargar la información del playbook
                            </p>
                        </div>
                    )}
                </div>

                {/* Execution Info */}
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center space-x-3">
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
                            <h2 className="card-title">Detalles</h2>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Fecha de Ejecución
                            </label>
                            <p className="text-sm text-gray-900 dark:text-white">
                                {new Date(execution.executed_at).toLocaleString(
                                    "es-ES",
                                    {
                                        dateStyle: "full",
                                        timeStyle: "short",
                                    },
                                )}
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Usuario
                            </label>
                            <p className="text-sm text-gray-900 dark:text-white">
                                {execution.user_username ||
                                    `User #${execution.user_id}`}
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Servidores Objetivo
                            </label>
                            <p className="text-sm text-gray-900 dark:text-white">
                                {execution.servers.length}{" "}
                                {execution.servers.length === 1
                                    ? "servidor"
                                    : "servidores"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Servers List */}
            <div className="card mb-6">
                <div className="card-header">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={getIconContainerClass("warning")}>
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
                            <h2 className="card-title">Servidores Objetivo</h2>
                        </div>
                        <span className="badge badge-primary">
                            {servers.length}
                        </span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead className="table-header">
                            <tr>
                                <th className="table-header-cell">Nombre</th>
                                <th className="table-header-cell">IP</th>
                                <th className="table-header-cell">
                                    Usuario SSH
                                </th>
                                <th className="table-header-cell">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="table-body">
                            {servers.map((server) => (
                                <tr
                                    key={server.id}
                                    className="table-row cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    onClick={() =>
                                        router.push(
                                            `/dashboard/servers/${server.id}`,
                                        )
                                    }
                                >
                                    <td className="table-cell py-3">
                                        <div className="flex items-center">
                                            <span
                                                className={cn(
                                                    "h-2 w-2 rounded-full mr-2",
                                                    server.status === "online"
                                                        ? "bg-green-500 shadow-lg shadow-green-500/50"
                                                        : "bg-red-500 shadow-lg shadow-red-500/50",
                                                )}
                                            ></span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {server.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="table-cell py-3">
                                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                                            {server.ip}
                                        </span>
                                    </td>
                                    <td className="table-cell py-3">
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            {server.ssh_user}
                                        </span>
                                    </td>
                                    <td className="table-cell py-3">
                                        <span
                                            className={cn(
                                                "badge inline-flex items-center",
                                                server.status === "online"
                                                    ? "badge-success"
                                                    : "badge-error",
                                            )}
                                        >
                                            {server.status === "online"
                                                ? "Online"
                                                : "Offline"}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
