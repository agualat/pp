# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0]

### 🔒 Breaking Changes

**SSH Username Change**
- Los usuarios deben conectarse usando su propio username en lugar de `root`
- Ejemplo: `ssh -L 4000:localhost:4000 usuario@server.ip`
- El UI genera automáticamente el comando correcto

### ✨ Added

**UI Improvements**
- Modal SSH responsive y optimizado para comandos largos
- Scroll horizontal suave para comandos que no caben en pantalla
- Botón copiar con confirmación visual (✓ ¡Copiado!)
- Dark mode completo en todos los componentes
- Instrucciones claras y tooltips para usuarios

**SSH Connection Reliability**
- Sistema de reintentos automáticos (3 intentos con backoff exponencial)
- Validación de salud del socket antes de reutilizar conexiones
- TCP keepalive para prevenir timeouts
- Reconexión automática en errores de comando
- Banner timeout aumentado a 60 segundos

**Scripts & Tools**
- `scripts/testing/verify_ssh_container_access.sh` - Verificación completa del sistema
- `scripts/maintenance/fix_user_gid.sh` - Corrección de GIDs de usuario
- Mejoras en `client/utils/sync_docker_group.sh`

### 🔧 Fixed

- Error "Error reading SSH protocol banner" durante creación/eliminación de contenedores
- Error "Bad file descriptor" al reutilizar conexiones SSH
- Timeouts de conexión SSH en operaciones consecutivas
- Validación incorrecta de estado de socket
- Modal SSH con overflow en nombres de usuario largos

### 🔐 Security

- Usuarios ya no tienen privilegios sudo por defecto
- Acceso Docker via grupo (system_gid) en lugar de sudo
- Mejor trazabilidad: cada usuario usa sus propias credenciales
- Reducción de superficie de ataque (sin acceso root innecesario)

### 📝 Migration Guide

**Para Usuarios:**
1. Actualizar comandos SSH guardados para usar tu username
2. Copiar el nuevo comando desde el botón "Conectar" en la UI
3. Si tienes problemas, ejecutar: `sudo bash /opt/pp/client/utils/sync_docker_group.sh`

**Para Administradores:**
1. Reiniciar servicios: `docker restart pp_api pp_frontend`
2. Verificar setup: `bash scripts/testing/verify_ssh_container_access.sh`
3. Revisar permisos: `bash scripts/maintenance/check_user_permissions.sh`

### 📚 Documentation

- Información de SSH integrada en README.md
- CHANGELOG.md simplificado
- Scripts de verificación documentados

---

## [1.0.0]

### Initial Release

- Sistema completo de gestión de infraestructura
- Monitoreo en tiempo real con WebSocket
- Gestión de usuarios con NSS/PAM PostgreSQL
- Ejecución de playbooks Ansible
- Dashboard web con Next.js
- Autenticación SSH unificada
- Replicación de usuarios en tiempo real
- Gestión de contenedores Docker
- Soft delete para playbooks