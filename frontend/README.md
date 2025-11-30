# Frontend - Dashboard Web

Dashboard web construido con Next.js 14, React y Tailwind CSS para gestión de infraestructura.

## Características

- 🎨 UI moderna con Tailwind CSS
- 📊 Dashboard con estadísticas en tiempo real
- 🖥️ Gestión de servidores con métricas live (WebSocket)
- 📋 Gestión de playbooks Ansible con upload YAML
- ⚙️ Ejecución de playbooks con dry-run
- 👥 Gestión de usuarios con carga masiva
- 🔐 Autenticación JWT
- 📱 Responsive design

## Páginas Principales

- `/login` - Autenticación
- `/dashboard` - Estadísticas generales
- `/dashboard/servers` - Lista y detalle de servidores
- `/dashboard/playbooks` - Gestión de playbooks
- `/dashboard/executions` - Historial de ejecuciones
- `/dashboard/users` - Gestión de usuarios

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
