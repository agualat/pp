# 🐳 Nueva Funcionalidad: Crear Contenedores desde Admin

**Estado:** ✅ Implementado y Desplegado

---

## 🎯 Descripción

Los administradores ahora pueden crear contenedores Docker para cualquier usuario desde el panel de administración, con una configuración por defecto optimizada para Colab Runtime y opciones avanzadas completamente personalizables.

---

## ✨ Características Principales

### 🔧 Modo Admin
- **Selector de Usuario**: Obligatorio en modo admin, muestra todos los usuarios activos
- **Información Completa**: Muestra username, email y badge de admin (👑)
- **Configuración Automática**: Se adapta al usuario seleccionado

### 📦 Configuración por Defecto (Colab Runtime)
- **Imagen**: `us-docker.pkg.dev/colab-images/public/runtime:latest`
- **Nombre**: `colab_<username>`
- **Volúmenes**: 
  - `/media:/media:ro` (read-only)
  - `/mnt:/mnt:ro` (read-only)
  - `/home/<username>:/home/<username>` (read-write)
- **GPUs**: `all` (acceso completo)
- **Memoria Compartida**: `32g`
- **Modo Privilegiado**: Activado

### ⚙️ Configuración Avanzada (Opcional, Desplegable)
- **Imagen Docker** personalizada
- **Tamaño de Memoria Compartida** (--shm-size): 16g, 32g, 64g, etc.
- **Configuración de GPUs** (--gpus): all, device=0,1, etc.
- **Modo Privilegiado** (--privileged): checkbox
- **Volúmenes Personalizados** (-v): múltiples volúmenes separados por comas
- **Puertos Específicos**: mapeo manual (ej: 8888:8888)
- **Comando Personalizado**: comando a ejecutar al iniciar

---

## 🔐 Seguridad

### Validaciones Backend
- ✅ **Solo admins** pueden crear contenedores para otros usuarios
- ✅ **Verificación de existencia** del usuario objetivo
- ✅ **Respeta límites**: 1 contenedor por servidor por usuario
- ✅ **Validación de SSH**: El servidor debe tener SSH configurado
- ✅ **Validación de permisos**: Permisos verificados en cada request

### Validaciones Frontend
- ✅ Usuario obligatorio en modo admin
- ✅ Servidor obligatorio
- ✅ Botón deshabilitado si falta información
- ✅ Campos validados según el tipo

---

## 🚀 Cómo Usar

### Paso 1: Acceder al Panel
```
Dashboard → 🐳 Gestión de Contenedores
```

### Paso 2: Crear Nuevo Contenedor
```
Click en "➕ Nuevo Contenedor"
```

### Paso 3: Seleccionar Usuario y Servidor
```
1. Usuario: Seleccionar de la lista (obligatorio)
2. Servidor: Seleccionar servidor con SSH configurado
```

### Paso 4: (Opcional) Configuración Avanzada
```
Click en "⚙️ Configuración Avanzada" para personalizar:
- Imagen Docker
- Memoria compartida
- GPUs
- Volúmenes
- Puertos
- Comando de inicio
```

### Paso 5: Crear
```
Click en "🚀 Crear Contenedor"
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Contenedor Básico (Configuración por Defecto)

**Escenario**: Admin crea contenedor para usuario "maria"

**Pasos**:
1. Usuario: maria (maria@example.com)
2. Servidor: gpu-server-01
3. Click en "Crear Contenedor"

**Resultado**:
```yaml
Nombre: colab_maria
Imagen: us-docker.pkg.dev/colab-images/public/runtime:latest
Volúmenes:
  - /media:/media:ro
  - /mnt:/mnt:ro
  - /home/maria:/home/maria
GPUs: all
SHM Size: 32g
Privileged: true
```

---

### Ejemplo 2: Contenedor con Configuración Personalizada

**Escenario**: Admin crea contenedor Jupyter para usuario "carlos"

**Pasos**:
1. Usuario: carlos (carlos@example.com)
2. Servidor: ml-server-02
3. Click en "⚙️ Configuración Avanzada"
4. Configurar:
   - Puertos: `8888:8888`
   - Comando: `bash -c 'jupyter notebook --ip=0.0.0.0 --no-browser'`
5. Click en "Crear Contenedor"

**Resultado**:
```yaml
Nombre: colab_carlos
Imagen: us-docker.pkg.dev/colab-images/public/runtime:latest
Puertos: 8888:8888
Volúmenes:
  - /media:/media:ro
  - /mnt:/mnt:ro
  - /home/carlos:/home/carlos
GPUs: all
SHM Size: 32g
Privileged: true
Comando: bash -c 'jupyter notebook --ip=0.0.0.0 --no-browser'
```

---

### Ejemplo 3: Contenedor con Imagen Personalizada

**Escenario**: Admin crea contenedor TensorFlow para usuario "ana"

**Pasos**:
1. Usuario: ana (ana@example.com)
2. Servidor: gpu-server-03
3. Click en "⚙️ Configuración Avanzada"
4. Cambiar imagen: `tensorflow/tensorflow:latest-gpu`
5. Agregar volúmenes adicionales: `/data:/data:ro`
6. Click en "Crear Contenedor"

**Resultado**:
```yaml
Nombre: colab_ana
Imagen: tensorflow/tensorflow:latest-gpu
Volúmenes:
  - /media:/media:ro
  - /mnt:/mnt:ro
  - /home/ana:/home/ana
  - /data:/data:ro
