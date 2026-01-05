#!/usr/bin/env bash
# Script de instalación rápida para dar permisos de Docker a usuarios
# Uso: bash setup_docker_permissions.sh

set -e

echo "🚀 Configuración de Permisos de Docker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Este script debe ejecutarse como root"
    echo "Usa: sudo bash setup_docker_permissions.sh"
    exit 1
fi

# Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    echo ""
    echo "Instalar Docker primero:"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sudo sh get-docker.sh"
    exit 1
fi

# Crear el script permanente
SCRIPT_PATH="/usr/local/bin/add-docker-users"

echo "📝 Creando script en $SCRIPT_PATH..."

cat > "$SCRIPT_PATH" << 'EOFSCRIPT'
#!/usr/bin/env bash
# Script para añadir usuarios al grupo docker
# Generado automáticamente por setup_docker_permissions.sh

set -e

if [ "$EUID" -ne 0 ]; then
    echo "❌ Ejecutar como root: sudo add-docker-users"
    exit 1
fi

if ! getent group docker > /dev/null 2>&1; then
    echo "❌ El grupo docker no existe"
    exit 1
fi

USERS=$(awk -F: '$3 >= 2000 && $3 < 65534 && $6 ~ /^\/home\// {print $1}' /etc/passwd)

if [ -z "$USERS" ]; then
    echo "ℹ️  No hay usuarios para procesar"
    exit 0
fi

SUCCESS=0
ALREADY=0
FAILED=0

for username in $USERS; do
    if groups "$username" 2>/dev/null | grep -q "\bdocker\b"; then
        echo "✅ $username"
        ALREADY=$((ALREADY + 1))
    else
        if usermod -aG docker "$username" 2>/dev/null; then
            echo "✨ $username - añadido"
            SUCCESS=$((SUCCESS + 1))
        else
            echo "❌ $username - error"
            FAILED=$((FAILED + 1))
        fi
    fi
done

echo ""
echo "Añadidos: $SUCCESS | Ya estaban: $ALREADY | Errores: $FAILED"

if [ $FAILED -gt 0 ]; then
    exit 1
fi

echo "✅ Completado"
exit 0
EOFSCRIPT

chmod +x "$SCRIPT_PATH"

echo "✅ Script creado en $SCRIPT_PATH"
echo ""

# Ejecutar el script por primera vez
echo "🔧 Añadiendo usuarios existentes al grupo docker..."
echo ""

"$SCRIPT_PATH"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configuración completada"
echo ""
echo "📋 Comandos disponibles:"
echo ""
echo "  Añadir usuarios nuevos:       sudo add-docker-users"
echo "  Ver grupos de un usuario:     groups nombre_usuario"
echo "  Probar Docker (como usuario): docker ps"
echo ""
echo "⚠️  Los usuarios deben cerrar sesión y volver a entrar"
echo "   para que los cambios surtan efecto"
echo ""
echo "💡 Tip: Para automatizar, agregar a cron:"
echo "   sudo crontab -e"
echo "   0 * * * * /usr/local/bin/add-docker-users >/dev/null 2>&1"
echo ""

exit 0
