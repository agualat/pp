"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, authService } from "@/lib/api";
import { cn, getIconContainerClass, getSpinnerClass } from "@/lib/styles";

export default function UserDashboardPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [stats, setStats] = useState({
        totalServers: 0,
        onlineServers: 0,
        myContainers: 0,
        runningContainers: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const verifyAuth = async () => {
            try {
                const response = await authService.verifyToken();
                if (!response.valid) {
                    router.push("/login");
                    return;
                }
                setCurrentUser(response);

                // Si es admin, redirigir al dashboard admin
                if (response.is_admin === 1) {
                    router.push("/dashboard");
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
        if (currentUser && currentUser.is_admin !== 1) {
            loadStats();
        }
    }, [currentUser]);

    const loadStats = async () => {
        try {
            // Obtener servidores
            const serversResponse = await api.get("/servers/");
            const servers = serversResponse.data || [];
            const onlineServers = servers.filter(
                (s: any) => s.status === "online",
            );

            // Obtener contenedores del usuario
            const containersResponse = await api.get("/containers/my");
            const myContainers = containersResponse.data || [];
            const runningContainers = myContainers.filter(
                (c: any) => c.status === "running",
            );

            setStats({
                totalServers: servers.length,
                onlineServers: onlineServers.length,
                myContainers: myContainers.length,
                runningContainers: runningContainers.length,
            });
        } catch (error) {
            console.error("[UserDashboard] Error loading stats:", error);
            // Mantener valores por defecto en caso de error
            setStats({
                totalServers: 0,
                onlineServers: 0,
                myContainers: 0,
                runningContainers: 0,
            });
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
                            : "Cargando dashboard..."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        Bienvenido, {currentUser?.username}
                    </h1>
                    <p className="page-subtitle">
                        Gestiona tus contenedores y recursos
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid-2-cols mb-8">
                <StatCard
                    title="Servidores Disponibles"
                    value={stats.onlineServers}
                    total={stats.totalServers}
                    icon="server"
                    variant="primary"
                />
                <StatCard
                    title="Mis Contenedores"
                    value={stats.myContainers}
                    icon="container"
                    variant="success"
                />
                <StatCard
                    title="Contenedores Activos"
                    value={stats.runningContainers}
                    icon="running"
                    variant="warning"
                />
                <StatCard
                    title="Límite por Servidor"
                    value={1}
                    icon="limit"
                    variant="info"
                />
            </div>

            {/* Quick Actions */}
            <div className="card">
                <h2 className="section-header">Acciones Rápidas</h2>
                <div className="grid-3-cols">
                    <QuickAction
                        href="/dashboard/user/servers"
                        icon="server"
                        title="Ver Servidores"
                        description="Consulta el estado de los servidores"
                    />
                    <QuickAction
                        href="/dashboard/user/my-containers"
                        icon="container"
                        title="Mis Contenedores"
                        description="Gestiona tus contenedores Docker"
                    />
                    <QuickAction
                        href="/dashboard/user/public-containers"
                        icon="public"
                        title="Contenedores Públicos"
                        description="Explora contenedores disponibles"
                    />
                </div>
            </div>

            {/* Info Card */}
            <div className="card mt-6">
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
                            💡 Información Importante
                        </h3>
                        <ul className="text-sm text-muted space-y-1">
                            <li>
                                • Puedes crear hasta{" "}
                                <strong>1 contenedor por servidor</strong> a la
                                vez
                            </li>
                            <li>
                                • Los contenedores públicos pueden ser usados
                                como plantillas
                            </li>
                            <li>
                                • Asegúrate de liberar recursos cuando no los
                                uses
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    total,
    icon,
    variant,
}: {
    title: string;
    value: number;
    total?: number;
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
            case "container":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                );
            case "running":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                );
            case "limit":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
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
                        {total !== undefined && (
                            <span className="text-lg text-muted ml-1">
                                / {total}
                            </span>
                        )}
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

function QuickAction({
    href,
    icon,
    title,
    description,
}: {
    href: string;
    icon: string;
    title: string;
    description: string;
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
            case "container":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                );
            case "public":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                );
            default:
                return null;
        }
    };

    return (
        <a href={href} className="card-hover">
            <div className="flex items-start space-x-3">
                <div
                    className={cn(
                        getIconContainerClass("primary"),
                        "flex-shrink-0",
                    )}
                >
                    <svg
                        className="icon-md"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        {getIcon(icon)}
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {title}
                    </h3>
                    <p className="text-sm text-muted">{description}</p>
                </div>
            </div>
        </a>
    );
}