GPUs: all
SHM Size: 32g
Privileged: true
```

---

## 🔧 Archivos Modificados

### Frontend

**`frontend/app/components/CreateContainerModal.tsx`**
```typescript
// Agregado:
- interface User con is_active
- interface Server con status
- prop adminMode (boolean)
- prop preselectedUserId (number)
- useState para users y selectedUserId
- fetchUsers() función
- Selector de usuario en el form
- Lógica para actualizar nombre con usuario seleccionado
- Actualización de getDefaultVolumes() para modo admin
- Actualización de buildDockerCommand() para modo admin
- Agregado user_id al payload cuando adminMode=true
```

**`frontend/app/dashboard/containers/page.tsx`**
```typescript
// Agregado:
- adminMode={true} al CreateContainerModal
```

### Backend

**`server/models/models.py`**
```python
class ContainerCreate(BaseModel):
    name: str
    server_id: int
    image: str
    ports: str | None = None
    user_id: int | None = None  # NUEVO: Para admin
```

**`server/router/containers.py`**
```python
async def create_new_container():
    # NUEVO: Lógica para manejar user_id
    target_user_id = user.id  # Default
    
    if container_data.user_id is not None:
        # Verificar que es admin
        if not user.is_admin:
            raise HTTPException(403, "Only admins...")
        
        # Verificar que usuario existe
        target_user = get_user_by_id(db, container_data.user_id)
        if not target_user:
            raise HTTPException(404, "User not found")
        
        target_user_id = container_data.user_id
    
    # Usar target_user_id para crear contenedor
```

---

## 📝 API Request Examples

### Crear Contenedor (Configuración por Defecto)

```bash
POST /api/containers
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "colab_juan",
  "server_id": 1,
  "image": "us-docker.pkg.dev/colab-images/public/runtime:latest",
  "ports": null,
  "user_id": 5
}
```

### Crear Contenedor (Configuración Avanzada)

```bash
POST /api/containers
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "colab_maria",
  "server_id": 2,
  "image": "tensorflow/tensorflow:latest-gpu",
  "ports": "8888:8888,6006:6006",
  "user_id": 7,
  "advanced_config": {
    "shm_size": "64g",
    "gpus": "device=0,1",
    "privileged": true,
    "volumes": "/media:/media:ro,/data:/data,/home/maria:/home/maria",
    "custom_command": "bash -c 'jupyter notebook --ip=0.0.0.0'"
  }
}
```

---

## 🧪 Testing

### Test Manual

1. **Login como admin**
   ```
   http://localhost:3000/login
   User: admin
   Pass: admin123
   ```

2. **Navegar a Contenedores**
   ```
   Dashboard → Contenedores
   ```

3. **Crear contenedor**
   ```
   Click "Nuevo Contenedor"
   Seleccionar usuario
   Seleccionar servidor
   Click "Crear Contenedor"
   ```

4. **Verificar**
   ```
   - Contenedor aparece en la lista
   - Estado: creating → running
   - Usuario correcto asignado
   ```

### Test de Permisos

```bash
# Como usuario normal, intentar crear para otro usuario
POST /api/containers
Authorization: Bearer <user_token>
{
  "name": "colab_otro",
  "server_id": 1,
  "user_id": 99
}

# Respuesta esperada: 403 Forbidden
```

---

## 🐛 Troubleshooting

### El selector de usuarios está vacío
**Causa**: No hay usuarios activos o error al fetch  
**Solución**: 
- Verificar que hay usuarios con `is_active = 1`
- Check console logs del browser
- Verificar `/api/users` endpoint

### No se puede crear el contenedor
**Causa posible 1**: No hay servidores con SSH  
**Solución**: Configurar SSH en al menos un servidor

**Causa posible 2**: Usuario ya tiene contenedor en ese servidor  
**Solución**: Elegir otro servidor o eliminar el existente

**Causa posible 3**: No eres admin  
**Solución**: Solo admins pueden usar esta funcionalidad

### El contenedor se crea pero queda en "creating"
**Causa**: Problema con Docker en el servidor  
**Solución**:
- SSH al servidor y verificar: `docker ps -a`
- Revisar logs: `docker logs <container_id>`
- Verificar que la imagen existe

---

## 📚 Referencias

- **Documentación Docker**: https://docs.docker.com/
- **Google Colab Runtime**: https://cloud.google.com/artifact-registry
- **FastAPI Docs**: https://fastapi.tiangolo.com/

---

## ✅ Checklist de Deployment

- [x] Código implementado
- [x] Backend actualizado
- [x] Frontend actualizado
- [x] Modelos actualizados
- [x] Validaciones de seguridad
- [x] Testing manual realizado
- [x] Servicios reiniciados
- [x] Documentación creada

---

**🎉 ¡Funcionalidad lista para usar!**

Para más información, consulta:
- `documentation/GUIA_RAPIDA.md` - Guía de uso general
- `documentation/ESTRUCTURA_PROYECTO.md` - Arquitectura del proyecto
