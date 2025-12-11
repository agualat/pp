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


class UserSync(BaseModel):
    """Modelo para sincronizar usuarios"""
    id: int
    username: str
    email: str
    password_hash: str
    is_admin: int
    is_active: int
    system_uid: int
    system_gid: int
    ssh_public_key: Optional[str] = None
    created_at: Optional[datetime] = None


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
        database=os.getenv("DB_NAME", "mydb"),
        user=os.getenv("NSS_DB_USER", "postgres"),
        password=os.getenv("NSS_DB_PASSWORD", "postgres")
    )


@router.post("/users", response_model=SyncResponse)
async def sync_users(users: List[UserSync]):
    """
    Sincroniza la lista completa de usuarios desde el servidor central.
    
    Este endpoint:
    1. Recibe la lista completa de usuarios desde el servidor central
    2. Actualiza o crea usuarios en la base de datos local
    3. Elimina usuarios que ya no existen en el servidor central
    4. Mantiene la base de datos local sincronizada
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        users_created = 0
        users_updated = 0
        users_deleted = 0
        
        # IDs de usuarios que vienen del servidor central
        central_user_ids = {user.id for user in users}
        
        # Obtener IDs de usuarios locales
        cur.execute("SELECT id FROM users")
        local_user_ids = {row[0] for row in cur.fetchall()}
        
        # Procesar cada usuario del servidor central
        for user in users:
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
                cur.execute("""
                    UPDATE users 
                    SET username = %s, 
                        email = %s, 
                        password_hash = %s, 
                        is_admin = %s, 
                        is_active = %s, 
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
                    user.system_uid,
                    user.system_gid,
                    user.ssh_public_key,
                    created_at_value,
                    user.id
                ))
                users_updated += 1
            else:
                # Crear nuevo usuario
                cur.execute("""
                    INSERT INTO users 
                    (id, username, email, password_hash, is_admin, is_active, 
                     system_uid, system_gid, ssh_public_key, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    user.id,
                    user.username,
                    user.email,
                    user.password_hash,
                    user.is_admin,
                    user.is_active,
                    user.system_uid,
                    user.system_gid,
                    user.ssh_public_key,
                    created_at_value
                ))
                users_created += 1
        
        # Eliminar usuarios que ya no existen en el servidor central
        users_to_delete = local_user_ids - central_user_ids
        if users_to_delete:
            cur.execute(
                "DELETE FROM users WHERE id = ANY(%s)",
                (list(users_to_delete),)
            )
            users_deleted = len(users_to_delete)
        
        conn.commit()
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
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error synchronizing users: {str(e)}"
        )
