"use client";

import { useState } from "react";

interface InfoDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    type?: "success" | "info" | "warning";
    copyText?: string;
}

export default function InfoDialog({
    isOpen,
    title,
    message,
    onClose,
    type = "info",
    copyText,
}: InfoDialogProps) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case "success":
                return (
                    <svg
                        className="w-6 h-6 text-green-600 dark:text-green-400"
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
            case "warning":
                return (
                    <svg
                        className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
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
                        className="w-6 h-6 text-blue-600 dark:text-blue-400"
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

    const handleCopy = async () => {
        if (copyText && navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(copyText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error("Failed to copy:", err);
            }
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content animate-fade-in max-w-2xl w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">{getIcon()}</div>
                    <div className="flex-1 min-w-0">
                        <h3 className="modal-title mb-2">{title}</h3>
                        <p className="text-sm text-muted whitespace-pre-wrap">
                            {message}
                        </p>
                        {copyText && (
                            <div className="mt-4">
                                <div className="relative group">
                                    {/* Command box with better scrolling */}
                                    <div className="p-3 sm:p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md">
                                        <div className="overflow-x-auto overflow-y-hidden">
                                            <code className="text-xs sm:text-sm font-mono text-gray-900 dark:text-gray-100 block whitespace-nowrap select-all">
                                                {copyText}
                                            </code>
                                        </div>
                                        {/* Scroll indicator */}
                                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                                <svg
                                                    className="w-3 h-3"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                                                    />
                                                </svg>
                                                <span className="hidden sm:inline">
                                                    scroll
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile-friendly note */}
                                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        <svg
                                            className="w-4 h-4 flex-shrink-0"
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
                                        <span>
                                            Desliza horizontalmente para ver el
                                            comando completo
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="modal-footer flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                    {copyText && (
                        <button
                            onClick={handleCopy}
                            disabled={copied}
                            className={`btn ${
                                copied
                                    ? "btn-success cursor-not-allowed"
                                    : "btn-secondary hover:scale-105"
                            } flex items-center justify-center gap-2 w-full sm:w-auto transition-all duration-200`}
                        >
                            {copied ? (
                                <>
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    ¡Copiado!
                                </>
                            ) : (
                                <>
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                        />
                                    </svg>
                                    Copiar Comando
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="btn btn-primary w-full sm:w-auto hover:scale-105 transition-transform"
                    >
                        {copyText ? "Cerrar" : "Entendido"}
                    </button>
                </div>
            </div>
        </div>
    );
}
