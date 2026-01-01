"use client";

import { useEffect } from "react";

export interface ToastProps {
    id: string;
    type: "success" | "error" | "info" | "warning";
    message: string;
    duration?: number;
    onClose: (id: string) => void;
}

export default function Toast({
    id,
    type,
    message,
    duration = 5000,
    onClose,
}: ToastProps) {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose(id);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [id, duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case "success":
                return (
                    <svg
                        className="w-5 h-5 text-green-600 dark:text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                );
            case "error":
                return (
                    <svg
                        className="w-5 h-5 text-red-600 dark:text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                );
            case "warning":
                return (
                    <svg
                        className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
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
                );
            case "info":
                return (
                    <svg
                        className="w-5 h-5 text-blue-600 dark:text-blue-400"
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
                );
        }
    };

    const getBackgroundClass = () => {
        switch (type) {
            case "success":
                return "bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700";
            case "error":
                return "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700";
            case "warning":
                return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-700";
            case "info":
                return "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700";
        }
    };

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 shadow-lg animate-slide-in ${getBackgroundClass()}`}
        >
            {getIcon()}
            <p className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                {message}
            </p>
            <button
                onClick={() => onClose(id)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
                <svg
                    className="w-5 h-5"
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
    );
}
