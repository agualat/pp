"""
Router para sincronización de datos desde el servidor central
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
import os
import subprocess
from datetime import datetime
from dateutil import parser as date_parser


router = APIRouter(prefix="/api/sync", tags=["Synchronization"])


def ensure_tables_exist(conn):
    """
    Verifica y crea las tablas necesarias si no existen.
    Esta función se ejecuta antes de cualquier operación de sincronización.
    """
    try:
        cur = conn.cursor()
        
        # Crear tabla users si no existe
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username VARCHAR UNIQUE NOT NULL,
                email VARCHAR UNIQUE NOT NULL,
                password_hash VARCHAR NOT NULL,
                is_admin INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                must_change_password INTEGER DEFAULT 0,
                system_uid INTEGER UNIQUE NOT NULL,
                system_gid INTEGER DEFAULT 2000,
                ssh_public_key VARCHAR,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT username_valid_pattern CHECK (username ~ '^[a-z_][a-z0-9_-]*$')
            )
        """)
        
        # Crear índices si no existen
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_system_uid ON users(system_uid)")
        
        conn.commit()
        cur.close()
        
        print("✅ Database tables verified/created successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error creating tables: {str(e)}")
        conn.rollback()
        raise


class UserSync(BaseModel):
    """Modelo para sincronizar usuarios"""
    id: int
    username: str
    email: str
    password_hash: str
    is_admin: int
    is_active: int
    must_change_password: int = 0
    system_uid: int
    system_gid: int
    ssh_public_key: Optional[str] = None
    created_at: Optional[datetime] = None


class SyncRequest(BaseModel):
    """Request de sincronización con metadatos"""
    server_url: Optional[str] = None  # URL del servidor central
    users: List[UserSync]


class SyncResponse(BaseModel):
    """Respuesta de sincronización"""
    success: bool
    message: str
    users_synced: int
    users_created: int
    users_updated: int
    users_deleted: int


def get_db_connection():
    """Obtiene conexión a la base de datos local del cliente"""
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("NSS_DB_USER", "postgres"),
        password=os.getenv("NSS_DB_PASSWORD", "postgres")
    )


