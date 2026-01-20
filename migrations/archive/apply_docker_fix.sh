#!/bin/bash

# Script para aplicar la solución de acceso a Docker en el cliente
# Este script reconstruye el cliente con Docker CLI y el socket montado

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Aplicando Solución: Acceso a Docker en Cliente        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.client.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.client.yml no encontrado${NC}"
    echo "   Ejecuta este script desde el directorio raíz del proyecto (pp/)"
    exit 1
fi

echo -e "${YELLOW}📋 Verificando archivos modificados...${NC}"
echo ""

# Verificar Dockerfile
if grep -q "docker-ce-cli" client/dockerfile; then
    echo -e "${GREEN}✅ client/dockerfile - Docker CLI añadido${NC}"
else
    echo -e "${RED}❌ client/dockerfile - Docker CLI NO encontrado${NC}"
    echo "   Por favor, verifica que los cambios se aplicaron correctamente"
    exit 1
fi

# Verificar docker-compose.client.yml
if grep -q "/var/run/docker.sock:/var/run/docker.sock" docker-compose.client.yml; then
    echo -e "${GREEN}✅ docker-compose.client.yml - Socket de Docker montado${NC}"
else
    echo -e "${RED}❌ docker-compose.client.yml - Socket NO montado${NC}"
    echo "   Por favor, verifica que los cambios se aplicaron correctamente"
    exit 1
fi

# Verificar script de verificación
if [ -f "client/utils/check_docker.sh" ]; then
    echo -e "${GREEN}✅ client/utils/check_docker.sh - Script de verificación disponible${NC}"
else
    echo -e "${YELLOW}⚠️  client/utils/check_docker.sh - Script no encontrado (opcional)${NC}"
fi

echo ""
echo -e "${YELLOW}🛑 Deteniendo cliente actual...${NC}"
docker compose -f docker-compose.client.yml down

echo ""
echo -e "${YELLOW}🔨 Reconstruyendo imagen del cliente con Docker CLI...${NC}"
echo "   Esto puede tomar varios minutos..."
docker compose -f docker-compose.client.yml build client

echo ""
echo -e "${YELLOW}🚀 Iniciando cliente con nuevo volumen de Docker socket...${NC}"
docker compose -f docker-compose.client.yml up -d

echo ""
echo -e "${YELLOW}⏳ Esperando que el cliente esté listo...${NC}"
sleep 5

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           VERIFICACIONES                              ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Verificación 1: Contenedor corriendo
echo -e "${YELLOW}1. Verificando que el contenedor está corriendo...${NC}"
if docker ps | grep -q pp_client; then
    echo -e "${GREEN}   ✅ Contenedor pp_client está corriendo${NC}"
else
    echo -e "${RED}   ❌ Contenedor pp_client NO está corriendo${NC}"
    echo ""
    echo "Logs del contenedor:"
    docker logs pp_client --tail 20
    exit 1
fi

# Verificación 2: Docker CLI instalado
echo ""
echo -e "${YELLOW}2. Verificando Docker CLI en el contenedor...${NC}"
if docker exec pp_client docker --version &> /dev/null; then
    VERSION=$(docker exec pp_client docker --version)
    echo -e "${GREEN}   ✅ Docker CLI instalado: $VERSION${NC}"
else
    echo -e "${RED}   ❌ Docker CLI NO está instalado en el contenedor${NC}"
    exit 1
fi

# Verificación 3: Socket montado
echo ""
echo -e "${YELLOW}3. Verificando socket de Docker...${NC}"
if docker exec pp_client test -S /var/run/docker.sock; then
    echo -e "${GREEN}   ✅ Socket de Docker montado: /var/run/docker.sock${NC}"
else
    echo -e "${RED}   ❌ Socket de Docker NO encontrado${NC}"
    exit 1
fi

# Verificación 4: Docker ps funciona
echo ""
echo -e "${YELLOW}4. Probando 'docker ps -a' en el contenedor...${NC}"
if docker exec pp_client docker ps -a &> /dev/null; then
    CONTAINER_COUNT=$(docker exec pp_client docker ps -a --format "{{.Names}}" | wc -l)
    echo -e "${GREEN}   ✅ docker ps -a funciona: $CONTAINER_COUNT contenedores encontrados${NC}"
else
    echo -e "${RED}   ❌ docker ps -a falló${NC}"
    echo "   Verifica permisos del socket de Docker"
    exit 1
fi

# Verificación 5: Health check del API
echo ""
echo -e "${YELLOW}5. Verificando health del API del cliente...${NC}"
sleep 2
if curl -s http://localhost:8100/health | grep -q "healthy"; then
    echo -e "${GREEN}   ✅ API del cliente responde correctamente${NC}"
else
    echo -e "${YELLOW}   ⚠️  API del cliente no responde (puede necesitar más tiempo)${NC}"
fi

# Verificación 6: Endpoint de contenedores
echo ""
echo -e "${YELLOW}6. Probando endpoint /api/containers/report...${NC}"
RESPONSE=$(curl -s http://localhost:8100/api/containers/report)
if echo "$RESPONSE" | grep -q "success"; then
    COUNT=$(echo "$RESPONSE" | grep -o '"containers_count":[0-9]*' | grep -o '[0-9]*')
    echo -e "${GREEN}   ✅ Endpoint funciona: $COUNT contenedores reportados${NC}"
else
    echo -e "${RED}   ❌ Endpoint falló${NC}"
    echo "   Respuesta: $RESPONSE"
    exit 1
fi

# Verificación 7: Script de verificación (si existe)
if [ -f "client/utils/check_docker.sh" ]; then
    echo ""
    echo -e "${YELLOW}7. Ejecutando script de verificación completo...${NC}"
    docker exec pp_client bash /app/client/utils/check_docker.sh
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ SOLUCIÓN APLICADA EXITOSAMENTE                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Resumen:${NC}"
echo "   • Docker CLI instalado en el cliente"
echo "   • Socket de Docker montado correctamente"
echo "   • El cliente puede consultar Docker del host"
echo "   • Endpoint /api/containers/report funciona"
echo ""
echo -e "${BLUE}🎯 Próximos pasos:${NC}"
echo "   1. Prueba desde la UI: Dashboard > Contenedores"
echo "   2. Click en '🔄 Actualizar Estado' para sincronizar"
echo "   3. Verifica que los contenedores se muestran correctamente"
echo ""
echo -e "${BLUE}📝 Comandos útiles:${NC}"
echo "   • Ver logs:    docker logs pp_client --tail 50 --follow"
echo "   • Entrar:      docker exec -it pp_client bash"
echo "   • Test API:    curl http://localhost:8100/api/containers/report | jq"
echo "   • Test docker: docker exec -it pp_client docker ps -a"
echo ""
echo -e "${GREEN}¡Listo! El cliente ahora puede acceder a Docker correctamente.${NC}"
echo ""
