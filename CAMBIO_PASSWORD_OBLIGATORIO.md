# Cambio de Contraseña Obligatorio en Primer Login

## 📋 Descripción

Sistema implementado para forzar el cambio de contraseña en el primer login de usuarios creados masivamente con contraseñas por defecto.

## 🔐 Funcionalidad

### Contraseñas por Defecto

Cuando se crean usuarios masivamente (CSV/TXT), se genera automáticamente:
- **Email**: `{username}@estud.usfq.edu.ec`
- **Contraseña**: `{username}{año_actual}` (ej: `juan2025`)
- **Flag**: `must_change_password = 1`

### Flujo de Cambio de Contraseña

1. **Login inicial**:
   - Usuario ingresa con su contraseña por defecto
   - API retorna `must_change_password: 1` en el token response
   - Frontend detecta el flag y muestra modal de cambio de contraseña

2. **Cambio obligatorio**:
   - Usuario NO puede acceder al dashboard hasta cambiar contraseña
   - Modal de cambio de contraseña se muestra automáticamente
   - Usuario debe proporcionar contraseña actual y nueva contraseña

3. **Post-cambio**:
   - Flag `must_change_password` se marca como `0`
   - Usuario puede acceder normalmente al sistema
   - Contraseña sincronizada automáticamente a todos los clientes

## 🔧 Implementación

### Base de Datos

**Campo agregado a la tabla `users`:**
```sql
must_change_password INTEGER DEFAULT 0
```

### Backend (FastAPI)

#### Modelo (server/models/models.py)
```python
class User(Base):
    # ... otros campos ...
    must_change_password: Mapped[int] = mapped_column(Integer, default=0)

class TokenResponse(BaseModel):
    access_token: str
    must_change_password: int = 0
```

#### Login (server/router/auth.py)
```python
@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    # ... validación ...
    must_change = getattr(user, "must_change_password", 0)
    return TokenResponse(access_token=token, must_change_password=must_change)
```

#### Endpoint de Cambio de Contraseña
```bash
POST /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "juan2025",
  "new_password": "miNuevaPassword123"
}
```

**Validaciones:**
- Contraseña actual debe ser correcta
- Nueva contraseña debe tener mínimo 6 caracteres
- Nueva contraseña debe ser diferente de la actual
- Al cambiar, se marca `must_change_password = 0`
- Se sincroniza automáticamente con todos los clientes

#### Creación Masiva (server/router/users.py)
```python
# Al crear usuarios masivamente
new_user = create_user(db, user_data, auto_sync=False)
new_user.must_change_password = 1  # ← Flag activado
db.commit()
```

### Frontend (Next.js)

**1. Detectar en Login (app/login/page.tsx)**
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username, password })
});

const data = await response.json();

if (data.must_change_password === 1) {
  // Mostrar modal de cambio de contraseña
  setShowChangePasswordModal(true);
} else {
  // Redirigir al dashboard
  router.push('/dashboard');
}
```

**2. Modal de Cambio de Contraseña**
```typescript
const handleChangePassword = async () => {
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  });

  if (response.ok) {
    // Contraseña cambiada exitosamente
    router.push('/dashboard');
  }
};
```

## 📊 Sincronización con Clientes

El campo `must_change_password` se sincroniza automáticamente con todos los clientes:

1. **Al crear usuarios**: Campo se marca como `1`
2. **Al cambiar contraseña**: Campo se actualiza a `0`
3. **Trigger automático**: Todos los clientes reciben la actualización
4. **Base de datos local**: Campo se refleja en PostgreSQL del cliente

**Nota**: Este campo NO afecta la autenticación SSH, solo el acceso al dashboard web.

## ⚙️ Configuración

### Variables de Entorno

No se requieren variables adicionales. La funcionalidad está integrada en el flujo normal.

### Reglas de Negocio

```python
# Contraseña por defecto
default_password = f"{username}{current_year}"
# Ejemplo: juan2025, maria2025, pedro2025

