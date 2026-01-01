"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { authService } from "@/lib/api";
import { useRouter } from "next/navigation";

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    is_admin: number;
    is_active: number;
    valid?: boolean;
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isAdmin: boolean;
    isAuthenticated: boolean;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

export function useRequireAuth(requireAdmin: boolean = false) {
    const router = useRouter();
    const { user, loading, isAdmin, isAuthenticated } = useAuth();

    useEffect(() => {
        if (!loading) {
            if (!isAuthenticated) {
                router.push("/login");
            } else if (requireAdmin && !isAdmin) {
                router.push("/dashboard");
            }
        }
    }, [loading, isAuthenticated, isAdmin, requireAdmin, router]);

    return { user, loading, isAdmin, isAuthenticated };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const refreshUser = async () => {
        try {
            const response = await authService.verifyToken();
            if (!response.valid) {
                setUser(null);
                router.push("/login");
                return;
            }
            setUser(response);
        } catch (error) {
            setUser(null);
            router.push("/login");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    const value: AuthContextType = {
        user,
        loading,
        isAdmin: user?.is_admin === 1,
        isAuthenticated: !!user,
        logout,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
