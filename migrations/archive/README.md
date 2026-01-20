# 📦 Migraciones Archivadas

Este directorio contiene migraciones y scripts de configuración que **ya fueron ejecutados** en todos los clientes.

Se mantienen aquí como referencia histórica, pero **NO deben ejecutarse nuevamente** en producción.

## 🗂️ Archivos archivados:

### Migración: System GID (2024)
- `migrate_system_gid.sql` - Hace system_gid nullable
- `fix_user_gid.sh` - Script de migración una vez
- **Estado:** ✅ Ejecutado en servidor + todos los clientes
- **Propósito:** Permitir auto-detección de Docker GID por cliente

### Migración: Soft Delete (2024)
- `apply_soft_delete_migration.sh` - Agrega is_active y deleted_at
- **Estado:** ✅ Ejecutado
- **Propósito:** Implementar soft delete en ansible_tasks

### Fix: Docker Access (2024)
- `apply_docker_fix.sh` - Monta socket Docker en cliente
- **Estado:** ✅ Aplicado en configuración
- **Propósito:** Permitir acceso a Docker desde contenedor cliente

---

## ⚠️ Importante

Si necesitas aplicar estas migraciones en un **nuevo cliente desde cero**:
1. La estructura actual de la BD ya incluye estos cambios
2. NO necesitas ejecutar estas migraciones
3. Solo ejecuta `setup_nss_auto.sh` para configuración inicial

## 📚 Referencia

Para entender qué hace cada migración, lee los comentarios dentro de cada archivo.
