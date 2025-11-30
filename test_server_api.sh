#!/bin/bash

# Script para testear la API del servidor
# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuración
SERVER_HOST="${SERVER_HOST:-localhost}"
SERVER_PORT="${SERVER_PORT:-8000}"
BASE_URL="http://${SERVER_HOST}:${SERVER_PORT}"

# Variables globales para tokens y datos de test
TOKEN=""
USER_ID=""
SERVER_ID=""
PLAYBOOK_ID=""
EXECUTION_ID=""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test API Servidor - Proyecto PP${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Base URL: ${BASE_URL}\n"

# Función para hacer peticiones y mostrar resultados
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    local auth=$5
    
    echo -e "${YELLOW}Testing:${NC} ${description}"
    echo -e "${BLUE}${method} ${endpoint}${NC}"
    
    # Construir comando curl
    local curl_cmd="curl -s -w \"\nHTTP_CODE:%{http_code}\""
    
    if [ ! -z "$auth" ] && [ "$auth" == "true" ]; then
        curl_cmd="$curl_cmd -H \"Authorization: Bearer $TOKEN\""
    fi
    
    if [ "$method" == "GET" ]; then
        response=$(eval "$curl_cmd \"${BASE_URL}${endpoint}\"")
    elif [ "$method" == "POST" ]; then
        response=$(eval "$curl_cmd -X POST -H \"Content-Type: application/json\" -d '$data' \"${BASE_URL}${endpoint}\"")
    elif [ "$method" == "PUT" ]; then
        response=$(eval "$curl_cmd -X PUT -H \"Content-Type: application/json\" -d '$data' \"${BASE_URL}${endpoint}\"")
    elif [ "$method" == "PATCH" ]; then
        response=$(eval "$curl_cmd -X PATCH -H \"Content-Type: application/json\" -d '$data' \"${BASE_URL}${endpoint}\"")
    elif [ "$method" == "DELETE" ]; then
        response=$(eval "$curl_cmd -X DELETE \"${BASE_URL}${endpoint}\"")
    fi
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ SUCCESS${NC} (HTTP $http_code)"
        echo -e "Response:\n${body}" | jq '.' 2>/dev/null || echo "$body"
        echo "$body"
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo -e "Response:\n${body}" | jq '.' 2>/dev/null || echo "$body"
        echo ""
    fi
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
}

# Verificar que el servicio está corriendo
echo -e "${YELLOW}Verificando que el servicio está disponible...${NC}"
if ! curl -s "${BASE_URL}/" > /dev/null 2>&1; then
    echo -e "${RED}✗ Error: No se puede conectar a ${BASE_URL}${NC}"
    echo -e "${YELLOW}Asegúrate de que el contenedor del servidor está corriendo:${NC}"
    echo -e "  docker-compose up -d api"
    exit 1
fi
echo -e "${GREEN}✓ Servicio disponible${NC}\n"

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  FASE 1: Autenticación${NC}"
echo -e "${CYAN}================================================${NC}\n"

# Test 1: Endpoint raíz
echo -e "${YELLOW}Testing:${NC} Verificar endpoint raíz"
echo -e "${BLUE}GET /${NC}"
response=$(curl -s "${BASE_URL}/")
echo -e "${GREEN}✓ SUCCESS${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 2: Signup (crear usuario administrador de prueba)
echo -e "${YELLOW}Testing:${NC} Registro de usuario administrador"
echo -e "${BLUE}POST /auth/signup${NC}"
SIGNUP_DATA='{
  "username": "admin_test",
  "email": "admin@test.com",
  "password": "Admin123!"
}'
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$SIGNUP_DATA" \
    "${BASE_URL}/auth/signup")

http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
    echo -e "${GREEN}✓ Usuario creado${NC} (HTTP $http_code)"
    TOKEN=$(echo "$body" | jq -r '.access_token')
    echo -e "Token obtenido: ${TOKEN:0:50}..."
