# 🚀 Guía Rápida - Infrastructure Management Platform

**Para empezar rápidamente, sigue esta guía. Para detalles completos, consulta la documentación específica.**

---

## 📚 Índice de Documentación

| Documento | Para qué sirve |
|-----------|----------------|
| [README.md](README.md) | 📖 **Empieza aquí** - Overview del proyecto |
| **👇 Este documento** | 🚀 Guía rápida para empezar |
| [ESTRUCTURA_PROYECTO.md](ESTRUCTURA_PROYECTO.md) | 📁 Entender la estructura del repo |
| [scripts/README.md](scripts/README.md) | 🔧 Guía de todos los scripts |
| [PERMISOS_DOCKER.md](PERMISOS_DOCKER.md) | 🔐 Configurar permisos Docker |
| [RESUMEN_LIMPIEZA.md](RESUMEN_LIMPIEZA.md) | 🧹 Cambios recientes de organización |

---

## ⚡ Setup Rápido

### 1️⃣ Servidor Central (Primera vez)

```bash
# Clonar repo
git clone <repo-url> /home/staffteam/pp
cd /home/staffteam/pp

# Configurar
cp .env.example .env
nano .env  # Editar configuración

# Levantar servicios
docker compose up -d

# Verificar
docker compose ps
```

### 2️⃣ Cliente/Host (Primera vez)

```bash
# Configurar SSH con NSS/PAM
sudo bash scripts/setup/setup_nss_auto.sh

# Verificar
sudo bash scripts/maintenance/check_user_permissions.sh
```

---

## 🔄 Comandos Comunes

### Gestión de Servicios

```bash
# Ver logs
docker compose logs -f api
docker compose logs -f client

# Reiniciar servicios
docker compose restart api
docker compose restart client

# Estado
docker compose ps
```

### Gestión de Usuarios

```bash
# Sincronizar usuarios (si es necesario)
sudo bash client/utils/sync_docker_group.sh

# Verificar permisos de usuario
id username
groups username
sudo -l -U username  # Debe decir "not allowed"

# Ver usuarios en BD
docker compose exec -T client_db psql -U postgres -d postgres \
  -c "SELECT username, system_uid, system_gid, is_active FROM users;"
```

### Auditoría y Debugging

```bash
# Verificar permisos de todos los usuarios
sudo bash scripts/maintenance/check_user_permissions.sh

# Test conexión a BD
bash scripts/testing/test_client_db.sh

# Ver estado NSS
getent passwd username
```

---

## 📁 Ubicación de Scripts

### Por Categoría

```bash
scripts/
├── setup/                     # 🆕 Setup inicial (una vez)
│   └── setup_nss_auto.sh
├── maintenance/               # 🔧 Mantenimiento regular
│   └── check_user_permissions.sh
└── testing/                   # 🧪 Testing y debugging
    ├── test_client_db.sh
    ├── test_container_sync.sh
    └── test_sync.sh
```

### Scripts del Cliente (Uso Automático)

```bash
client/utils/
├── sync_docker_group.sh           # Sincroniza usuarios con Docker
├── generate_passwd_from_db.sh     # Genera /etc/passwd desde BD
├── generate_shadow_from_db.sh     # Genera /etc/shadow desde BD
└── sync_password_change.sh        # Hook PAM para cambio de password
```

---

## 🎯 Casos de Uso Comunes

### Agregar un nuevo usuario

**Vía Web:**
1. Ir a http://localhost:3000/users
2. Click "Agregar Usuario"
3. Llenar formulario
4. ✅ Automáticamente se sincroniza a todos los clientes

**Verificar:**
```bash
# En el cliente
getent passwd nuevo_usuario
ssh nuevo_usuario@localhost  # Password inicial: nuevo_usuario2025
```

### Usuario no puede hacer SSH

```bash
# 1. Verificar que existe en BD
docker compose exec -T client_db psql -U postgres -d postgres \
  -c "SELECT * FROM users WHERE username = 'usuario';"

# 2. Verificar NSS
getent passwd usuario

# 3. Re-generar archivos NSS
sudo bash /usr/local/bin/generate_passwd_from_db.sh
sudo bash /usr/local/bin/generate_shadow_from_db.sh

# 4. Si sigue sin funcionar, re-ejecutar setup
sudo bash scripts/setup/setup_nss_auto.sh
```

### Usuario tiene sudo (no debería)

```bash
# 1. Verificar
sudo -l -U usuario

# 2. Remover
sudo deluser usuario sudo
sudo deluser usuario admin

# 3. Sincronizar
sudo bash client/utils/sync_docker_group.sh

# 4. Verificar
sudo bash scripts/maintenance/check_user_permissions.sh
```

### Ver métricas del sistema

1. Abrir http://localhost:3000
2. Ir a la sección de servidores
3. Ver métricas en tiempo real (actualización cada 5 segundos)

---

## 🔐 Seguridad

### Principios

- ✅ Usuarios tienen acceso a Docker (para contenedores)
- ❌ Usuarios NO tienen sudo (no pueden ejecutar comandos como root)
- ✅ Autenticación centralizada vía PostgreSQL
- ✅ Passwords hasheados (bcrypt)

### Verificación de Seguridad

```bash
# Un usuario seguro debe tener:
id usuario                 # → gid=984(docker) o similar
groups usuario             # → usuario : docker
sudo -l -U usuario         # → "not allowed to run sudo"
su - usuario -c "docker ps"  # → Funciona ✅
```

### Auditoría Regular

```bash
# Ejecutar mensualmente
sudo bash scripts/maintenance/check_user_permissions.sh

# Revisar logs de Docker
sudo journalctl -u docker -n 100

# Ver actividad de usuarios
who
last -n 20
```

---

## 🆘 Troubleshooting Rápido

### Servicios no levantan

```bash
docker compose down
docker compose up -d
docker compose logs -f
```

### BD no conecta

```bash
# Verificar que está corriendo
docker compose ps db
docker compose ps client_db

# Ver logs
docker compose logs db
docker compose logs client_db

# Test conexión
psql -h localhost -p 5432 -U postgres -d postgres
psql -h localhost -p 5433 -U postgres -d postgres  # client_db
```

### Frontend no carga

```bash
# Verificar servicios
docker compose ps frontend

# Logs
docker compose logs frontend

# Reiniciar
docker compose restart frontend
```

---

## 📖 Documentación Completa

- [README.md](README.md) - Documentación principal
- [ESTRUCTURA_PROYECTO.md](ESTRUCTURA_PROYECTO.md) - Estructura detallada
- [scripts/README.md](scripts/README.md) - Guía de scripts
- [PERMISOS_DOCKER.md](PERMISOS_DOCKER.md) - Permisos Docker
- [client/README.md](client/README.md) - Cliente
- [server/README.md](server/README.md) - Servidor
- [frontend/README.md](frontend/README.md) - Frontend

---

## 💡 Tips

1. **Usa aliases** para comandos comunes:
   ```bash
   alias dc='docker compose'
   alias check-perms='sudo bash scripts/maintenance/check_user_permissions.sh'
   ```

2. **Revisa logs regularmente:**
   ```bash
   docker compose logs -f --tail=50 api
   ```

3. **Mantén backups de la BD:**
   ```bash
   docker compose exec db pg_dump -U postgres postgres > backup.sql
   ```

4. **Documenta cambios:**
   - Actualiza CHANGELOG.md
   - Actualiza READMEs relevantes

---

**¿Necesitas más ayuda?**
- Consulta la documentación específica en cada directorio
- Revisa los READMEs de cada componente
- Ejecuta scripts de testing para diagnóstico

**✨ ¡Listo para empezar!**
