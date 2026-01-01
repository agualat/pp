#!/bin/bash

# Script de test para verificar la sincronización de contenedores
# Este script prueba la comunicación entre el servidor central y los clientes

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Test de Sincronización de Contenedores                ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Variables
API_URL="${API_URL:-http://localhost:8000}"
CLIENT_URL="${CLIENT_URL:-http://localhost:8100}"
TOKEN=""
SERVER_ID=""

# Función para imprimir mensajes
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Función para hacer login y obtener token
login() {
    echo ""
    echo -e "${BLUE}=== Paso 1: Autenticación ===${NC}"

    read -p "Usuario admin (default: admin): " USERNAME
    USERNAME=${USERNAME:-admin}

    read -sp "Contraseña (default: admin123): " PASSWORD
    echo ""
    PASSWORD=${PASSWORD:-admin123}

    print_info "Autenticando como $USERNAME..."

    RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=$USERNAME&password=$PASSWORD")

    TOKEN=$(echo $RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

    if [ -z "$TOKEN" ]; then
        print_error "Error de autenticación"
        echo "Respuesta: $RESPONSE"
        exit 1
    fi

    print_success "Autenticación exitosa"
    echo "Token: ${TOKEN:0:20}..."
}

# Función para listar servidores
list_servers() {
    echo ""
    echo -e "${BLUE}=== Paso 2: Listar Servidores ===${NC}"

    print_info "Obteniendo lista de servidores..."

    RESPONSE=$(curl -s -X GET "$API_URL/servers" \
        -H "Authorization: Bearer $TOKEN")

    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    # Extraer primer servidor con SSH configurado
    SERVER_ID=$(echo "$RESPONSE" | jq -r '.[] | select(.ssh_status == "deployed") | .id' | head -n1)

    if [ -z "$SERVER_ID" ]; then
        print_warning "No se encontraron servidores con SSH configurado"
        read -p "Ingrese ID del servidor manualmente: " SERVER_ID
    else
        print_success "Servidor encontrado: ID=$SERVER_ID"
    fi
}

# Función para verificar health del cliente
check_client_health() {
    echo ""
    echo -e "${BLUE}=== Paso 3: Verificar Cliente ===${NC}"

    read -p "URL del cliente (default: $CLIENT_URL): " INPUT_CLIENT_URL
    CLIENT_URL=${INPUT_CLIENT_URL:-$CLIENT_URL}

    print_info "Verificando health del cliente en $CLIENT_URL..."

    RESPONSE=$(curl -s -X GET "$CLIENT_URL/health" || echo "ERROR")

    if [ "$RESPONSE" = "ERROR" ]; then
        print_error "No se pudo conectar al cliente en $CLIENT_URL"
        print_warning "Asegúrate de que el cliente está corriendo"
        return 1
    fi

    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    print_success "Cliente está disponible"
}

# Función para verificar tabla de contenedores en el cliente
check_client_db() {
    echo ""
    echo -e "${BLUE}=== Paso 4: Verificar BD del Cliente ===${NC}"

    print_info "Verificando reporte de contenedores..."

    RESPONSE=$(curl -s -X GET "$CLIENT_URL/api/containers/report" || echo "ERROR")

    if [ "$RESPONSE" = "ERROR" ]; then
        print_error "No se pudo obtener reporte del cliente"
        return 1
    fi

    COUNT=$(echo "$RESPONSE" | jq '. | length' 2>/dev/null || echo "0")

    print_success "Cliente tiene $COUNT contenedores en su BD local"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
}

# Función para listar contenedores del servidor central
list_central_containers() {
    echo ""
    echo -e "${BLUE}=== Paso 5: Contenedores en Servidor Central ===${NC}"

    print_info "Obteniendo contenedores del servidor central..."

    RESPONSE=$(curl -s -X GET "$API_URL/containers/all" \
        -H "Authorization: Bearer $TOKEN")

    COUNT=$(echo "$RESPONSE" | jq '. | length' 2>/dev/null || echo "0")

    print_success "Servidor central tiene $COUNT contenedores totales"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
}

# Función para sincronizar servidor específico
sync_specific_server() {
    echo ""
    echo -e "${BLUE}=== Paso 6: Sincronizar Servidor Específico ===${NC}"

    if [ -z "$SERVER_ID" ]; then
        print_warning "No hay SERVER_ID disponible, saltando..."
        return 1
    fi

    print_info "Sincronizando contenedores con servidor ID=$SERVER_ID..."

    RESPONSE=$(curl -s -X POST "$API_URL/containers/sync/server/$SERVER_ID" \
        -H "Authorization: Bearer $TOKEN")

    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)

    if [ "$SUCCESS" = "true" ]; then
        SYNCED=$(echo "$RESPONSE" | jq -r '.sync_result.containers_synced' 2>/dev/null)
        CREATED=$(echo "$RESPONSE" | jq -r '.sync_result.containers_created' 2>/dev/null)
        UPDATED=$(echo "$RESPONSE" | jq -r '.sync_result.containers_updated' 2>/dev/null)
        DELETED=$(echo "$RESPONSE" | jq -r '.sync_result.containers_deleted' 2>/dev/null)

        print_success "Sincronización exitosa"
        echo "  - Contenedores sincronizados: $SYNCED"
        echo "  - Creados: $CREATED"
        echo "  - Actualizados: $UPDATED"
        echo "  - Eliminados: $DELETED"
    else
        print_error "Error en sincronización"
    fi
}

