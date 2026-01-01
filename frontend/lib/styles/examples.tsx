/**
 * Example Components Using Centralized CSS Classes
 *
 * These are reference examples showing how to use the centralized CSS system.
 * Copy and adapt these patterns in your own components.
 */

import React from 'react';
import { cn, getStatusBadgeClass, getFilterTabClass, getSpinnerClass } from './classNames';

// ============================================================================
// LOADING STATES
// ============================================================================

export function LoadingSpinner() {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="spinner spinner-lg"></div>
        <p className="mt-4 text-muted">Loading data...</p>
      </div>
    </div>
  );
}

export function InlineLoadingButton() {
  return (
    <button className="btn btn-primary" disabled>
      <div className="spinner spinner-sm mr-2"></div>
      <span>Processing...</span>
    </button>
  );
}

// ============================================================================
// ERROR STATES
// ============================================================================

export function ErrorAlert({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="mb-6 alert alert-error">
      <span>{message}</span>
      <button onClick={onClose} className="text-red-700 hover:text-red-900">
        <svg className="icon-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="empty-state">
      <svg className="empty-state-icon text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 className="empty-state-title">Something went wrong</h3>
      <p className="empty-state-description">{error}</p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

// ============================================================================
// EMPTY STATES
// ============================================================================

export function EmptyExecutionsList({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="empty-state">
      <svg className="empty-state-icon text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <h3 className="empty-state-title">No executions found</h3>
      <p className="empty-state-description">
        Start by executing your first playbook
      </p>
      <button className="btn btn-primary" onClick={onNavigate}>
        Go to Playbooks
      </button>
    </div>
  );
}

// ============================================================================
// PAGE LAYOUTS
// ============================================================================

export function PageWithHeader({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function PageWithBackButton({
  title,
  onBack,
  children
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button className="back-button" onClick={onBack}>
        <svg className="icon-md mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// CARDS
// ============================================================================

export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="card-header">{title}</h2>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}

export function ClickableCard({
  title,
  description,
  status,
  onClick
}: {
  title: string;
  description: string;
  status?: string;
  onClick: () => void;
}) {
  return (
    <div className="card-hover" onClick={onClick}>
      <div className="item-card-header">
        <h3 className="item-card-title">{title}</h3>
        {status && (
          <span className={getStatusBadgeClass(status)}>
            {status}
          </span>
        )}
      </div>
      <p className="text-muted">{description}</p>
    </div>
  );
}

// ============================================================================
// STATUS BADGES
// ============================================================================

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={getStatusBadgeClass(status)}>
      {status}
    </span>
  );
}

export function ExecutionStatusBadge({ state }: { state: string }) {
  const getStateLabel = (state: string) => {
    const labels: Record<string, string> = {
      success: 'Exitoso',
      failed: 'Fallido',
      running: 'Ejecutando',
      dry: 'Simulación',
      pending: 'Pendiente',
    };
    return labels[state] || state;
  };

  return (
    <span className={cn('badge', `status-${state}`)}>
      {getStateLabel(state)}
    </span>
  );
}

// ============================================================================
// FILTER TABS
// ============================================================================

export function FilterTabs({
  filters,
  activeFilter,
  onFilterChange
}: {
  filters: string[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}) {
  return (
    <div className="filter-tabs">
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={() => onFilterChange(filter)}
          className={getFilterTabClass(activeFilter === filter)}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// FORMS
// ============================================================================

export function FormField({
  label,
  name,
  type = 'text',
  error,
  help,
  required = false,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  help?: string;
  required?: boolean;
  [key: string]: any;
}) {
  return (
    <div className="form-group">
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className={cn('input', error && 'input-error')}
        {...props}
      />
      {error && <p className="form-error">{error}</p>}
      {help && !error && <p className="form-help">{help}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  error,
  help,
  required = false,
  rows = 4,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
  help?: string;
  required?: boolean;
  rows?: number;
  [key: string]: any;
}) {
  return (
    <div className="form-group">
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        className={cn('textarea', error && 'input-error')}
        {...props}
      />
      {error && <p className="form-error">{error}</p>}
      {help && !error && <p className="form-help">{help}</p>}
    </div>
  );
}

// ============================================================================
// DEFINITION LISTS
// ============================================================================

export function DefinitionList({ items }: { items: Array<{ term: string; definition: string }> }) {
  return (
    <dl className="dl">
      {items.map((item, index) => (
        <div key={index} className="dl-item">
          <dt className="dl-term">{item.term}:</dt>
          <dd className="dl-definition">{item.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

// ============================================================================
// SERVER/ITEM GRID
// ============================================================================

interface ServerItem {
  id: number;
  name: string;
  ip_address: string;
  status: string;
  ssh_user: string;
}

export function ServerGrid({
  servers,
  onServerClick
}: {
  servers: ServerItem[];
  onServerClick: (id: number) => void;
}) {
  return (
    <div className="grid-3-cols">
      {servers.map((server) => (
        <div
          key={server.id}
          className="item-card"
          onClick={() => onServerClick(server.id)}
        >
          <div className="item-card-header">
            <h3 className="item-card-title">{server.name}</h3>
            <span className={cn('badge', server.status === 'online' ? 'status-online' : 'status-offline')}>
              {server.status}
            </span>
          </div>
          <p className="text-muted">{server.ip_address}</p>
          <p className="text-sm text-light mt-1">SSH User: {server.ssh_user}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MODALS
// ============================================================================

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'primary'
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'primary' | 'danger';
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onCancel}>
            <svg className="icon-md text-gray-500 hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <p className="text-gray-700">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={cn('btn', variant === 'danger' ? 'btn-danger' : 'btn-primary')}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TABLES
// ============================================================================

export function DataTable<T extends { id: number }>({
  columns,
  data,
  onRowClick
}: {
  columns: Array<{ key: keyof T; label: string; render?: (value: any, row: T) => React.ReactNode }>;
  data: T[];
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead className="table-header">
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} className="table-header-cell">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="table-body">
          {data.map((row) => (
            <tr
              key={row.id}
              className={cn('table-row', onRowClick && 'cursor-pointer')}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td key={String(column.key)} className="table-cell">
                  {column.render
                    ? column.render(row[column.key], row)
                    : String(row[column.key])
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// ACTION BUTTONS
// ============================================================================

export function ActionButtonGroup({
  onCancel,
  onSave,
  saveText = 'Save',
  cancelText = 'Cancel',
  isLoading = false
}: {
  onCancel: () => void;
  onSave: () => void;
  saveText?: string;
  cancelText?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="action-buttons">
      <button className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
        {cancelText}
      </button>
      <button className="btn btn-primary" onClick={onSave} disabled={isLoading}>
        {isLoading ? (
          <>
            <div className="spinner spinner-sm mr-2"></div>
            Processing...
          </>
        ) : (
          saveText
        )}
      </button>
    </div>
  );
}

// ============================================================================
// ICON WITH CONTAINER
// ============================================================================

export function IconWithContainer({
  variant = 'primary',
  children
}: {
  variant?: 'primary' | 'success' | 'error' | 'warning';
  children: React.ReactNode;
}) {
  const colorMap = {
    primary: 'text-primary-600',
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
  };

  return (
    <div className={cn('icon-container', `icon-container-${variant}`)}>
      <div className={cn('icon-lg', colorMap[variant])}>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// USAGE EXAMPLE: Complete Page Component
// ============================================================================

export function ExampleExecutionDetailPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const execution = {
    id: 1,
    state: 'success',
    user_username: 'admin',
    executed_at: new Date().toISOString(),
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <PageWithBackButton
      title={`Execution #${execution.id}`}
      onBack={() => console.log('Go back')}
    >
      {error && (
        <ErrorAlert message={error} onClose={() => setError('')} />
      )}

      <div className="grid-2-cols mb-8">
        <InfoCard title="Execution Information">
          <DefinitionList
            items={[
              { term: 'ID', definition: `#${execution.id}` },
              { term: 'Status', definition: execution.state },
              { term: 'User', definition: execution.user_username },
              { term: 'Executed At', definition: new Date(execution.executed_at).toLocaleString() },
            ]}
          />
        </InfoCard>

        <InfoCard title="Playbook Information">
          <p className="text-muted">Playbook details here...</p>
        </InfoCard>
      </div>

      <div className="card">
        <h2 className="section-header">Actions</h2>
        <ActionButtonGroup
          onCancel={() => console.log('Cancel')}
          onSave={() => console.log('Save')}
        />
      </div>
    </PageWithBackButton>
  );
}
