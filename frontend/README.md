# Frontend - Dashboard Web

Dashboard web construido con Next.js 14, React y Tailwind CSS para gestión de infraestructura.

## 🎨 CSS Organization

This project uses a **centralized CSS system** for consistent, maintainable styling.

**📖 Start Here:** [CSS Master Index](CSS_INDEX.md) - Your navigation hub for all CSS documentation

### Quick Links
- **[Quick Reference](CSS_QUICK_REFERENCE.md)** - Cheat sheet for daily use
- **[Complete Guide](CSS_GUIDE.md)** - Full documentation of all classes
- **[Migration Guide](MIGRATION_GUIDE.md)** - How to update existing components
- **[Organization Summary](CSS_ORGANIZATION_SUMMARY.md)** - Overview of the system

### Quick Start
```tsx
// Import utilities
import { cn, getStatusBadgeClass } from '@/lib/styles';

// Use centralized classes
<button className="btn btn-primary">Save</button>
<span className={cn('badge', `status-${state}`)}>Status</span>
<div className="card">
  <h2 className="card-header">Title</h2>
  <div className="card-body">Content</div>
</div>
```

All CSS classes are defined in `app/globals.css` with helper functions in `lib/styles/`.

## Características

- 🎨 UI moderna con Tailwind CSS
- 📊 Dashboard con estadísticas en tiempo real
- 🖥️ Gestión de servidores con métricas live (WebSocket)
  - Indicador de conexión en vivo
  - CPU, RAM, Disco y GPU en tiempo real
  - Actualización cada 5 segundos
  - Historial de métricas con tabla
- 📋 Gestión de playbooks Ansible con upload YAML
- ⚙️ Ejecución de playbooks con dry-run
- 👥 Gestión de usuarios con carga masiva (CSV/TXT)
- 🔐 Autenticación JWT con sesiones persistentes
- 📱 Responsive design optimizado

## Páginas Principales

- `/login` - Autenticación con JWT
- `/dashboard` - Estadísticas generales (servidores, usuarios, ejecuciones)
- `/dashboard/servers` - Lista de servidores con estado online/offline
- `/dashboard/servers/[id]` - Detalle con métricas en tiempo real (WebSocket)
- `/dashboard/playbooks` - Gestión de playbooks Ansible
- `/dashboard/executions` - Historial de ejecuciones con detalles
- `/dashboard/executions/[id]` - Detalle de ejecución específica
- `/dashboard/users` - Gestión de usuarios con carga masiva

## Desarrollo

```bash
npm install
npm run dev  # http://localhost:3000
```

## Build

```bash
npm run build
npm start
```

## Documentación

- **CSS System**: Ver [CSS_INDEX.md](CSS_INDEX.md) para documentación completa de estilos
- **Proyecto**: Ver [README principal](../README.md) para documentación general
