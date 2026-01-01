#!/bin/bash

# Script para aplicar la migración de soft delete a ansible_tasks
# Descripción: Agrega columnas is_active y deleted_at para implementar soft delete
# Documentación: Ver README.md sección "Soft Delete de Playbooks"
# Migración SQL: server/migrations/add_soft_delete_to_ansible_tasks.sql

set -e  # Exit on error

echo "================================================"
echo "  Migración: Soft Delete para Ansible Playbooks"
echo "================================================"
echo ""

# Detectar si estamos usando docker-compose
if [ -f "docker-compose.yml" ]; then
    echo "✓ Detectado docker-compose.yml"

    # Verificar que el contenedor de PostgreSQL esté corriendo
    if docker-compose ps | grep -q "postgres.*Up"; then
        echo "✓ Contenedor de PostgreSQL está corriendo"

        # Obtener nombre del contenedor de PostgreSQL
        POSTGRES_CONTAINER=$(docker-compose ps -q postgres 2>/dev/null || docker-compose ps -q db 2>/dev/null)

        if [ -z "$POSTGRES_CONTAINER" ]; then
            echo "✗ Error: No se pudo encontrar el contenedor de PostgreSQL"
            echo "  Contenedores disponibles:"
            docker-compose ps
            exit 1
        fi

        echo "✓ Usando contenedor: $POSTGRES_CONTAINER"
        echo ""

        # Leer variables de entorno del docker-compose
        DB_NAME=${POSTGRES_DB:-"pp_db"}
        DB_USER=${POSTGRES_USER:-"pp_user"}

        echo "  Base de datos: $DB_NAME"
        echo "  Usuario: $DB_USER"
        echo ""

        read -p "¿Continuar con la migración? (y/n): " -n 1 -r
        echo

        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Migración cancelada."
            exit 0
        fi

        echo ""
        echo "Aplicando migración..."
        echo ""

        # Aplicar migración
        docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < server/migrations/add_soft_delete_to_ansible_tasks.sql

        if [ $? -eq 0 ]; then
            echo ""
            echo "================================================"
            echo "  ✓ Migración aplicada exitosamente"
            echo "================================================"
            echo ""
            echo "Cambios realizados:"
            echo "  • Agregada columna 'is_active' a ansible_tasks"
            echo "  • Agregada columna 'deleted_at' a ansible_tasks"
            echo "  • Creado índice en is_active"
            echo ""
            echo "Próximos pasos:"
            echo "  1. Reiniciar el servidor de FastAPI:"
            echo "     docker-compose restart server"
            echo ""
            echo "  2. Verificar que todo funciona:"
            echo "     curl http://localhost:8000/api/ansible/playbooks"
            echo ""
            echo "  3. Verificar nuevos endpoints:"
            echo "     GET  /api/ansible/playbooks/deleted"
            echo "     POST /api/ansible/playbooks/{id}/restore"
            echo ""
            echo "  4. Leer documentación completa:"
            echo "     • README.md - Sección 'Soft Delete de Playbooks'"
            echo "     • server/README.md - Sección 'Soft Delete de Playbooks'"
            echo ""
        else
            echo ""
            echo "✗ Error al aplicar la migración"
            echo "  Verifica los logs arriba para más detalles"
            exit 1
        fi

    else
        echo "✗ Error: El contenedor de PostgreSQL no está corriendo"
        echo "  Inicia los contenedores con: docker-compose up -d"
        exit 1
    fi

else
    echo "✗ Error: No se encontró docker-compose.yml"
    echo ""
    echo "Si no estás usando Docker, aplica la migración manualmente:"
    echo "  psql -U usuario -d database < server/migrations/add_soft_delete_to_ansible_tasks.sql"
    echo ""
    exit 1
fi
