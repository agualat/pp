"use client";

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

    const handleCopy = () => {
        if (copyText && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(copyText);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">{getIcon()}</div>
                    <div className="flex-1">
                        <h3 className="modal-title mb-2">{title}</h3>
                        <p className="text-sm text-muted whitespace-pre-wrap">
                            {message}
                        </p>
                        {copyText && (
                            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                                <code className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                                    {copyText}
                                </code>
                            </div>
                        )}
                    </div>
                </div>
                <div className="modal-footer">
                    {copyText && (
                        <button
                            onClick={handleCopy}
                            className="btn btn-secondary"
                        >
                            📋 Copiar
                        </button>
                    )}
                    <button onClick={onClose} className="btn btn-primary">
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}
