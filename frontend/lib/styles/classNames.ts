/**
 * Utility functions for conditional and dynamic class names
 */

/**
 * Combines multiple class names into a single string, filtering out falsy values
 * @param classes - Array of class names or conditional expressions
 * @returns Combined class string
 *
 * @example
 * cn('btn', 'btn-primary', isDisabled && 'opacity-50')
 * // Returns: 'btn btn-primary opacity-50' if isDisabled is true
 * // Returns: 'btn btn-primary' if isDisabled is false
 */
export function cn(
    ...classes: (string | boolean | undefined | null)[]
): string {
    return classes.filter(Boolean).join(" ");
}

/**
 * Status badge class generator
 * @param status - Status string
 * @returns Badge class names
 */
export function getStatusBadgeClass(status: string): string {
    const statusMap: Record<string, string> = {
        success: "badge badge-success",
        failed: "badge badge-error",
        error: "badge badge-error",
        running: "badge badge-info",
        pending: "badge badge-warning",
        dry: "badge badge-warning",
        online: "badge status-online",
        offline: "badge status-offline",
        active: "badge badge-success",
        inactive: "badge badge-neutral",
    };

    return statusMap[status.toLowerCase()] || "badge badge-neutral";
}

/**
 * Server status class generator
 * @param status - Server status
 * @returns Status class names
 */
export function getServerStatusClass(status: string): string {
    return status === "online" ? "status-online" : "status-offline";
}

/**
 * Execution state class generator
 * @param state - Execution state
 * @returns State class names
 */
export function getExecutionStateClass(state: string): string {
    const stateMap: Record<string, string> = {
        success: "status-success",
        failed: "status-failed",
        running: "status-running",
        dry: "status-dry",
        pending: "status-pending",
    };

    return stateMap[state.toLowerCase()] || "status-pending";
}

/**
 * Button variant class generator
 * @param variant - Button variant
 * @param size - Optional size modifier
 * @returns Button class names
 */
export function getButtonClass(
    variant: "primary" | "secondary" | "danger" | "success" = "primary",
    size?: "sm" | "lg",
): string {
    const base = "btn";
    const variantClass = `btn-${variant}`;
    const sizeClass = size ? `text-${size}` : "";

    return cn(base, variantClass, sizeClass);
}

/**
 * Alert variant class generator
 * @param variant - Alert variant
 * @returns Alert class names
 */
export function getAlertClass(
    variant: "error" | "success" | "warning" | "info" = "info",
): string {
    return cn("alert", `alert-${variant}`);
}

/**
 * Card variant class generator
 * @param hover - Whether card should have hover effect
 * @returns Card class names
 */
export function getCardClass(hover: boolean = false): string {
    return hover ? "card-hover" : "card";
}

/**
 * Icon size class generator
 * @param size - Icon size
 * @returns Icon class names
 */
export function getIconClass(
    size: "xs" | "sm" | "md" | "lg" | "xl" = "md",
): string {
    return `icon-${size}`;
}

/**
 * Spinner size class generator
 * @param size - Spinner size
 * @returns Spinner class names
 */
export function getSpinnerClass(size: "sm" | "md" | "lg" = "md"): string {
    return cn("spinner", `spinner-${size}`);
}

/**
 * Grid column class generator
 * @param cols - Number of columns
 * @returns Grid class names
 */
export function getGridClass(cols: 2 | 3 | 4): string {
    return `grid-${cols}-cols`;
}

/**
 * Filter tab class generator
 * @param isActive - Whether tab is active
 * @returns Tab class names
 */
export function getFilterTabClass(isActive: boolean): string {
    return cn(
        "filter-tab",
        isActive ? "filter-tab-active" : "filter-tab-inactive",
    );
}

/**
 * Input class generator with error state
 * @param hasError - Whether input has error
 * @returns Input class names
 */
export function getInputClass(hasError: boolean = false): string {
    return cn("input", hasError && "input-error");
}

/**
 * Text truncation class generator
 * @param lines - Number of lines before truncation
 * @returns Truncate class name
 */
export function getTruncateClass(lines: 1 | 2 | 3 = 1): string {
    return `truncate-${lines}`;
}

/**
 * Icon container class generator
 * @param variant - Color variant
 * @returns Icon container class names
 */
export function getIconContainerClass(
    variant: "primary" | "success" | "error" | "warning" = "primary",
): string {
    return cn("icon-container", `icon-container-${variant}`);
}
