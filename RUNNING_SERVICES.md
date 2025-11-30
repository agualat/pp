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

### Cliente independiente (recomendado)

```bash
# Solo cliente + su BD local
docker-compose up client_db client

# En background
docker-compose up -d client_db client
```

**Estado:**
- ✅ Cliente funcionando
- ✅ Base de datos local (client_db) para NSS/PAM
- ⚠️ Replicación de usuarios fallará (BD central no disponible)
- ⚠️ Envío de métricas fallará (API no disponible)

**Comportamiento:**
- Los usuarios YA sincronizados pueden hacer SSH
- No se sincronizarán usuarios nuevos hasta que el servidor esté online
- Ideal para clientes en producción (alta disponibilidad)

**Casos de uso:**
- Cliente en servidor remoto independiente
- Alta disponibilidad sin dependencia del servidor central

---

## Ejecutar Servidor Central (Master)

```bash
# Servidor completo (BD + API + Worker)
docker-compose up db api worker

# En background
docker-compose up -d db api worker
```

**Servicios:**
- ✅ `db` - PostgreSQL central con todos los datos
- ✅ `api` - Servidor FastAPI (puerto 8000)
- ✅ `worker` - Celery worker para Ansible

**Comportamiento:**
- Gestión de usuarios, servidores, playbooks
- API REST disponible
- Los clientes pueden replicar usuarios desde aquí
- Recibe métricas de los clientes

---

## Ejecutar Sistema Completo

```bash
# Todo (Servidor + Cliente)
docker-compose up

# En background
docker-compose up -d
```

**Servicios:**
- ✅ `db` - PostgreSQL central
- ✅ `api` - Servidor FastAPI
- ✅ `worker` - Celery worker
- ✅ `client_db` - PostgreSQL local del cliente
- ✅ `client` - Cliente con métricas y NSS/PAM

**Casos de uso:**
- Desarrollo local completo
- Testing de toda la integración

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
