"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    serversService,
    playbooksService,
    executionsService,
} from "@/lib/services";
import { authService } from "@/lib/api";
import { cn, getIconContainerClass, getSpinnerClass } from "@/lib/styles";

export default function DashboardPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [stats, setStats] = useState({
        totalServers: 0,
        onlineServers: 0,
        offlineServers: 0,
        totalPlaybooks: 0,
        totalExecutions: 0,
        successExecutions: 0,
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

                // Si NO es admin, redirigir al dashboard de usuario
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
            loadStats();
        }
    }, [currentUser]);

    const loadStats = async () => {
        try {
            console.log("[Dashboard] Loading stats...");

            const [
                totalServers,
                onlineServers,
                offlineServers,
                totalPlaybooks,
                totalExecutions,
                successExecutions,
            ] = await Promise.all([
                serversService.countTotal(),
                serversService.countByStatus("online"),
                serversService.countByStatus("offline"),
                playbooksService.count(),
                executionsService.countTotal(),
                executionsService.countByState("success"),
            ]);

            console.log("[Dashboard] Raw responses:", {
                totalServers,
                onlineServers,
                offlineServers,
                totalPlaybooks,
                totalExecutions,
                successExecutions,
            });

            setStats({
                totalServers: totalServers?.count ?? 0,
                onlineServers: onlineServers?.count ?? 0,
                offlineServers: offlineServers?.count ?? 0,
                totalPlaybooks: totalPlaybooks?.count ?? 0,
                totalExecutions: totalExecutions?.count ?? 0,
                successExecutions: successExecutions?.count ?? 0,
            });

            console.log("[Dashboard] Stats set successfully");
        } catch (error) {
            console.error("[Dashboard] Error loading stats:", error);
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
                            : "Cargando estadísticas..."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-subtitle">Resumen general del sistema</p>
            </div>

            {/* Stats Grid */}
            <div className="grid-3-cols mb-8">
                <StatCard
                    title="Total Servidores"
                    value={stats.totalServers}
                    icon="server"
                    variant="primary"
                />
                <StatCard
                    title="Servidores Online"
                    value={stats.onlineServers}
                    icon="online"
                    variant="success"
                />
                <StatCard
                    title="Servidores Offline"
                    value={stats.offlineServers}
                    icon="offline"
                    variant="error"
                />
                <StatCard
                    title="Total Playbooks"
                    value={stats.totalPlaybooks}
                    icon="playbook"
                    variant="primary"
                />
                <StatCard
                    title="Total Ejecuciones"
                    value={stats.totalExecutions}
                    icon="executions"
                    variant="warning"
                />
                <StatCard
                    title="Ejecuciones Exitosas"
                    value={stats.successExecutions}
                    icon="success"
                    variant="success"
                />
            </div>

            {/* Quick Actions */}
            <div className="card">
                <h2 className="section-header">Acciones Rápidas</h2>
                <div className="grid-3-cols">
                    <QuickAction
                        href="/dashboard/servers"
                        icon="server"
                        title="Ver Servidores"
                        description="Administrar servidores del sistema"
                    />
                    <QuickAction
                        href="/dashboard/playbooks"
                        icon="playbook"
                        title="Ver Playbooks"
                        description="Gestionar playbooks de Ansible"
                    />
                    <QuickAction
                        href="/dashboard/executions"
                        icon="history"
                        title="Ver Historial"
                        description="Revisar ejecuciones pasadas"
                    />
                </div>
            </div>
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
    variant: "primary" | "success" | "error" | "warning";
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
            case "playbook":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                );
            case "executions":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                );
            case "success":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
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
            case "playbook":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                );
            case "history":
                return (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
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
