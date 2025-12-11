#!/bin/bash

echo "🧪 Testing Client Database Setup"
echo "================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar que client_db está corriendo
echo "1️⃣ Checking if client_db is running..."
if docker compose ps client_db | grep -q "Up"; then
    echo -e "${GREEN}✅ client_db is running${NC}"
else
    echo -e "${RED}❌ client_db is not running${NC}"
    echo "   Run: docker compose up -d client_db"
    exit 1
fi
echo ""

# 2. Verificar conexión a la base de datos
echo "2️⃣ Testing database connection..."
if docker compose exec -T client_db psql -U postgres -d mydb -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Cannot connect to database${NC}"
    exit 1
fi
echo ""

# 3. Verificar que la tabla users existe
echo "3️⃣ Checking if users table exists..."
if docker compose exec -T client_db psql -U postgres -d mydb -c "\dt users" | grep -q "users"; then
    echo -e "${GREEN}✅ users table exists${NC}"
    
    # Mostrar estructura de la tabla
    echo ""
    echo "   Table structure:"
    docker compose exec -T client_db psql -U postgres -d mydb -c "\d users"
else
    echo -e "${YELLOW}⚠️  users table does not exist yet${NC}"
    echo "   It will be created automatically on first sync"
fi
echo ""

# 4. Verificar health endpoint del cliente
echo "4️⃣ Testing client health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:8100/health 2>&1)
if echo "$HEALTH_RESPONSE" | grep -q "status"; then
    echo -e "${GREEN}✅ Client health endpoint responding${NC}"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}❌ Client health endpoint not responding${NC}"
    echo "   Make sure client container is running: docker compose up -d client"
fi
echo ""

# 5. Contar usuarios en la base de datos
echo "5️⃣ Counting users in database..."
USER_COUNT=$(docker compose exec -T client_db psql -U postgres -d mydb -t -A -c "SELECT COUNT(*) FROM users" 2>/dev/null || echo "0")
echo "   Users in database: $USER_COUNT"
echo ""

echo "================================"
echo "✅ Test completed!"
