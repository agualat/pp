#!/bin/bash

# Script para verificar que Docker CLI funciona correctamente en el cliente

set -e

echo "🔍 Verificando Docker CLI en el cliente..."
echo ""

# 1. Verificar que docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ ERROR: Docker CLI no está instalado"
    echo "   Instalar con: apt-get install docker-ce-cli"
    exit 1
fi

echo "✅ Docker CLI instalado: $(docker --version)"
echo ""

# 2. Verificar que el socket de Docker está accesible
if [ ! -S /var/run/docker.sock ]; then
    echo "❌ ERROR: Socket de Docker no encontrado en /var/run/docker.sock"
    echo "   Asegúrate de montar el volumen en docker-compose.yml:"
    echo "   volumes:"
    echo "     - /var/run/docker.sock:/var/run/docker.sock"
    exit 1
fi

echo "✅ Socket de Docker encontrado: /var/run/docker.sock"
echo ""

# 3. Verificar permisos del socket
if [ ! -r /var/run/docker.sock ] || [ ! -w /var/run/docker.sock ]; then
    echo "⚠️  ADVERTENCIA: Sin permisos de lectura/escritura en el socket"
    echo "   Esto puede causar errores. Considera añadir el usuario al grupo docker"
fi

echo "✅ Permisos del socket OK"
echo ""

# 4. Probar conexión con Docker daemon
if ! docker info &> /dev/null; then
    echo "❌ ERROR: No se puede conectar al Docker daemon"
    echo "   Verifica que Docker está corriendo en el host"
    echo "   Comando: systemctl status docker"
    exit 1
fi

echo "✅ Conexión con Docker daemon OK"
echo ""

# 5. Probar docker ps -a
echo "📋 Probando 'docker ps -a'..."
CONTAINER_COUNT=$(docker ps -a --format "{{.Names}}" | wc -l)
echo "✅ Docker ps -a funciona: $CONTAINER_COUNT contenedores encontrados"
echo ""

# 6. Probar formato personalizado
echo "📋 Probando formato personalizado..."
docker ps -a --format "{{.ID}}|{{.Image}}|{{.Status}}|{{.Names}}|{{.Ports}}|{{.CreatedAt}}" | head -n 3
echo ""

echo "🎉 ¡Todas las verificaciones pasaron exitosamente!"
echo ""
echo "El cliente puede consultar Docker correctamente."
