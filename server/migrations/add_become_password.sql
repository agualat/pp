-- Migración: Agregar soporte para contraseñas SSH/Become (sudo) en servidores
-- Fecha: 2025-01-XX
-- Descripción: Agrega columna ssh_password_encrypted para almacenar contraseñas SSH
--              de forma encriptada. Esta contraseña también se usa para become/sudo.

-- Agregar columna para contraseña SSH encriptada
ALTER TABLE servers
ADD COLUMN IF NOT EXISTS ssh_password_encrypted VARCHAR(255) NULL;

-- Agregar comentario para documentación
COMMENT ON COLUMN servers.ssh_password_encrypted IS
'Contraseña SSH encriptada con Fernet. Se usa para SSH inicial y como contraseña de become/sudo cuando Ansible necesita privilegios elevados.';

-- Índice para búsquedas (opcional, útil si necesitas filtrar por servidores con/sin contraseña)
-- CREATE INDEX idx_servers_has_ssh_password ON servers ((ssh_password_encrypted IS NOT NULL));

-- Verificar que la columna se haya agregado correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'servers'
        AND column_name = 'ssh_password_encrypted'
    ) THEN
        RAISE NOTICE '✓ Columna ssh_password_encrypted agregada exitosamente';
    ELSE
        RAISE EXCEPTION '✗ Error: No se pudo agregar la columna ssh_password_encrypted';
    END IF;
END $$;
