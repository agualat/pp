# 📁 Scripts Directory

Este directorio contiene todos los scripts de mantenimiento, configuración y testing del proyecto, organizados por categoría.

## 📂 Estructura

```
scripts/
├── setup/              # Scripts de configuración inicial (una sola vez)
├── maintenance/        # Scripts de mantenimiento y auditoría (uso regular)
└── testing/           # Scripts de testing y debugging
```

---

## 🚀 Setup (Configuración Inicial)

Scripts que se ejecutan **una sola vez** al configurar un nuevo cliente.

### `setup/setup_nss_auto.sh`
**Propósito:** Configuración automática de NSS/PAM para autenticación SSH contra PostgreSQL

**Cuándo usar:**
- Al configurar un nuevo servidor/cliente por primera vez
- Después de reinstalar el sistema operativo

**Uso:**
```bash
sudo bash scripts/setup/setup_nss_auto.sh
```

**Qué hace:**
- Instala dependencias necesarias (libnss-pgsql2, libpam-pgsql, etc.)
- Configura NSS para leer usuarios desde PostgreSQL
- Configura PAM para autenticación contra PostgreSQL
- Crea directorios y archivos de configuración necesarios
- Configura permisos correctos

**Nota:** Después de ejecutar este script, los usuarios de la BD podrán hacer SSH al servidor.

---

## 🔧 Maintenance (Mantenimiento Regular)

Scripts para auditoría y mantenimiento continuo del sistema.

### `maintenance/check_user_permissions.sh`
**Propósito:** Verificar permisos y configuración de usuarios del sistema

**Cuándo usar:**
- Auditoría periódica de seguridad
- Después de sincronizar usuarios
- Para troubleshooting de permisos

**Uso:**
```bash
sudo bash scripts/maintenance/check_user_permissions.sh
```

**Qué verifica:**
- ✅ Usuarios en grupo Docker (y GID correcto)
- ❌ Usuarios que NO deberían tener sudo
- ✅ Archivos NSS generados correctamente
- ✅ Sincronización BD vs sistema

**Output esperado:**
```
🔍 Verificación de Permisos de Usuarios
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Docker group GID: 984

👤 Usuario: agualat
  ✅ Primary GID: 984 (docker)
  ✅ Groups: docker
  ✅ Sudo: not allowed
  ✅ Can run docker: YES
```

**Recomendación:** Ejecutar mensualmente o después de cambios importantes.

---

## 🧪 Testing (Pruebas y Debugging)

Scripts para testing y diagnóstico de problemas.

### `testing/test_client_db.sh`
**Propósito:** Probar conexión y consultas a la base de datos del cliente

**Uso:**
```bash
bash scripts/testing/test_client_db.sh
```

**Qué prueba:**
- Conexión a client_db
- Lectura de usuarios desde la tabla
- Validación de estructura de datos

### `testing/test_container_sync.sh`
**Propósito:** Probar sincronización entre contenedores

**Uso:**
```bash
bash scripts/testing/test_container_sync.sh
```

**Qué prueba:**
- Comunicación entre contenedores
- Sincronización de datos
- Estado de servicios

### `testing/test_sync.sh`
**Propósito:** Probar sincronización general del sistema

**Uso:**
```bash
bash scripts/testing/test_sync.sh
```

**Qué prueba:**
- Sincronización de usuarios
- Generación de archivos NSS
- Permisos y grupos

---

## 📦 Migrations Archive

Los scripts de migración ya ejecutados se encuentran en `../migrations/archive/`.

**⚠️ Importante:** NO volver a ejecutar estos scripts. Se mantienen solo como referencia histórica.

Archivos archivados:
- `migrate_system_gid.sql` - ✅ Ejecutado
- `fix_user_gid.sh` - ✅ Ejecutado  
- `apply_soft_delete_migration.sh` - ✅ Ejecutado
- `apply_docker_fix.sh` - ✅ Ejecutado

Ver `../migrations/archive/README.md` para más detalles.

---

## 🔄 Flujo de Trabajo Típico

### 1. Setup Inicial de un Cliente Nuevo
```bash
# En el servidor cliente (host)
sudo bash scripts/setup/setup_nss_auto.sh
```

### 2. Sincronización Regular de Usuarios
```bash
# Se ejecuta automáticamente, pero puede ejecutarse manualmente:
sudo bash client/utils/sync_docker_group.sh
```

### 3. Auditoría y Verificación
```bash
# Verificar estado de permisos
sudo bash scripts/maintenance/check_user_permissions.sh

# Troubleshooting
bash scripts/testing/test_client_db.sh
```

---

## 📋 Checklist de Nuevo Cliente

- [ ] Clonar repositorio en el servidor
- [ ] Copiar y configurar `.env`
- [ ] Levantar servicios: `docker compose up -d`
- [ ] Ejecutar setup: `sudo bash scripts/setup/setup_nss_auto.sh`
- [ ] Verificar permisos: `sudo bash scripts/maintenance/check_user_permissions.sh`
- [ ] Probar SSH con usuario de prueba

---

## ⚠️ Notas Importantes

### Permisos
- Todos los scripts de **setup** y **maintenance** requieren `sudo`
- Los scripts de **testing** generalmente NO requieren sudo

### Ubicación
- Scripts de **setup/maintenance**: Ejecutar desde el host (fuera de Docker)
- Scripts de **testing**: Pueden ejecutarse dentro o fuera de Docker

### Seguridad
- Los usuarios solo tienen acceso a Docker, **NO a sudo**
- Docker GID se detecta automáticamente por cliente
- Los scripts validan y remueven permisos privilegiados no deseados

---

## 🆘 Troubleshooting

### Usuario no puede hacer SSH
```bash
# 1. Verificar que el usuario existe en la BD
docker compose exec -T client_db psql -U postgres -d postgres -c "SELECT username, is_active FROM users WHERE username = 'usuario';"

# 2. Verificar NSS
getent passwd usuario

# 3. Re-ejecutar setup si es necesario
sudo bash scripts/setup/setup_nss_auto.sh
```

### Usuario no tiene acceso a Docker
```bash
# 1. Verificar grupos
id usuario
groups usuario

# 2. Sincronizar de nuevo
sudo bash client/utils/sync_docker_group.sh

# 3. Verificar permisos
sudo bash scripts/maintenance/check_user_permissions.sh
```

### Usuario tiene sudo (NO debería)
```bash
# 1. Verificar
sudo -l -U usuario

# 2. Remover manualmente
sudo deluser usuario sudo
sudo deluser usuario admin

# 3. Sincronizar para prevenir regresión
sudo bash client/utils/sync_docker_group.sh
```

---

## 📚 Documentación Relacionada

- [README.md](../README.md) - Documentación principal del proyecto
- [PERMISOS_DOCKER.md](../PERMISOS_DOCKER.md) - Guía detallada de permisos
- [client/README.md](../client/README.md) - Documentación del cliente
- [migrations/archive/README.md](../migrations/archive/README.md) - Historial de migraciones

---

## 🤝 Contribuir

Al agregar nuevos scripts:

1. **Categorizar correctamente:**
   - `setup/` - Solo para configuración inicial
   - `maintenance/` - Para uso regular/periódico
   - `testing/` - Para debugging y pruebas

2. **Documentar:**
   - Agregar comentarios en el script
   - Actualizar este README con el propósito y uso

3. **Nombrar claramente:**
   - Usar nombres descriptivos
   - Usar snake_case
   - Incluir `.sh` para scripts bash

4. **Hacer ejecutable:**
   ```bash
   chmod +x scripts/categoria/nuevo_script.sh
   ```

---

**Última actualización:** 2024-01-05