# Validación nueva contraseña
min_length = 6
must_be_different = True
```

## 🧪 Testing

### Test de Creación Masiva
```bash
# 1. Crear usuarios masivamente
curl -X POST http://localhost:8000/users/bulk-upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@usuarios.csv"

# 2. Verificar flag en BD
docker compose exec db psql -U postgres -d postgres \
  -c "SELECT username, must_change_password FROM users;"
```

### Test de Login
```bash
# Login con usuario nuevo
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "juan", "password": "juan2025"}'

# Respuesta esperada:
{
  "access_token": "...",
  "must_change_password": 1  ← Flag activo
}
```

### Test de Cambio de Contraseña
```bash
curl -X POST http://localhost:8000/auth/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "juan2025",
    "new_password": "miNuevaPassword123"
  }'

# Respuesta esperada:
{
  "success": true,
  "message": "Password changed successfully"
}
```

## 🔍 Verificación

### Verificar Flag en BD Principal
```bash
docker compose exec db psql -U postgres -d postgres \
  -c "SELECT username, must_change_password FROM users ORDER BY username;"
```

### Verificar Sincronización en Cliente
```bash
docker compose exec client_db psql -U postgres -d postgres \
  -c "SELECT username, must_change_password FROM users ORDER BY username;"
```

### Verificar Logs
```bash
# Ver cambios de contraseña
docker compose logs api | grep "change-password"

# Ver sincronización
docker compose logs client | grep "sync"
```

## ⚠️ Consideraciones

1. **Seguridad**:
   - La contraseña por defecto es predecible (username+año)
   - El cambio de contraseña en primer login es OBLIGATORIO
   - Comunicar a los usuarios sus credenciales iniciales de forma segura

2. **Usuarios Existentes**:
   - Solo afecta a usuarios creados masivamente
   - Usuarios creados individualmente: `must_change_password = 0`
   - Usuarios admin creados directamente: no afectados

3. **Sincronización**:
   - El cambio de contraseña se sincroniza automáticamente
   - Puede tomar hasta 2-3 segundos en llegar a los clientes
   - Los clientes regeneran archivos NSS/PAM automáticamente

## 📝 Ejemplo Completo

```bash
# 1. Crear archivo CSV
echo "username" > usuarios.csv
echo "juan" >> usuarios.csv
echo "maria" >> usuarios.csv

# 2. Subir usuarios
curl -X POST http://localhost:8000/users/bulk-upload \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@usuarios.csv"

# Respuesta:
{
  "created": 2,
  "users_created": [
    {"username": "juan", "email": "juan@estud.usfq.edu.ec"},
    {"username": "maria", "email": "maria@estud.usfq.edu.ec"}
  ]
}

# 3. Usuario juan intenta login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "juan", "password": "juan2025"}'

# Respuesta:
{
  "access_token": "eyJ...",
  "must_change_password": 1  ← Debe cambiar contraseña
}

# 4. Juan cambia su contraseña
curl -X POST http://localhost:8000/auth/change-password \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "juan2025",
    "new_password": "miPassword123!"
  }'

# Respuesta:
{
  "success": true,
  "message": "Password changed successfully"
}

# 5. Próximo login ya NO requiere cambio
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "juan", "password": "miPassword123!"}'

# Respuesta:
{
  "access_token": "eyJ...",
  "must_change_password": 0  ← Ya cambió contraseña
}
```

## 🎯 Beneficios

✅ **Seguridad mejorada**: Contraseñas por defecto cambiadas obligatoriamente
✅ **Automatizado**: Sin intervención manual del administrador
✅ **Sincronizado**: Cambios reflejados en todos los servidores
✅ **Auditable**: Todos los cambios quedan registrados en logs
✅ **UX optimizada**: Modal intuitivo en el frontend

## 🔗 Archivos Modificados

- `server/models/models.py` - Modelo User y TokenResponse
- `server/router/auth.py` - Login y endpoint de cambio de contraseña
- `server/router/users.py` - Creación masiva con flag
- `client/init_db.sql` - Schema con nuevo campo
- `client/router/sync.py` - Sincronización con campo adicional
