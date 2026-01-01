# Styles Library

This directory contains all centralized styling utilities, helper functions, and documentation for the application's CSS system.

## 📁 Directory Structure

```
lib/styles/
├── README.md          # This file
├── index.ts           # Main export file - import from here
├── classNames.ts      # Helper functions for dynamic class names
└── examples.tsx       # Example components showing usage patterns
```

## 🚀 Quick Start

### 1. Import utilities in your component

```tsx
import { cn, getStatusBadgeClass, getButtonClass } from '@/lib/styles';
```

### 2. Use centralized CSS classes

```tsx
// Simple static classes
<button className="btn btn-primary">Save</button>

// Dynamic classes with helper functions
<span className={getStatusBadgeClass(status)}>{status}</span>

// Conditional classes with cn()
<div className={cn('card', isHovered && 'shadow-lg')}>
  Content
</div>
```

## 📚 Documentation

All styling documentation is located in the `frontend/` root directory:

- **`CSS_GUIDE.md`** - Complete guide to all CSS classes with examples
- **`MIGRATION_GUIDE.md`** - Step-by-step migration instructions with before/after examples
- **`CSS_QUICK_REFERENCE.md`** - Quick cheat sheet for common patterns

## 🛠️ Available Functions

### `cn(...classes)`
Combines multiple class names, filtering out falsy values.

```tsx
cn('btn', 'btn-primary', isLoading && 'opacity-50')
// Returns: 'btn btn-primary opacity-50' if isLoading is true
// Returns: 'btn btn-primary' if isLoading is false
```

### `getStatusBadgeClass(status)`
Returns appropriate badge classes for any status.

```tsx
getStatusBadgeClass('success')  // 'badge badge-success'
getStatusBadgeClass('failed')   // 'badge badge-error'
getStatusBadgeClass('online')   // 'badge status-online'
```

### `getExecutionStateClass(state)`
Returns execution state badge classes.

```tsx
getExecutionStateClass('running')  // 'status-running'
getExecutionStateClass('success')  // 'status-success'
```

### `getServerStatusClass(status)`
Returns server status classes.

```tsx
getServerStatusClass('online')   // 'status-online'
getServerStatusClass('offline')  // 'status-offline'
```

### `getButtonClass(variant, size?)`
Returns button classes with optional size.

```tsx
getButtonClass('primary')          // 'btn btn-primary'
getButtonClass('danger', 'sm')     // 'btn btn-danger text-sm'
```

### `getAlertClass(variant)`
Returns alert variant classes.

```tsx
getAlertClass('error')    // 'alert alert-error'
getAlertClass('success')  // 'alert alert-success'
```

### `getCardClass(hover)`
Returns card classes with optional hover effect.

```tsx
getCardClass(false)  // 'card'
getCardClass(true)   // 'card-hover'
```

### `getIconClass(size)`
Returns icon size classes.

```tsx
getIconClass('sm')   // 'icon-sm'
getIconClass('md')   // 'icon-md'
getIconClass('xl')   // 'icon-xl'
```

### `getSpinnerClass(size)`
Returns spinner classes with size.

```tsx
getSpinnerClass('sm')   // 'spinner spinner-sm'
getSpinnerClass('lg')   // 'spinner spinner-lg'
```

### `getGridClass(cols)`
Returns responsive grid classes.

```tsx
getGridClass(2)  // 'grid-2-cols'
getGridClass(3)  // 'grid-3-cols'
```

### `getFilterTabClass(isActive)`
Returns filter tab classes based on active state.

```tsx
getFilterTabClass(true)   // 'filter-tab filter-tab-active'
getFilterTabClass(false)  // 'filter-tab filter-tab-inactive'
```

### `getInputClass(hasError)`
Returns input classes with optional error state.

```tsx
getInputClass(false)  // 'input'
getInputClass(true)   // 'input input-error'
```

### `getTruncateClass(lines)`
Returns text truncation classes.

```tsx
getTruncateClass(1)  // 'truncate-1'
getTruncateClass(2)  // 'truncate-2'
```

### `getIconContainerClass(variant)`
Returns icon container classes with color variant.

```tsx
getIconContainerClass('primary')  // 'icon-container icon-container-primary'
getIconContainerClass('success')  // 'icon-container icon-container-success'
```

## 🎨 Core CSS Classes

All CSS classes are defined in `app/globals.css` using Tailwind's `@layer` directive.

### Categories

