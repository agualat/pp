-- Migración: Agregar soft delete a ansible_tasks
-- Fecha: 2025-01-XX
-- Descripción: Agrega columnas is_active y deleted_at para implementar soft delete
--              en playbooks. Permite mantener historial de ejecuciones sin perder
--              la integridad referencial.

-- Agregar columna is_active (por defecto TRUE para todos los playbooks existentes)
ALTER TABLE ansible_tasks
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Agregar columna deleted_at (NULL para playbooks activos)
ALTER TABLE ansible_tasks
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Crear índice para mejorar performance de consultas que filtran por is_active
CREATE INDEX IF NOT EXISTS idx_ansible_tasks_is_active ON ansible_tasks(is_active);

-- Agregar comentarios para documentación
COMMENT ON COLUMN ansible_tasks.is_active IS
'Indica si el playbook está activo. FALSE = soft deleted (no se muestra en listados pero mantiene historial)';

COMMENT ON COLUMN ansible_tasks.deleted_at IS
'Timestamp de cuándo se marcó como eliminado. NULL si está activo.';

-- Verificar que las columnas se hayan agregado correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ansible_tasks'
        AND column_name = 'is_active'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ansible_tasks'
        AND column_name = 'deleted_at'
    ) THEN
        RAISE NOTICE '✓ Columnas is_active y deleted_at agregadas exitosamente a ansible_tasks';
    ELSE
        RAISE EXCEPTION '✗ Error: No se pudieron agregar las columnas de soft delete';
    END IF;
END $$;
