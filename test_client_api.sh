#!/bin/bash

# Script para testear la API del cliente
# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
CLIENT_HOST="${CLIENT_HOST:-localhost}"
CLIENT_PORT="${CLIENT_PORT:-8100}"
BASE_URL="http://${CLIENT_HOST}:${CLIENT_PORT}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test API Cliente - Proyecto PP${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Base URL: ${BASE_URL}\n"

# Función para hacer peticiones y mostrar resultados
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -e "${YELLOW}Testing:${NC} ${description}"
    echo -e "${BLUE}${method} ${endpoint}${NC}"
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${BASE_URL}${endpoint}")
    elif [ "$method" == "POST" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "${data}" \
            "${BASE_URL}${endpoint}")
    fi
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ SUCCESS${NC} (HTTP $http_code)"
        echo -e "Response:\n${body}" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo -e "Response:\n${body}"
    fi
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
}

# Verificar que el servicio está corriendo
echo -e "${YELLOW}Verificando que el servicio está disponible...${NC}"
if ! curl -s "${BASE_URL}/" > /dev/null 2>&1; then
    echo -e "${RED}✗ Error: No se puede conectar a ${BASE_URL}${NC}"
    echo -e "${YELLOW}Asegúrate de que el contenedor del cliente está corriendo:${NC}"
    echo -e "  docker-compose up -d client"
    exit 1
fi
echo -e "${GREEN}✓ Servicio disponible${NC}\n"

# Test 1: Endpoint raíz
test_endpoint "GET" "/" "Verificar endpoint raíz"

# Test 2: Métricas locales detalladas
test_endpoint "GET" "/metrics/local" "Obtener métricas locales detalladas del sistema"

# Test 3: Métricas en formato servidor (por defecto server_id=1)
test_endpoint "GET" "/metrics/server-format" "Obtener métricas en formato compacto (server_id=1)"

# Test 4: Métricas en formato servidor con server_id específico
test_endpoint "GET" "/metrics/server-format?server_id=5" "Obtener métricas con server_id=5"

# Test 5: Verificar estructura de respuesta de métricas locales
echo -e "${YELLOW}Testing:${NC} Validar estructura de métricas locales"
echo -e "${BLUE}GET /metrics/local${NC}"
response=$(curl -s "${BASE_URL}/metrics/local")
echo "$response" | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ JSON válido${NC}"
    
    # Verificar campos esperados
    cpu=$(echo "$response" | jq -r '.data.cpu // empty')
    memory=$(echo "$response" | jq -r '.data.memory // empty')
    disk=$(echo "$response" | jq -r '.data.disk // empty')
    
    if [ ! -z "$cpu" ] && [ ! -z "$memory" ] && [ ! -z "$disk" ]; then
        echo -e "${GREEN}✓ Contiene campos esperados (cpu, memory, disk)${NC}"
        echo -e "CPU: $cpu"
        echo -e "Memory: $memory"
        echo -e "Disk: $disk"
    else
        echo -e "${RED}✗ Faltan campos esperados${NC}"
    fi
else
    echo -e "${RED}✗ Respuesta no es JSON válido${NC}"
fi
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 6: Verificar estructura de métricas en formato servidor
echo -e "${YELLOW}Testing:${NC} Validar estructura de métricas formato servidor"
echo -e "${BLUE}GET /metrics/server-format${NC}"
response=$(curl -s "${BASE_URL}/metrics/server-format")
echo "$response" | jq '.' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ JSON válido${NC}"
    
    # Verificar campos esperados para el formato servidor
    server_id=$(echo "$response" | jq -r '.server_id // empty')
    cpu_usage=$(echo "$response" | jq -r '.cpu_usage // empty')
    memory_usage=$(echo "$response" | jq -r '.memory_usage // empty')
    disk_usage=$(echo "$response" | jq -r '.disk_usage // empty')
    timestamp=$(echo "$response" | jq -r '.timestamp // empty')
    
    if [ ! -z "$server_id" ] && [ ! -z "$cpu_usage" ] && [ ! -z "$memory_usage" ] && [ ! -z "$disk_usage" ] && [ ! -z "$timestamp" ]; then
        echo -e "${GREEN}✓ Contiene campos esperados del formato servidor${NC}"
        echo -e "Server ID: $server_id"
        echo -e "CPU Usage: $cpu_usage"
        echo -e "Memory Usage: $memory_usage"
        echo -e "Disk Usage: $disk_usage"
        echo -e "Timestamp: $timestamp"
    else
        echo -e "${RED}✗ Faltan campos esperados${NC}"
    fi
else
    echo -e "${RED}✗ Respuesta no es JSON válido${NC}"
fi
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 7: Test de rendimiento - múltiples peticiones
echo -e "${YELLOW}Testing:${NC} Rendimiento - 10 peticiones consecutivas"
echo -e "${BLUE}GET /metrics/local (x10)${NC}"
success_count=0
total_time=0

for i in {1..10}; do
    start_time=$(date +%s%N)
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/metrics/local")
    end_time=$(date +%s%N)
    
    elapsed=$((($end_time - $start_time) / 1000000)) # convertir a ms
    total_time=$(($total_time + $elapsed))
    
    if [ "$http_code" -eq 200 ]; then
        success_count=$(($success_count + 1))
        echo -e "  Request $i: ${GREEN}✓${NC} ${elapsed}ms"
    else
        echo -e "  Request $i: ${RED}✗${NC} HTTP $http_code"
    fi
done

avg_time=$(($total_time / 10))
echo -e "\nResultados:"
echo -e "  Exitosas: ${GREEN}${success_count}/10${NC}"
echo -e "  Tiempo promedio: ${avg_time}ms"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 8: Documentación automática (Swagger)
echo -e "${YELLOW}Testing:${NC} Verificar acceso a documentación Swagger"
echo -e "${BLUE}GET /docs${NC}"
http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/docs")
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Documentación disponible${NC}"
    echo -e "URL: ${BASE_URL}/docs"
else
    echo -e "${RED}✗ Documentación no disponible (HTTP $http_code)${NC}"
fi
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 9: OpenAPI Schema
echo -e "${YELLOW}Testing:${NC} Verificar esquema OpenAPI"
echo -e "${BLUE}GET /openapi.json${NC}"
http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/openapi.json")
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Esquema OpenAPI disponible${NC}"
    echo -e "URL: ${BASE_URL}/openapi.json"
else
    echo -e "${RED}✗ Esquema OpenAPI no disponible (HTTP $http_code)${NC}"
fi
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Resumen final
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Resumen de Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Tests completados${NC}"
echo -e "\nEndpoints testeados:"
echo -e "  • GET  /                          - Endpoint raíz"
echo -e "  • GET  /metrics/local             - Métricas detalladas"
echo -e "  • GET  /metrics/server-format     - Métricas formato servidor"
echo -e "  • GET  /docs                      - Documentación Swagger"
echo -e "  • GET  /openapi.json              - Esquema OpenAPI"
echo -e "\n${YELLOW}Nota:${NC} Para testear el WebSocket /ws/status, usa un cliente WebSocket"
echo -e "Ejemplo con websocat:"
echo -e "  websocat ws://${CLIENT_HOST}:${CLIENT_PORT}/ws/status"
echo -e "\nO con JavaScript en el navegador:"
echo -e "  const ws = new WebSocket('ws://${CLIENT_HOST}:${CLIENT_PORT}/ws/status');"
echo -e "  ws.onmessage = (event) => console.log(JSON.parse(event.data));"
echo -e "\n${BLUE}========================================${NC}"