- **Buttons**: `btn`, `btn-primary`, `btn-secondary`, `btn-danger`, `btn-success`, `btn-icon`
- **Forms**: `input`, `textarea`, `select`, `checkbox`, `label`, `form-group`, `form-error`, `form-help`
- **Cards**: `card`, `card-header`, `card-body`, `card-footer`, `card-hover`
- **Badges**: `badge`, `badge-success`, `badge-error`, `badge-warning`, `badge-info`, `badge-neutral`
- **Status**: `status-online`, `status-offline`, `status-success`, `status-failed`, `status-running`, `status-pending`, `status-dry`
- **Alerts**: `alert`, `alert-error`, `alert-success`, `alert-warning`, `alert-info`
- **Loading**: `spinner`, `spinner-sm`, `spinner-md`, `spinner-lg`, `loading-container`, `loading-content`
- **Icons**: `icon-xs`, `icon-sm`, `icon-md`, `icon-lg`, `icon-xl`, `icon-container`, `icon-container-*`
- **Layout**: `page-header`, `page-title`, `page-subtitle`, `section-header`, `back-button`
- **Grids**: `grid-2-cols`, `grid-3-cols`, `grid-4-cols`
- **Lists**: `dl`, `dl-item`, `dl-term`, `dl-definition`
- **Items**: `item-card`, `item-card-header`, `item-card-title`
- **Empty States**: `empty-state`, `empty-state-icon`, `empty-state-title`, `empty-state-description`
- **Filter Tabs**: `filter-tabs`, `filter-tab`, `filter-tab-active`, `filter-tab-inactive`
- **Tables**: `table`, `table-header`, `table-header-cell`, `table-body`, `table-row`, `table-cell`
- **Modals**: `modal-overlay`, `modal-content`, `modal-header`, `modal-title`, `modal-body`, `modal-footer`
- **Typography**: `text-primary`, `text-muted`, `text-light`, `link`, `link-muted`, `code-block`, `code-inline`
- **Utilities**: `action-buttons`, `divider`, `truncate-1`, `truncate-2`, `truncate-3`, `scrollbar-thin`

## 💡 Usage Examples

### Complete Component Example

```tsx
import { cn, getStatusBadgeClass } from '@/lib/styles';

export function ServerCard({ server, onClick }) {
  return (
    <div className="item-card" onClick={onClick}>
      <div className="item-card-header">
        <h3 className="item-card-title">{server.name}</h3>
        <span className={getStatusBadgeClass(server.status)}>
          {server.status}
        </span>
      </div>
      <p className="text-muted">{server.ip_address}</p>
      <p className="text-sm text-light mt-1">User: {server.ssh_user}</p>
    </div>
  );
}
```

### Form with Validation

```tsx
import { cn, getInputClass } from '@/lib/styles';

export function LoginForm({ errors }) {
  return (
    <form>
      <div className="form-group">
        <label className="label">Email</label>
        <input
          type="email"
          className={getInputClass(!!errors.email)}
        />
        {errors.email && (
          <p className="form-error">{errors.email}</p>
        )}
      </div>
      
      <div className="action-buttons">
        <button type="button" className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Login
        </button>
      </div>
    </form>
  );
}
```

### Loading State

```tsx
export function LoadingState() {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="spinner spinner-lg"></div>
        <p className="mt-4 text-muted">Loading data...</p>
      </div>
    </div>
  );
}
```

## 🔄 Migration Process

1. Review `MIGRATION_GUIDE.md` for detailed examples
2. Import utilities: `import { cn, getStatusBadgeClass } from '@/lib/styles';`
3. Replace inline Tailwind classes with centralized classes
4. Use helper functions for dynamic/conditional classes
5. Test thoroughly to ensure visual consistency

## 🎯 Best Practices

1. **Always use semantic class names** instead of repeating Tailwind utilities
2. **Import from the index file**: `from '@/lib/styles'` not `from '@/lib/styles/classNames'`
3. **Use helper functions** for conditional/dynamic classes
4. **Maintain consistency** - if a pattern exists, use it everywhere
5. **Add new patterns** to `globals.css` when needed
6. **Document new helpers** when adding them to `classNames.ts`

## 🆕 Adding New Patterns

### 1. Add to `app/globals.css`

```css
@layer components {
    .my-new-component {
        @apply bg-white rounded-lg shadow-md p-4;
    }
}
```

### 2. Create helper function in `classNames.ts`

```tsx
export function getMyComponentClass(variant: string): string {
  return cn('my-new-component', `my-new-component-${variant}`);
}
```

### 3. Export from `index.ts`

```tsx
export { getMyComponentClass } from './classNames';
```

### 4. Document in `CSS_GUIDE.md`

Add usage examples and description to the guide.

## 📖 Additional Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [CSS @layer directive](https://tailwindcss.com/docs/adding-custom-styles#using-css-and-layer)
- Project color palette: See `tailwind.config.ts`

## 🤝 Contributing

When adding new styles:
1. Check if a similar pattern exists
2. Follow naming conventions (kebab-case for CSS, camelCase for functions)
3. Add to appropriate `@layer` section in `globals.css`
4. Create helper function if needed
5. Update documentation
6. Add usage examples

---

**Questions?** Check the documentation files in the `frontend/` root directory or review `examples.tsx` for working examples.