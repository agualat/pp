"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
    children: React.ReactNode;
    user: any;
    requireAdmin?: boolean;
    loading?: boolean;
}

export default function ProtectedRoute({
    children,
    user,
    requireAdmin = false,
    loading = false,
}: ProtectedRouteProps) {
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            // Si no hay usuario, redirigir a login
            if (!user) {
                router.push("/login");
                return;
            }

            // Si requiere admin y el usuario no es admin, redirigir a dashboard
            if (requireAdmin && user.is_admin !== 1) {
                router.push("/dashboard");
                return;
            }
        }
    }, [user, requireAdmin, loading, router]);

    // Mientras carga, mostrar loading
    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="spinner spinner-lg"></div>
                    <p className="mt-4 text-muted">Verificando permisos...</p>
                </div>
            </div>
        );
    }

    // Si no hay usuario, no mostrar nada (se está redirigiendo)
    if (!user) {
        return null;
    }

    // Si requiere admin y no es admin, no mostrar nada (se está redirigiendo)
    if (requireAdmin && user.is_admin !== 1) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="alert alert-error max-w-md">
                        <div className="text-center">
                            <h3 className="font-semibold mb-2">Acceso Denegado</h3>
                            <p className="text-sm">No tienes permisos de administrador para acceder a esta página.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Si todo está bien, mostrar el contenido
    return <>{children}</>;
}
