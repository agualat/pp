"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService } from "@/lib/api";

interface User {
    user_id: number;
    username: string;
    email: string;
    is_admin: number;
    valid: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    setUser: (user: User | null) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);

    const refreshUser = async () => {
        try {
            const response = await authService.verifyToken();
            if (!response.valid) {
                // Solo redirigir si no estamos en páginas públicas
                if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
                    router.push("/login");
                }
                setUser(null);
                return;
            }
            setUser(response);
        } catch (error) {
            console.error("Error verifying auth:", error);
            // Solo redirigir si no estamos en páginas públicas
            if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
                router.push("/login");
            }
            setUser(null);
        } finally {
            setLoading(false);
            setInitialLoad(false);
        }
    };

    useEffect(() => {
        // Solo verificar si estamos en una ruta protegida
        if (pathname.startsWith("/dashboard")) {
            refreshUser();
        } else {
            setLoading(false);
            setInitialLoad(false);
        }
    }, []);

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading: initialLoad ? loading : false, // Después de la carga inicial, no mostrar loading en navegación
                setUser,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
