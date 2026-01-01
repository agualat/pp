"""
Utilidades para encriptar y desencriptar datos sensibles como contraseñas de become.
Usa Fernet (symmetric encryption) de cryptography.
"""

import os
from typing import Optional

from cryptography.fernet import Fernet


def get_encryption_key() -> bytes:
    """
    Obtiene o genera la clave de encriptación desde variable de entorno.
    Si no existe, genera una nueva y la muestra para que la guardes.

    IMPORTANTE: Debes establecer ENCRYPTION_KEY en tu .env
    """
    key = os.getenv("ENCRYPTION_KEY")

    if not key:
        # Generar nueva clave
        new_key = Fernet.generate_key()
        print("\n" + "=" * 70)
        print("⚠️  ADVERTENCIA: No se encontró ENCRYPTION_KEY en el entorno")
        print("=" * 70)
        print("\nSe ha generado una nueva clave. Agrégala a tu archivo .env:")
        print(f"\nENCRYPTION_KEY={new_key.decode()}")
        print("\n" + "=" * 70 + "\n")
        return new_key

    return key.encode()


def encrypt_password(password: str) -> str:
    """
    Encripta una contraseña usando Fernet.

    Args:
        password: Contraseña en texto plano

    Returns:
        Contraseña encriptada como string base64
    """
    if not password:
        return ""

    key = get_encryption_key()
    fernet = Fernet(key)
    encrypted = fernet.encrypt(password.encode())
    return encrypted.decode()


def decrypt_password(encrypted_password: str) -> Optional[str]:
    """
    Desencripta una contraseña.

    Args:
        encrypted_password: Contraseña encriptada en base64

    Returns:
        Contraseña en texto plano o None si falla
    """
    if not encrypted_password:
        return None

    try:
        key = get_encryption_key()
        fernet = Fernet(key)
        decrypted = fernet.decrypt(encrypted_password.encode())
        return decrypted.decode()
    except Exception as e:
        print(f"Error desencriptando contraseña: {e}")
        return None
