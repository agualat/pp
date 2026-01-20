-- Migración para hacer system_gid nullable
-- Esto permite que el GID se detecte automáticamente en cada cliente

-- 1. Hacer la columna nullable
ALTER TABLE users ALTER COLUMN system_gid DROP NOT NULL;

-- 2. Actualizar valores existentes NULL para que no causen problemas
-- (aunque el fix_user_gid.sh ya debería haberlos actualizado)
UPDATE users SET system_gid = NULL WHERE system_gid = 2000;

-- 3. Verificar resultado
SELECT
    COUNT(*) as total_usuarios,
    COUNT(system_gid) as con_gid,
    COUNT(*) - COUNT(system_gid) as sin_gid
FROM users;

-- 4. Mostrar usuarios sin GID (deberían estar todos)
SELECT username, system_uid, system_gid, is_active
FROM users
WHERE is_active = 1
ORDER BY username;