# Función para sincronizar todos los servidores
sync_all_servers() {
    echo ""
    echo -e "${BLUE}=== Paso 7: Sincronizar Todos los Servidores ===${NC}"

    read -p "¿Desea sincronizar todos los servidores? (y/N): " CONFIRM

    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        print_info "Saltando sincronización de todos los servidores"
        return 0
    fi

    print_info "Sincronizando todos los servidores..."

    RESPONSE=$(curl -s -X POST "$API_URL/containers/sync/all" \
        -H "Authorization: Bearer $TOKEN")

    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)

    if [ "$SUCCESS" = "true" ]; then
        TOTAL=$(echo "$RESPONSE" | jq -r '.results.total_servers' 2>/dev/null)
        SUCCESS_COUNT=$(echo "$RESPONSE" | jq -r '.results.success' 2>/dev/null)
        FAILED=$(echo "$RESPONSE" | jq -r '.results.failed' 2>/dev/null)

        print_success "Sincronización masiva completada"
        echo "  - Total servidores: $TOTAL"
        echo "  - Exitosos: $SUCCESS_COUNT"
        echo "  - Fallidos: $FAILED"
    else
        print_error "Error en sincronización masiva"
    fi
}

# Función para obtener estado de servidor
get_server_status() {
    echo ""
    echo -e "${BLUE}=== Paso 8: Obtener Estado del Servidor ===${NC}"

    if [ -z "$SERVER_ID" ]; then
        print_warning "No hay SERVER_ID disponible, saltando..."
        return 1
    fi

    print_info "Obteniendo estado de contenedores del servidor ID=$SERVER_ID..."

    RESPONSE=$(curl -s -X GET "$API_URL/containers/status/server/$SERVER_ID" \
        -H "Authorization: Bearer $TOKEN")

    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)

    if [ "$SUCCESS" = "true" ]; then
        COUNT=$(echo "$RESPONSE" | jq -r '.containers_count' 2>/dev/null)
        print_success "Estado obtenido exitosamente"
        echo "  - Contenedores en el servidor: $COUNT"
    else
        print_error "Error al obtener estado"
    fi
}

# Función para crear un contenedor de prueba
create_test_container() {
    echo ""
    echo -e "${BLUE}=== Paso 9: Crear Contenedor de Prueba (Opcional) ===${NC}"

    read -p "¿Desea crear un contenedor de prueba? (y/N): " CONFIRM

    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        print_info "Saltando creación de contenedor"
        return 0
    fi

    if [ -z "$SERVER_ID" ]; then
        print_error "No hay SERVER_ID disponible"
        return 1
    fi

    read -p "Nombre del contenedor (default: test-sync-$(date +%s)): " CONTAINER_NAME
    CONTAINER_NAME=${CONTAINER_NAME:-test-sync-$(date +%s)}

    read -p "Imagen Docker (default: nginx:alpine): " IMAGE
    IMAGE=${IMAGE:-nginx:alpine}

    read -p "Puerto (default: 8080:80): " PORTS
    PORTS=${PORTS:-8080:80}

    print_info "Creando contenedor '$CONTAINER_NAME'..."

    RESPONSE=$(curl -s -X POST "$API_URL/containers" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$CONTAINER_NAME\",
            \"server_id\": $SERVER_ID,
            \"image\": \"$IMAGE\",
            \"ports\": \"$PORTS\"
        }")

    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    ID=$(echo "$RESPONSE" | jq -r '.id' 2>/dev/null)

    if [ "$ID" != "null" ] && [ ! -z "$ID" ]; then
        print_success "Contenedor creado exitosamente (ID=$ID)"
        print_info "La sincronización automática debería haber ocurrido"

        # Verificar en el cliente
        sleep 2
        echo ""
        print_info "Verificando sincronización en el cliente..."
        check_client_db
    else
        print_error "Error al crear contenedor"
    fi
}

# Función principal
main() {
    # Verificar dependencias
    if ! command -v jq &> /dev/null; then
        print_warning "jq no está instalado. Instálalo para mejor formato de JSON:"
        print_info "  apt-get install jq  (Debian/Ubuntu)"
        print_info "  brew install jq     (macOS)"
        echo ""
    fi

    if ! command -v curl &> /dev/null; then
        print_error "curl no está instalado"
        exit 1
    fi

    # Ejecutar tests
    login
    list_servers
    check_client_health || print_warning "Cliente no disponible, algunos tests fallarán"
    check_client_db || true
    list_central_containers
    sync_specific_server || true
    sync_all_servers || true
    get_server_status || true
    create_test_container || true

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     Test de Sincronización Completado                     ║${NC}"
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo ""
    print_info "Revisa los logs para más detalles:"
    echo "  - Servidor: docker logs pp_api --tail 50"
    echo "  - Cliente:  docker logs pp_client --tail 50"
}

# Ejecutar
main
