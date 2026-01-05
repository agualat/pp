#!/usr/bin/env bash
# Script simple para añadir todos los usuarios del sistema al grupo docker
# Uso: sudo bash add_users_to_docker.sh

set -e

echo "🔧 Añadiendo usuarios al grupo docker..."
echo ""

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Este script debe ejecutarse como root"
    echo "Usa: sudo bash add_users_to_docker.sh"
    exit 1
fi

# Verificar que el grupo docker existe
if ! getent group docker > /dev/null 2>&1; then
    echo "❌ El grupo docker no existe. ¿Docker está instalado?"
    exit 1
fi

# Obtener todos los usuarios con UID >= 2000 (usuarios creados por la app)
# y que tengan un directorio home real
USERS=$(awk -F: '$3 >= 2000 && $3 < 65534 && $6 ~ /^\/home\// {print $1}' /etc/passwd)

if [ -z "$USERS" ]; then
    echo "ℹ️  No se encontraron usuarios para añadir al grupo docker"
    exit 0
fi

SUCCESS=0
ALREADY=0
FAILED=0

# Añadir cada usuario al grupo docker
for username in $USERS; do
    # Verificar si ya está en el grupo
    if groups "$username" 2>/dev/null | grep -q "\bdocker\b"; then
        echo "✅ $username - ya está en el grupo docker"
        ALREADY=$((ALREADY + 1))
    else
        # Añadir al grupo
        if usermod -aG docker "$username" 2>/dev/null; then
            echo "✨ $username - añadido al grupo docker"
            SUCCESS=$((SUCCESS + 1))
        else
            echo "❌ $username - error al añadir"
            FAILED=$((FAILED + 1))
        fi
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Resumen:"
echo "  ✨ Añadidos: $SUCCESS"
echo "  ✅ Ya estaban: $ALREADY"
echo "  ❌ Errores: $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "⚠️  Completado con errores"
    exit 1
fi

echo "✅ Completado exitosamente"
echo ""
echo "📝 Nota: Los usuarios deben cerrar sesión y volver a entrar"
echo "   para que los cambios surtan efecto."

exit 0
