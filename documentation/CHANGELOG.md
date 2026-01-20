# 📝 Changelog


### 🎯 Objetivo
Organizar scripts y migraciones para mejorar mantenibilidad y claridad del proyecto.

### ✨ Cambios Principales

#### 📂 Nueva Estructura de Directorios

**Antes:**
- Scripts mezclados en la raíz del proyecto
- Difícil distinguir setup vs mantenimiento vs migraciones
- Sin indicación de qué scripts ya se ejecutaron

**Después:**
```
scripts/
  ├── setup/              # Configuración inicial (una vez)
  ├── maintenance/        # Mantenimiento regular  
  └── testing/           # Testing y debugging

migrations/
  └── archive/           # Migraciones ejecutadas (histórico)
```

#### 🚚 Archivos Movidos

**→ `scripts/setup/`**
- `setup_nss_auto.sh` (desde raíz)

**→ `scripts/maintenance/`**
- `check_user_permissions.sh` (desde raíz)

**→ `scripts/testing/`**
- `test_client_db.sh` (desde raíz)
- `test_container_sync.sh` (desde raíz)
- `test_sync.sh` (desde raíz)

**→ `migrations/archive/`**
- `migrate_system_gid.sql` ✅ Ejecutado
- `fix_user_gid.sh` ✅ Ejecutado
- `apply_soft_delete_migration.sh` ✅ Ejecutado
- `apply_docker_fix.sh` ✅ Ejecutado

#### 📚 Documentación Creada/Actualizada

**Nuevo:**
- `scripts/README.md` - Índice completo de todos los scripts
- `migrations/archive/README.md` - Historial de migraciones
- `ESTRUCTURA_PROYECTO.md` - Guía completa de la estructura
- `CHANGELOG.md` - Este archivo

**Actualizado:**
- `README.md` - Referencias a nuevas rutas
- `PERMISOS_DOCKER.md` - Referencias a scripts movidos
- `LIMPIEZA_REPO.md` - Nueva estructura organizada

### 🎓 Beneficios

1. **Claridad:** Ahora es obvio qué script usar y cuándo
2. **Seguridad:** Migraciones archivadas no se re-ejecutan accidentalmente
3. **Mantenibilidad:** Estructura lógica fácil de entender
4. **Documentación:** Cada directorio tiene su README explicativo

### 🔄 Migración para Desarrolladores

**Si tenías scripts en favoritos/aliases:**
- `setup_nss_auto.sh` → `scripts/setup/setup_nss_auto.sh`
- `check_user_permissions.sh` → `scripts/maintenance/check_user_permissions.sh`
- `fix_user_gid.sh` → `migrations/archive/fix_user_gid.sh` (⚠️ ya ejecutado)

**Comandos actualizados:**
```bash
# Antes
sudo bash setup_nss_auto.sh

# Después
sudo bash scripts/setup/setup_nss_auto.sh
```

### ⚠️ Breaking Changes

**NINGUNO** - Los scripts del cliente (`client/utils/`) no se movieron, por lo que:
- Configuraciones existentes siguen funcionando
- Timers systemd no necesitan actualización
- No se requiere intervención en clientes en producción

### 📈 Estadísticas

- **Archivos reorganizados:** 9
- **Nuevos READMEs:** 3
- **Documentos actualizados:** 3
- **Directorios creados:** 5
- **Líneas de documentación agregadas:** ~800

---


### ✅ Ejecutado

**Descripción:** Migración para hacer `system_gid` nullable y permitir auto-detección del Docker GID en cada cliente.

**Archivos:**
- `migrate_system_gid.sql` - SQL migration
- `fix_user_gid.sh` - Script de migración

**Estado:**
- ✅ Ejecutado en servidor central (db)
- ✅ Ejecutado en cliente principal (client_db)

**Resultado:**
- 14 usuarios migrados exitosamente
- `system_gid` ahora es nullable
- Usuarios tienen Docker GID correcto (984)

---

## Historial Anterior

Ver `LIMPIEZA_REPO.md` para historial de limpiezas anteriores.