elif [ "$http_code" -eq 400 ]; then
    echo -e "${YELLOW}⚠ Usuario ya existe, intentando login...${NC}"
else
    echo -e "${RED}✗ Error en signup${NC} (HTTP $http_code)"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
fi
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 3: Login (si signup falló)
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Testing:${NC} Login de usuario administrador"
    echo -e "${BLUE}POST /auth/login${NC}"
    LOGIN_DATA='{
      "username": "admin_test",
      "password": "Admin123!"
    }'
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$LOGIN_DATA" \
        "${BASE_URL}/auth/login")
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ Login exitoso${NC}"
        TOKEN=$(echo "$body" | jq -r '.access_token')
        echo -e "Token obtenido: ${TOKEN:0:50}..."
    else
        echo -e "${RED}✗ Login falló${NC} (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        echo -e "\n${RED}No se puede continuar sin autenticación${NC}"
        exit 1
    fi
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
fi

# Test 4: Verificar token
echo -e "${YELLOW}Testing:${NC} Verificar token"
echo -e "${BLUE}GET /auth/verify${NC}"
response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/auth/verify")
echo -e "${GREEN}✓ Token válido${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
USER_ID=$(echo "$response" | jq -r '.user_id')
echo -e "User ID: $USER_ID"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  FASE 2: Gestión de Servidores${NC}"
echo -e "${CYAN}================================================${NC}\n"

# Test 5: Crear servidor
echo -e "${YELLOW}Testing:${NC} Crear servidor"
echo -e "${BLUE}POST /servers/${NC}"
SERVER_DATA='{
  "name": "test-server-1",
  "ip_address": "192.168.1.100",
  "ssh_user": "root",
  "ssh_password": "password123"
}'
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$SERVER_DATA" \
    "${BASE_URL}/servers/")

http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ Servidor creado${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    SERVER_ID=$(echo "$body" | jq -r '.id')
    echo -e "Server ID: $SERVER_ID"
elif [ "$http_code" -eq 400 ]; then
    echo -e "${YELLOW}⚠ Servidor ya existe${NC}"
    # Intentar obtener el servidor existente
    existing=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/servers/by-name/test-server-1")
    SERVER_ID=$(echo "$existing" | jq -r '.id')
    echo -e "Server ID existente: $SERVER_ID"
else
    echo -e "${RED}✗ Error al crear servidor${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
fi
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 6: Listar todos los servidores
echo -e "${YELLOW}Testing:${NC} Listar todos los servidores"
echo -e "${BLUE}GET /servers/${NC}"
response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/servers/")
echo -e "${GREEN}✓ SUCCESS${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 7: Obtener servidor por ID
if [ ! -z "$SERVER_ID" ]; then
    echo -e "${YELLOW}Testing:${NC} Obtener servidor por ID"
    echo -e "${BLUE}GET /servers/${SERVER_ID}${NC}"
    response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/servers/${SERVER_ID}")
    echo -e "${GREEN}✓ SUCCESS${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
fi

# Test 8: Actualizar estado del servidor
if [ ! -z "$SERVER_ID" ]; then
    echo -e "${YELLOW}Testing:${NC} Actualizar servidor a online"
    echo -e "${BLUE}PUT /servers/${SERVER_ID}/online${NC}"
    response=$(curl -s -X PUT -H "Authorization: Bearer $TOKEN" "${BASE_URL}/servers/${SERVER_ID}/online")
    echo -e "${GREEN}✓ SUCCESS${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
fi

# Test 9: Contar servidores
echo -e "${YELLOW}Testing:${NC} Contar total de servidores"
echo -e "${BLUE}GET /servers/count/total${NC}"
response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/servers/count/total")
echo -e "${GREEN}✓ SUCCESS${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 10: Obtener métricas del servidor
if [ ! -z "$SERVER_ID" ]; then
    echo -e "${YELLOW}Testing:${NC} Obtener métricas del servidor"
    echo -e "${BLUE}GET /servers/${SERVER_ID}/metrics${NC}"
    response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/servers/${SERVER_ID}/metrics")
    echo -e "${GREEN}✓ SUCCESS${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
fi

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  FASE 3: Gestión de Playbooks Ansible${NC}"
echo -e "${CYAN}================================================${NC}\n"

# Test 11: Crear playbook
echo -e "${YELLOW}Testing:${NC} Crear playbook Ansible"
echo -e "${BLUE}POST /ansible/playbooks${NC}"
PLAYBOOK_DATA='{
  "name": "test-playbook",
  "playbook": "---\n- hosts: all\n  tasks:\n    - name: Test\n      debug:\n        msg: Hello",
  "inventory": "localhost"
}'
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PLAYBOOK_DATA" \
    "${BASE_URL}/ansible/playbooks")

