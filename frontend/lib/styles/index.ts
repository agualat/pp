/**
 * Centralized Style Utilities
 *
 * Export all helper functions and utilities for consistent styling across the app.
 * Import from this file to access all style utilities:
 *
 * @example
 * import { cn, getStatusBadgeClass, getButtonClass } from '@/lib/styles';
 */

export {
  cn,
  getStatusBadgeClass,
  getServerStatusClass,
  getExecutionStateClass,
  getButtonClass,
  getAlertClass,
  getCardClass,
  getIconClass,
  getSpinnerClass,
  getGridClass,
  getFilterTabClass,
  getInputClass,
  getTruncateClass,
  getIconContainerClass,
} from './classNames';

// Re-export types if needed in the future
export type ButtonVariant = "primary" | "secondary" | "danger" | "success";
export type AlertVariant = "error" | "success" | "warning" | "info";
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpinnerSize = "sm" | "md" | "lg";
export type GridCols = 2 | 3 | 4;
export type TruncateLines = 1 | 2 | 3;
export type IconContainerVariant = "primary" | "success" | "error" | "warning";