@router.post("/users", response_model=SyncResponse)
async def sync_users(sync_data: SyncRequest):
    """
    Sincroniza la lista completa de usuarios desde el servidor central.
    También guarda la URL del servidor para sincronización de contraseñas.
    
    Este endpoint:
    1. Verifica que las tablas existan (las crea si es necesario)
    2. Guarda la URL del servidor central en /etc/default/sssd-pgsql
    3. Recibe la lista completa de usuarios desde el servidor central
    4. Actualiza o crea usuarios en la base de datos local
    5. Elimina usuarios que ya no existen en el servidor central
    6. Mantiene la base de datos local sincronizada
    7. Regenera archivos NSS/PAM para autenticación SSH
    """
    users = sync_data.users
    
    # Guardar SERVER_URL si fue proporcionado
    if sync_data.server_url:
        try:
            config_file = "/etc/default/sssd-pgsql"
            config_lines = []
            server_url_exists = False
            
            # Leer configuración existente si existe
            if os.path.exists(config_file):
                with open(config_file, 'r') as f:
                    for line in f:
                        if line.startswith('SERVER_URL='):
                            config_lines.append(f'SERVER_URL={sync_data.server_url}\n')
                            server_url_exists = True
                        else:
                            config_lines.append(line)
            
            # Si no existe la línea, agregarla
            if not server_url_exists:
                config_lines.append(f'SERVER_URL={sync_data.server_url}\n')
            
            # Escribir configuración actualizada
            with open(config_file, 'w') as f:
                f.writelines(config_lines)
            
            print(f"✅ SERVER_URL auto-configurado: {sync_data.server_url}")
        except Exception as e:
            print(f"⚠️  No se pudo auto-configurar SERVER_URL: {str(e)}")
            # No fallar la sincronización por esto
    
    conn = None
    try:
        # Conectar a la base de datos
        try:
            conn = get_db_connection()
        except psycopg2.OperationalError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Database connection failed: {str(e)}. Please verify that client_db is running."
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error connecting to database: {str(e)}"
            )
        
        # Verificar/crear tablas
        try:
            ensure_tables_exist(conn)
        except Exception as e:
            if conn:
                conn.close()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize database tables: {str(e)}"
            )
        
        cur = conn.cursor()
        
        users_created = 0
        users_updated = 0
        users_deleted = 0
        
        # IDs de usuarios que vienen del servidor central
        central_user_ids = {user.id for user in users}
        
        # Obtener IDs de usuarios locales
        try:
            cur.execute("SELECT id FROM users")
            local_user_ids = {row[0] for row in cur.fetchall()}
        except psycopg2.ProgrammingError as e:
            if conn:
                conn.close()
            raise HTTPException(
                status_code=500,
                detail=f"Error querying users table: {str(e)}. Table may not exist or be corrupted."
            )
        
        # Procesar cada usuario del servidor central
        for user in users:
            try:
                # Parsear created_at si viene como string
                created_at_value = user.created_at
                if isinstance(created_at_value, str):
                    try:
                        created_at_value = date_parser.parse(created_at_value)
                    except:
                        created_at_value = None
                
                # Verificar si el usuario existe localmente
                cur.execute("SELECT id FROM users WHERE id = %s", (user.id,))
                existing = cur.fetchone()
                
                if existing:
                    # Actualizar usuario existente
                    try:
                        cur.execute("""
                            UPDATE users 
                            SET username = %s, 
                                email = %s, 
                                password_hash = %s, 
                                is_admin = %s, 
                                is_active = %s, 
                                must_change_password = %s,
                                system_uid = %s, 
                                system_gid = %s, 
                                ssh_public_key = %s,
                                created_at = %s
                            WHERE id = %s
                        """, (
                            user.username,
                            user.email,
                            user.password_hash,
                            user.is_admin,
                            user.is_active,
                            user.must_change_password,
                            user.system_uid,
                            user.system_gid,
                            user.ssh_public_key,
                            created_at_value,
                            user.id
                        ))
                        users_updated += 1
                    except psycopg2.IntegrityError as e:
                        print(f"⚠️  Warning: Could not update user {user.username}: {str(e)}")
                        conn.rollback()
                        continue
                else:
                    # Crear nuevo usuario
                    try:
                        cur.execute("""
                            INSERT INTO users 
                            (id, username, email, password_hash, is_admin, is_active, 
                             must_change_password, system_uid, system_gid, ssh_public_key, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            user.id,
                            user.username,
                            user.email,
                            user.password_hash,
                            user.is_admin,
                            user.is_active,
                            user.must_change_password,
                            user.system_uid,
                            user.system_gid,
                            user.ssh_public_key,
                            created_at_value
                        ))
                        users_created += 1
                    except psycopg2.IntegrityError as e:
                        print(f"⚠️  Warning: Could not create user {user.username}: {str(e)}")
                        conn.rollback()
                        continue
                
            except Exception as e:
                print(f"❌ Error processing user {user.username}: {str(e)}")
                conn.rollback()
                continue
        
        # Eliminar usuarios que ya no existen en el servidor central
        users_to_delete = local_user_ids - central_user_ids
        if users_to_delete:
            try:
                cur.execute(
                    "DELETE FROM users WHERE id = ANY(%s)",
                    (list(users_to_delete),)
                )
                users_deleted = len(users_to_delete)
            except Exception as e:
                print(f"⚠️  Warning: Could not delete users: {str(e)}")
                conn.rollback()
        
        # Commit todos los cambios
        try:
            conn.commit()
        except Exception as e:
            conn.rollback()
            if conn:
                conn.close()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to commit database changes: {str(e)}"
            )
        
        cur.close()
        conn.close()
        
        # Crear directorios necesarios si no existen
        os.makedirs("/var/lib/extrausers", exist_ok=True)
        os.makedirs("/etc", exist_ok=True)
        
        # Regenerar archivos passwd y shadow con manejo de errores
        errors = []
        
        try:
            result = subprocess.run(
                ["bash", "/app/client/utils/generate_passwd_from_db.sh"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                error_msg = f"generate_passwd_from_db.sh failed (exit {result.returncode}): {result.stderr}"
                print(f"ERROR: {error_msg}")
                errors.append(error_msg)
            else:
                print("✅ Successfully generated /etc/passwd-pgsql")
        except subprocess.TimeoutExpired:
            error_msg = "generate_passwd_from_db.sh timed out"
            print(f"ERROR: {error_msg}")
            errors.append(error_msg)
        except Exception as e:
            error_msg = f"generate_passwd_from_db.sh exception: {str(e)}"
            print(f"ERROR: {error_msg}")
            errors.append(error_msg)
        
        try:
            result = subprocess.run(
                ["bash", "/app/client/utils/generate_shadow_from_db.sh"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                error_msg = f"generate_shadow_from_db.sh failed (exit {result.returncode}): {result.stderr}"
                print(f"ERROR: {error_msg}")
                errors.append(error_msg)
            else:
                print("✅ Successfully generated /var/lib/extrausers/shadow")
        except subprocess.TimeoutExpired:
            error_msg = "generate_shadow_from_db.sh timed out"
            print(f"ERROR: {error_msg}")
            errors.append(error_msg)
        except Exception as e:
            error_msg = f"generate_shadow_from_db.sh exception: {str(e)}"
            print(f"ERROR: {error_msg}")
            errors.append(error_msg)
        
        # Si hay errores, incluirlos en la respuesta pero no fallar
        message = f"Successfully synchronized {len(users)} users"
        if errors:
            message += f" (Warnings: {'; '.join(errors)})"
        
        return SyncResponse(
            success=True,
            message=message,
            users_synced=len(users),
            users_created=users_created,
            users_updated=users_updated,
            users_deleted=users_deleted
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    
    except psycopg2.OperationalError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database operational error: {str(e)}. Please check database connectivity."
        )
    
    except psycopg2.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error during synchronization: {str(e)}"
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error synchronizing users: {str(e)}"
        )
    
    finally:
        # Asegurar que la conexión se cierre
        if conn and not conn.closed:
            conn.close()