http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ Playbook creado${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    PLAYBOOK_ID=$(echo "$body" | jq -r '.id')
    echo -e "Playbook ID: $PLAYBOOK_ID"
elif [ "$http_code" -eq 400 ]; then
    echo -e "${YELLOW}⚠ Playbook ya existe${NC}"
    # Intentar obtener playbooks existentes
    existing=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/ansible/playbooks")
    PLAYBOOK_ID=$(echo "$existing" | jq -r '.[0].id')
    echo -e "Playbook ID existente: $PLAYBOOK_ID"
else
    echo -e "${RED}✗ Error al crear playbook${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
fi
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 12: Listar playbooks
echo -e "${YELLOW}Testing:${NC} Listar todos los playbooks"
echo -e "${BLUE}GET /ansible/playbooks${NC}"
response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/ansible/playbooks")
echo -e "${GREEN}✓ SUCCESS${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 13: Obtener playbook por ID
if [ ! -z "$PLAYBOOK_ID" ]; then
    echo -e "${YELLOW}Testing:${NC} Obtener playbook por ID"
    echo -e "${BLUE}GET /ansible/playbooks/${PLAYBOOK_ID}${NC}"
    response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/ansible/playbooks/${PLAYBOOK_ID}")
    echo -e "${GREEN}✓ SUCCESS${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
fi

# Test 14: Contar playbooks
echo -e "${YELLOW}Testing:${NC} Contar total de playbooks"
echo -e "${BLUE}GET /ansible/playbooks/count${NC}"
response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/ansible/playbooks/count")
echo -e "${GREEN}✓ SUCCESS${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 15: Ejecutar playbook
if [ ! -z "$PLAYBOOK_ID" ] && [ ! -z "$SERVER_ID" ]; then
    echo -e "${YELLOW}Testing:${NC} Ejecutar playbook en servidor"
    echo -e "${BLUE}POST /ansible/playbooks/${PLAYBOOK_ID}/run${NC}"
    RUN_DATA="[${SERVER_ID}]"
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$RUN_DATA" \
        "${BASE_URL}/ansible/playbooks/${PLAYBOOK_ID}/run?server_ids=${SERVER_ID}")
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ Playbook ejecutado${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        EXECUTION_ID=$(echo "$body" | jq -r '.execution_id')
        echo -e "Execution ID: $EXECUTION_ID"
    else
        echo -e "${YELLOW}⚠ Ejecución no iniciada${NC} (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
fi

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  FASE 4: Historial de Ejecuciones${NC}"
echo -e "${CYAN}================================================${NC}\n"

# Test 16: Listar todas las ejecuciones
echo -e "${YELLOW}Testing:${NC} Listar todas las ejecuciones"
echo -e "${BLUE}GET /executions/${NC}"
response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/executions/")
echo -e "${GREEN}✓ SUCCESS${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 17: Obtener ejecución por ID
if [ ! -z "$EXECUTION_ID" ]; then
    echo -e "${YELLOW}Testing:${NC} Obtener ejecución por ID"
    echo -e "${BLUE}GET /executions/${EXECUTION_ID}${NC}"
    response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/executions/${EXECUTION_ID}")
    echo -e "${GREEN}✓ SUCCESS${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo -e "\n${BLUE}----------------------------------------${NC}\n"
fi

# Test 18: Contar ejecuciones totales
echo -e "${YELLOW}Testing:${NC} Contar ejecuciones totales"
echo -e "${BLUE}GET /executions/count/total${NC}"
response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/executions/count/total")
echo -e "${GREEN}✓ SUCCESS${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 19: Ejecuciones por estado
echo -e "${YELLOW}Testing:${NC} Obtener ejecuciones por estado"
echo -e "${BLUE}GET /executions/by-state/success${NC}"
response=$(curl -s -H "Authorization: Bearer $TOKEN" "${BASE_URL}/executions/by-state/success")
echo -e "${GREEN}✓ SUCCESS${NC}"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo -e "\n${BLUE}----------------------------------------${NC}\n"

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  FASE 5: Documentación y Schema${NC}"
echo -e "${CYAN}================================================${NC}\n"

# Test 20: Documentación Swagger
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

# Test 21: OpenAPI Schema
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
echo -e "${GREEN}Tests completados${NC}\n"

echo -e "${CYAN}Endpoints testeados:${NC}"
echo -e "\n${YELLOW}Autenticación:${NC}"
echo -e "  • POST /auth/signup              - Registro de usuario"
echo -e "  • POST /auth/login               - Login de usuario"
echo -e "  • GET  /auth/verify              - Verificar token"

echo -e "\n${YELLOW}Servidores:${NC}"
echo -e "  • POST /servers/                 - Crear servidor"
echo -e "  • GET  /servers/                 - Listar servidores"
echo -e "  • GET  /servers/{id}             - Obtener servidor por ID"
echo -e "  • PUT  /servers/{id}/online      - Marcar servidor como online"
echo -e "  • GET  /servers/count/total      - Contar servidores"
echo -e "  • GET  /servers/{id}/metrics     - Obtener métricas"

echo -e "\n${YELLOW}Playbooks Ansible:${NC}"
echo -e "  • POST /ansible/playbooks        - Crear playbook"
echo -e "  • GET  /ansible/playbooks        - Listar playbooks"
echo -e "  • GET  /ansible/playbooks/{id}   - Obtener playbook"
echo -e "  • GET  /ansible/playbooks/count  - Contar playbooks"
echo -e "  • POST /ansible/playbooks/{id}/run - Ejecutar playbook"

echo -e "\n${YELLOW}Ejecuciones:${NC}"
echo -e "  • GET  /executions/              - Listar ejecuciones"
echo -e "  • GET  /executions/{id}          - Obtener ejecución"
echo -e "  • GET  /executions/count/total   - Contar ejecuciones"
echo -e "  • GET  /executions/by-state/{s}  - Ejecuciones por estado"

echo -e "\n${YELLOW}Datos creados en este test:${NC}"
[ ! -z "$USER_ID" ] && echo -e "  • Usuario ID: ${USER_ID}"
[ ! -z "$SERVER_ID" ] && echo -e "  • Servidor ID: ${SERVER_ID}"
[ ! -z "$PLAYBOOK_ID" ] && echo -e "  • Playbook ID: ${PLAYBOOK_ID}"
[ ! -z "$EXECUTION_ID" ] && echo -e "  • Ejecución ID: ${EXECUTION_ID}"
[ ! -z "$TOKEN" ] && echo -e "  • Token: ${TOKEN:0:50}..."

echo -e "\n${YELLOW}Nota:${NC} Para testear el WebSocket, usa un cliente WebSocket:"
echo -e "  websocat ws://${SERVER_HOST}:${SERVER_PORT}/ws/server/{server_id}"
echo -e "\n${BLUE}========================================${NC}"
