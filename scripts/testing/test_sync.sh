#!/bin/bash

# Script de prueba para verificar la sincronización automática de usuarios

echo "=== Test de Sincronización Automática de Usuarios ==="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Obtener token de autenticación
echo -e "${YELLOW}1. Obteniendo token de autenticación...${NC}"
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}' | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Error: No se pudo obtener el token"
  exit 1
fi

echo -e "${GREEN}✓ Token obtenido${NC}"
echo ""

# Crear un usuario de prueba
echo -e "${YELLOW}2. Creando usuario de prueba...${NC}"
TEST_USER="test_sync_$(date +%s)"
RESPONSE=$(curl -s -X POST "http://localhost:8000/users/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$TEST_USER\", \"email\": \"${TEST_USER}@test.com\", \"password\": \"test123\"}")

echo "Respuesta: $RESPONSE"
USER_ID=$(echo $RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$USER_ID" ]; then
  echo "Error: No se pudo crear el usuario"
  exit 1
fi

echo -e "${GREEN}✓ Usuario creado con ID: $USER_ID${NC}"
echo ""

# Esperar un momento para que se complete la sincronización
echo -e "${YELLOW}3. Esperando sincronización (3 segundos)...${NC}"
sleep 3
echo ""

# Verificar en la base de datos del cliente
echo -e "${YELLOW}4. Verificando usuario en la base de datos del cliente...${NC}"
docker compose exec -T client_db psql -U postgres -d mydb -c "SELECT id, username, email FROM users WHERE username = '$TEST_USER';"

# Verificar mediante el endpoint de sincronización
echo ""
echo -e "${YELLOW}5. Verificando respuesta del cliente...${NC}"
CLIENT_RESPONSE=$(curl -s "http://localhost:8100/api/sync/users" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "[]")

echo "Respuesta del cliente: $CLIENT_RESPONSE"
echo ""

# Probar sincronización manual
echo -e "${YELLOW}6. Probando sincronización manual...${NC}"
SYNC_RESPONSE=$(curl -s -X POST "http://localhost:8000/sync/users/manual" \
  -H "Authorization: Bearer $TOKEN")

echo "Respuesta de sincronización manual:"
echo "$SYNC_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SYNC_RESPONSE"
echo ""

# Eliminar usuario de prueba
echo -e "${YELLOW}7. Limpiando usuario de prueba...${NC}"
curl -s -X DELETE "http://localhost:8000/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "${GREEN}✓ Usuario eliminado${NC}"
echo ""

# Esperar sincronización de eliminación
echo -e "${YELLOW}8. Esperando sincronización de eliminación (3 segundos)...${NC}"
sleep 3
echo ""

# Verificar que se eliminó en el cliente
echo -e "${YELLOW}9. Verificando eliminación en el cliente...${NC}"
docker compose exec -T client_db psql -U postgres -d mydb -c "SELECT id, username FROM users WHERE username = '$TEST_USER';"
echo ""

echo -e "${GREEN}=== Test completado ===${NC}"
