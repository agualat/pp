"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import Toast, { ToastProps } from "../components/Toast";

interface ToastContextType {
    showToast: (
        type: "success" | "error" | "info" | "warning",
        message: string,
        duration?: number,
    ) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<
        Array<Omit<ToastProps, "onClose">>
    >([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback(
        (
            type: "success" | "error" | "info" | "warning",
            message: string,
            duration: number = 5000,
        ) => {
            const id = Math.random().toString(36).substring(7);
            setToasts((prev) => [...prev, { id, type, message, duration }]);
        },
        [],
    );

    const success = useCallback(
        (message: string, duration?: number) => {
            showToast("success", message, duration);
        },
        [showToast],
    );

    const error = useCallback(
        (message: string, duration?: number) => {
            showToast("error", message, duration);
        },
        [showToast],
    );

    const info = useCallback(
        (message: string, duration?: number) => {
            showToast("info", message, duration);
        },
        [showToast],
    );

    const warning = useCallback(
        (message: string, duration?: number) => {
            showToast("warning", message, duration);
        },
        [showToast],
    );

    return (
        <ToastContext.Provider
            value={{ showToast, success, error, info, warning }}
        >
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
                {toasts.map((toast) => (
                    <Toast
                        key={toast.id}
                        {...toast}
                        onClose={removeToast}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
