# Frontend - Dashboard Web

Dashboard web construido con Next.js 14, React y Tailwind CSS para gestión de infraestructura.

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

Ver documentación completa en el [README principal](../README.md)
