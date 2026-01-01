"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/api";
import { api } from "@/lib/api";
import {
    cn,
    getButtonClass,
    getAlertClass,
    getSpinnerClass,
} from "@/lib/styles";

export default function UserProfilePage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form data para información personal
    const [profileData, setProfileData] = useState({
        username: "",
        email: "",
    });

    // Form data para cambio de contraseña
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

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
                setProfileData({
                    username: response.username || "",
                    email: response.email || "",
                });
            } catch (error) {
                router.push("/login");
            } finally {
                setAuthLoading(false);
            }
        };

        verifyAuth();
    }, [router]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            await api.put(`/users/${currentUser.user_id}`, {
                username: profileData.username,
                email: profileData.email,
            });

            setSuccess("Perfil actualizado correctamente");

            // Actualizar datos locales
            setCurrentUser({
                ...currentUser,
                username: profileData.username,
                email: profileData.email,
            });
        } catch (err: any) {
            console.error("Error updating profile:", err);
            setError(
                err.response?.data?.detail ||
                    "Error al actualizar el perfil. Intenta de nuevo.",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        // Validar que las contraseñas coincidan
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setError("Las contraseñas nuevas no coinciden");
            return;
        }

        // Validar longitud mínima
        if (passwordData.newPassword.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setLoading(true);

        try {
            await api.post(`/users/${currentUser.user_id}/change-password`, {
                current_password: passwordData.currentPassword,
                new_password: passwordData.newPassword,
            });

            setSuccess("Contraseña cambiada correctamente");
            setPasswordData({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
        } catch (err: any) {
            console.error("Error changing password:", err);
            setError(
                err.response?.data?.detail ||
                    "Error al cambiar la contraseña. Verifica tu contraseña actual.",
            );
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className={getSpinnerClass("lg")}></div>
                    <p className="mt-4 text-muted">Cargando perfil...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Mi Perfil</h1>
                    <p className="page-subtitle">
                        Actualiza tu información personal y contraseña
                    </p>
                </div>
            </div>

            {/* Mensajes de error/éxito globales */}
            {error && (
                <div className={cn(getAlertClass("error"), "mb-6")}>
                    <span>{error}</span>
                    <button
                        onClick={() => setError("")}
                        className="text-red-700 hover:text-red-900 dark:text-red-300"
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

            {success && (
                <div className={cn(getAlertClass("success"), "mb-6")}>
                    <span>{success}</span>
                    <button
                        onClick={() => setSuccess("")}
                        className="text-green-700 hover:text-green-900 dark:text-green-300"
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

            {/* Información Personal */}
            <div className="card mb-6">
                <h2 className="section-header">Información Personal</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="form-group">
                        <label htmlFor="username" className="label">
                            Nombre de Usuario
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={profileData.username}
                            onChange={(e) =>
                                setProfileData({
                                    ...profileData,
                                    username: e.target.value,
                                })
                            }
                            className="input"
                            placeholder="usuario123"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email" className="label">
                            Correo Electrónico
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={profileData.email}
                            onChange={(e) =>
                                setProfileData({
                                    ...profileData,
                                    email: e.target.value,
                                })
                            }
                            className="input"
                            placeholder="usuario@ejemplo.com"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className={getButtonClass("primary")}
                        >
                            {loading ? (
                                <>
                                    <div
                                        className={cn(
                                            getSpinnerClass("sm"),
                                            "mr-2 inline-block",
                                        )}
                                    ></div>
                                    Guardando...
                                </>
                            ) : (
                                "Guardar Cambios"
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Cambio de Contraseña */}
            <div className="card">
                <h2 className="section-header">Cambiar Contraseña</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="form-group">
                        <label htmlFor="currentPassword" className="label">
                            Contraseña Actual
                        </label>
                        <input
                            id="currentPassword"
                            type="password"
                            value={passwordData.currentPassword}
                            onChange={(e) =>
                                setPasswordData({
                                    ...passwordData,
                                    currentPassword: e.target.value,
                                })
                            }
                            className="input"
                            placeholder="••••••••"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="newPassword" className="label">
                            Nueva Contraseña
                        </label>
                        <input
                            id="newPassword"
                            type="password"
                            value={passwordData.newPassword}
                            onChange={(e) =>
                                setPasswordData({
                                    ...passwordData,
                                    newPassword: e.target.value,
                                })
                            }
                            className="input"
                            placeholder="••••••••"
                            required
                            minLength={6}
                            disabled={loading}
                        />
                        <p className="text-xs text-muted mt-1">
                            Mínimo 6 caracteres
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword" className="label">
                            Confirmar Nueva Contraseña
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={passwordData.confirmPassword}
                            onChange={(e) =>
                                setPasswordData({
                                    ...passwordData,
                                    confirmPassword: e.target.value,
                                })
                            }
                            className="input"
                            placeholder="••••••••"
                            required
                            minLength={6}
                            disabled={loading}
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className={getButtonClass("primary")}
                        >
                            {loading ? (
                                <>
                                    <div
                                        className={cn(
                                            getSpinnerClass("sm"),
                                            "mr-2 inline-block",
                                        )}
                                    ></div>
                                    Cambiando...
                                </>
                            ) : (
                                "Cambiar Contraseña"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
