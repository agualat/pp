# Guía de Ejecución de Servicios

## Ejecutar Todo el Sistema (Recomendado)

```bash
# Iniciar todos los servicios
docker-compose up

# En modo background
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener todo
docker-compose down
```

**Servicios que se ejecutan:**
- `db` - PostgreSQL con replicación (puerto 5432)
- `api` - Servidor FastAPI (puerto 8000)
- `worker` - Celery worker para tareas Ansible
- `client` - Cliente con métricas y NSS/PAM (puerto 8100)

---

## Ejecutar Solo el Cliente

### Opción 1: Docker con dependencias mínimas

```bash
# Cliente + Base de datos (necesario para NSS/PAM)
docker-compose up db client

# En background
docker-compose up -d db client
```

**Nota**: El cliente enviará métricas al servidor API, así que si no está corriendo verás errores de conexión (no críticos).

### Opción 2: Cliente completo con API

```bash
# Cliente + Base de datos + API + Worker
docker-compose up db api worker client

# En background
docker-compose up -d db api worker client
```

### Opción 3: Solo contenedor del cliente

```bash
# Construir imagen del cliente
docker-compose build client

# Ejecutar solo el cliente (requiere BD externa)
docker-compose up client
```

---

## Ejecutar Solo el Servidor API

```bash
# API + Base de datos + Worker
docker-compose up db api worker

# En background
docker-compose up -d db api worker
```

---

## Ejecutar Solo la Base de Datos

```bash
# Solo PostgreSQL
docker-compose up db

# En background
docker-compose up -d db

# Conectarse a la BD
docker exec -it pp_db psql -U postgres -d mydb
```

---

## Verificar Estado de Servicios

### Con Docker:
```bash
# Ver servicios corriendo
docker-compose ps

# Ver logs de un servicio específico
docker-compose logs -f client
docker-compose logs -f api
docker-compose logs -f worker

# Reiniciar un servicio
docker-compose restart client
```

### Endpoints de salud:

```bash
# Cliente
curl http://localhost:8100/

# API
curl http://localhost:8000/

# Base de datos
docker exec -it pp_db pg_isready -U postgres -d mydb
```

---

## Reconstruir Servicios

```bash
# Reconstruir todos los servicios
docker-compose build

# Reconstruir solo el cliente
docker-compose build client

# Reconstruir y reiniciar
docker-compose up -d --build
```

---

## Limpiar Todo

```bash
# Detener y eliminar contenedores
docker-compose down

# Eliminar volúmenes también (⚠️ BORRA DATOS)
docker-compose down -v

# Limpiar imágenes
docker-compose down --rmi all
```

---

## Configuración de Red

Por defecto, los servicios se comunican internamente:

- `api` → `db:5432`
- `client` → `api:8000`
- `client` → `db:5432`
- `worker` → `db:5432`

Para acceder desde tu máquina:

- API: `http://localhost:8000`
- Cliente: `http://localhost:8100`
- Base de datos: `localhost:5432`

---

## Solución de Problemas

### El cliente no puede conectarse a la API:
```bash
# Verificar que la API esté corriendo
docker-compose ps api
docker-compose logs api

# Verificar conectividad
docker exec pp_client curl http://api:8000/
```

### El cliente no puede conectarse a la base de datos:
```bash
# Verificar que PostgreSQL esté corriendo
docker-compose ps db
docker-compose logs db

# Verificar conectividad
docker exec pp_client pg_isready -h db -p 5432 -U postgres
```

### Errores de NSS/PAM:
```bash
# Ver logs del setup
docker-compose logs client | grep NSS

# Verificar archivos de configuración
docker exec pp_client cat /etc/nss-pgsql.conf
docker exec pp_client cat /etc/pam-pgsql.conf
```

### Puerto ya en uso:
```bash
# Cambiar puertos en docker-compose.yml
# Por ejemplo, cambiar 8100:8100 a 8101:8100
```

---

## Modo de Producción

```bash
# Usar archivo .env de producción
cp .env.example .env
nano .env  # Editar con valores de producción

# Ejecutar con configuración de producción
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
