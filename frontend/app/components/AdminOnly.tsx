"use client";

interface AdminOnlyProps {
    children: React.ReactNode;
    user: any;
    fallback?: React.ReactNode;
}

export default function AdminOnly({
    children,
    user,
    fallback = null,
}: AdminOnlyProps) {
    // Si el usuario no es admin, mostrar fallback o nada
    if (!user || user.is_admin !== 1) {
        return <>{fallback}</>;
    }

    // Si es admin, mostrar el contenido
    return <>{children}</>;
}
