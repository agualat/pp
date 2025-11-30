"""
Script para replicar la base de datos central a la base de datos local del cliente
Sincroniza solo la tabla 'users' para autenticación NSS/PAM
"""
import psycopg2
import os
import sys
import time
from typing import List, Dict


def get_central_db_connection():
    """Obtiene conexión a la base de datos central"""
    try:
        return psycopg2.connect(
            host=os.getenv("CENTRAL_DB_HOST", "db"),
            port=os.getenv("CENTRAL_DB_PORT", "5432"),
            database=os.getenv("CENTRAL_DB_NAME", "mydb"),
            user=os.getenv("CENTRAL_DB_USER", "postgres"),
            password=os.getenv("CENTRAL_DB_PASSWORD", "postgres"),
            connect_timeout=5
        )
    except Exception as e:
        print(f"✗ Failed to connect to central database: {e}")
        return None


def get_local_db_connection():
    """Obtiene conexión a la base de datos local del cliente"""
    try:
        return psycopg2.connect(
            host=os.getenv("DB_HOST", "client_db"),
            port=os.getenv("DB_PORT", "5432"),
            database=os.getenv("DB_NAME", "mydb"),
            user=os.getenv("NSS_DB_USER", "postgres"),
            password=os.getenv("NSS_DB_PASSWORD", "postgres"),
            connect_timeout=5
        )
    except Exception as e:
        print(f"✗ Failed to connect to local database: {e}")
        return None


def ensure_users_table_exists(conn):
    """Crea la tabla users en la BD local si no existe"""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR UNIQUE NOT NULL,
                email VARCHAR UNIQUE NOT NULL,
                password_hash VARCHAR NOT NULL,
                is_admin INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                system_uid INTEGER UNIQUE NOT NULL,
                system_gid INTEGER DEFAULT 2000,
                ssh_public_key VARCHAR
            );
            
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_system_uid ON users(system_uid);
            CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
        """)
        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"✗ Failed to create users table: {e}")
        return False


def fetch_central_users():
    """Obtiene todos los usuarios de la base de datos central"""
    conn = get_central_db_connection()
    if not conn:
        return None
    
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, email, password_hash, is_admin, is_active, 
                   system_uid, system_gid, ssh_public_key
            FROM users
            ORDER BY id
        """)
        
        users = []
        for row in cursor.fetchall():
            users.append({
                "id": row[0],
                "username": row[1],
                "email": row[2],
                "password_hash": row[3],
                "is_admin": row[4],
                "is_active": row[5],
                "system_uid": row[6],
                "system_gid": row[7],
                "ssh_public_key": row[8]
            })
        
        cursor.close()
        conn.close()
        
        return users
        
    except Exception as e:
        print(f"✗ Failed to fetch users from central DB: {e}")
        if conn:
            conn.close()
        return None


def sync_user_to_local(conn, user: Dict) -> bool:
    """Sincroniza un usuario a la base de datos local (INSERT o UPDATE)"""
    try:
        cursor = conn.cursor()
        
        # Intentar INSERT, si falla hacer UPDATE
        cursor.execute("""
            INSERT INTO users (id, username, email, password_hash, is_admin, is_active, 
                             system_uid, system_gid, ssh_public_key)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) 
            DO UPDATE SET
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                is_admin = EXCLUDED.is_admin,
                is_active = EXCLUDED.is_active,
                system_uid = EXCLUDED.system_uid,
                system_gid = EXCLUDED.system_gid,
                ssh_public_key = EXCLUDED.ssh_public_key
        """, (
            user["id"],
            user["username"],
            user["email"],
            user["password_hash"],
            user["is_admin"],
            user["is_active"],
            user["system_uid"],
            user["system_gid"],
            user["ssh_public_key"]
        ))
        
        cursor.close()
        return True
        
    except Exception as e:
        print(f"✗ Failed to sync user {user['username']}: {e}")
        return False


def delete_removed_users(conn, central_user_ids: List[int]) -> int:
    """Elimina usuarios que ya no existen en la BD central"""
    try:
        cursor = conn.cursor()
        
        if not central_user_ids:
            return 0
        
        # Eliminar usuarios locales que no están en la lista central
        cursor.execute("""
            DELETE FROM users 
            WHERE id NOT IN %s
            RETURNING id
        """, (tuple(central_user_ids),))
        
        deleted_count = cursor.rowcount
        cursor.close()
        
        return deleted_count
        
    except Exception as e:
        print(f"✗ Failed to delete removed users: {e}")
        return 0


def replicate_users():
    """Replica todos los usuarios de la BD central a la BD local"""
    print("🔄 Starting user replication from central DB to local DB...")
    
    # Obtener usuarios de la BD central
    central_users = fetch_central_users()
    
    if central_users is None:
        print("⚠️  Failed to fetch users from central DB (will retry later)")
        return 1
    
    if not central_users:
        print("ℹ️  No users found in central DB")
        return 0
    
    # Conectar a BD local
    local_conn = get_local_db_connection()
    if not local_conn:
        print("✗ Failed to connect to local DB")
        return 1
    
    try:
        # Asegurar que la tabla existe
        if not ensure_users_table_exists(local_conn):
            print("✗ Failed to ensure users table exists")
            local_conn.close()
            return 1
        
        # Sincronizar cada usuario
        synced = 0
        for user in central_users:
            if sync_user_to_local(local_conn, user):
                synced += 1
        
        # Eliminar usuarios que ya no existen en central
        central_user_ids = [user["id"] for user in central_users]
        deleted = delete_removed_users(local_conn, central_user_ids)
        
        # Commit todos los cambios
        local_conn.commit()
        
        print(f"✅ Replication complete: {synced}/{len(central_users)} users synced, {deleted} users removed")
        
        local_conn.close()
        return 0
        
    except Exception as e:
        print(f"✗ Replication failed: {e}")
        if local_conn:
            local_conn.rollback()
            local_conn.close()
        return 1


def main():
    """Ejecuta la replicación de usuarios"""
    max_retries = 3
    retry_delay = 5
    
    for attempt in range(1, max_retries + 1):
        result = replicate_users()
        
        if result == 0:
            return 0
        
        if attempt < max_retries:
            print(f"⏳ Retry {attempt}/{max_retries} in {retry_delay} seconds...")
            time.sleep(retry_delay)
    
    print(f"✗ Failed after {max_retries} attempts")
    return 1


if __name__ == "__main__":
    sys.exit(main())
