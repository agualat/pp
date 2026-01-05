# 🔐 Permisos Docker (sin Sudo)

## 🎯 Resumen

**Los usuarios tienen Docker como grupo primario (GID auto-detectado) y NO tienen sudo.**

- ✅ GID de Docker detectado automáticamente en cada cliente
- ✅ Usuarios tienen acceso directo a Docker (grupo primario)
- ❌ Usuarios NO tienen acceso sudo ni admin

---

## 🚀 Configuración Inicial (Una sola vez)

### 1. En el Servidor (Backend)

```bash
# Reiniciar servidor para aplicar cambios en el modelo
docker compose restart server
```

**Cambio:** `system_gid` ahora es NULL (se asigna automáticamente en cada cliente).

### 2. En Cada Cliente (Host)

```bash
# Ejecutar scripts en orden:

# 1. Actualizar usuarios existentes
chmod +x fix_user_gid.sh
sudo bash fix_user_gid.sh

# 2. Sincronizar usuarios y grupos
sudo bash client/utils/sync_docker_group.sh

# 3. Verificar resultado
sudo ./check_user_permissions.sh
```

**Importante:** Usuarios conectados deben reconectar SSH para aplicar cambios.

---

## ✅ Resultado Esperado

```bash
# Ver usuario
getent passwd bacunia
# bacunia:x:2007:984:bacunia:/home/bacunia:/bin/bash
#                ^^^ GID de docker (auto-detectado)

# Verificar grupos
id bacunia
# uid=2007(bacunia) gid=984(docker) groups=984(docker)

# Verificar sin sudo
sudo -l -U bacunia
# User bacunia is not allowed to run sudo on hostname

# Probar Docker (sin sudo)
su - bacunia -c "docker ps"
# CONTAINER ID   IMAGE     ...  ✅ Funciona
```

---

## 📋 Lo Que Pueden Hacer los Usuarios

### ✅ CON Docker (permitido)

```bash
docker ps                    # Ver contenedores
docker run ubuntu            # Crear contenedores
docker images                # Ver imágenes
docker logs <container>      # Ver logs
docker exec -it <cont> bash  # Entrar a contenedor
docker-compose up            # Usar docker-compose
docker build -t app .        # Construir imágenes
```

### ❌ SIN Sudo (bloqueado)

```bash
apt-get install nginx        # ❌ Instalar software
systemctl restart docker     # ❌ Reiniciar servicios
useradd newuser              # ❌ Crear usuarios
nano /etc/hosts              # ❌ Modificar sistema
sudo cualquier_cosa          # ❌ Ejecutar como root
```

---

## 🔄 Cómo Funciona

### Sistema NSS con PostgreSQL

```
1. Usuario creado en BD (system_gid = NULL)
          ↓
2. Cliente ejecuta sync_docker_group.sh
          ↓
3. Detecta GID de docker → Ej: 984
          ↓
4. Actualiza BD: system_gid = 984
          ↓
5. Genera archivos NSS (/etc/passwd-pgsql)
          ↓
6. Usuario tiene docker como grupo primario ✅
```

### Scripts Principales

| Script | Función | Cuándo ejecutar |
|--------|---------|-----------------|
| `fix_user_gid.sh` | Actualiza GID en BD y regenera NSS | Una vez (migración) |
| `sync_docker_group.sh` | Sincroniza usuarios y grupos | Automático/manual |
| `check_user_permissions.sh` | Verifica permisos | Para auditar |

---

## 🔍 Verificación

```bash
# Ver GID de docker en este sistema
getent group docker

# Ver usuarios con docker como grupo primario
getent passwd | grep ":$(getent group docker | cut -d: -f3):"

# Ver quién tiene sudo (solo admins del sistema)
getent group sudo

# Verificar un usuario específico
groups <username>           # Debe mostrar: <username> : docker
id <username>               # gid debe ser de docker
sudo -l -U <username>       # Debe decir "not allowed"
```

---

## 📝 Solo Usuarios de la Base de Datos

**IMPORTANTE:** Los scripts **SOLO procesan usuarios de la base de datos** (`users` con `is_active = 1`).

```
Sistema tiene:
  - root (UID 0)           → ❌ NO se modifica
  - staffteam (UID 1000)   → ❌ NO se modifica
  - bacunia (UID 2000)     → ✅ SÍ (está en BD)
  - juan (UID 2001)        → ✅ SÍ (está en BD)

Base de datos:
  - bacunia, juan

Resultado:
  - Solo bacunia y juan son procesados
  - root y staffteam no son tocados
```

---

## 🆘 Solución de Problemas

### Usuario tiene grupo admin

```bash
# Ejecutar fix_user_gid.sh de nuevo
sudo bash fix_user_gid.sh

# O manualmente
DOCKER_GID=$(getent group docker | cut -d: -f3)
sudo -i
echo "UPDATE users SET system_gid = $DOCKER_GID WHERE username = 'bacunia';" | \
  psql -h localhost -p 5433 -U postgres -d postgres
bash /usr/local/bin/generate_passwd_from_db.sh
exit

# Usuario debe reconectar
sudo pkill -u bacunia
```

### Usuario no puede usar Docker

```bash
# Verificar GID
getent passwd <username>
id <username>

# Si no tiene docker como GID primario
sudo bash client/utils/sync_docker_group.sh

# Usuario debe reconectar
sudo pkill -u <username>
```

### Cambios no se aplican

**El usuario DEBE reconectar SSH:**

```bash
# Método 1: Usuario cierra y vuelve a conectar
exit
# Reconectar por SSH

# Método 2: Forzar desde servidor (cuando no esté trabajando)
sudo pkill -u <username>
```

---

## 🔒 Seguridad

### ¿Es seguro?

Para este sistema de gestión de equipos de desarrollo: **Sí**

- ✅ Los usuarios **necesitan** Docker (es el propósito)
- ✅ No tienen sudo (no pueden hacer `sudo su root`)
- ✅ Solo usuarios de confianza del equipo

### Nota sobre Docker

Usuarios con acceso a Docker técnicamente podrían escalar privilegios:

```bash
# Ejemplo (requiere conocimiento técnico)
docker run -v /:/host -it ubuntu chroot /host
```

**Mitigación:**
1. Solo dar acceso a personas de confianza
2. Monitorear actividad: `docker events`
3. Revisar logs: `journalctl -u docker`
4. Auditar regularmente: `sudo ./check_user_permissions.sh`

---

## 📊 Comparación Antes/Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| Grupo primario | admin (GID 2000) ❌ | docker (GID auto) ✅ |
| GID | Fijo 2000 | Auto-detectado |
| Acceso Docker | Secundario | Primario (directo) |
| Permisos sudo | Podían tener ❌ | Bloqueado ✅ |
| Configuración | Manual | Automática |
| Portabilidad | Solo GID fijo | Cualquier sistema |

---

## ✅ Checklist

Después de configurar:

- [ ] `fix_user_gid.sh` ejecutado
- [ ] `sync_docker_group.sh` ejecutado
- [ ] `check_user_permissions.sh` sin errores
- [ ] `getent passwd <username>` muestra GID de docker
- [ ] `groups <username>` muestra: `<username> : docker`
- [ ] `sudo -l -U <username>` dice "not allowed"
- [ ] `docker ps` funciona para el usuario (sin sudo)
- [ ] Usuarios reconectaron SSH

---

## 📞 Comandos Rápidos

```bash
# Ver estado
getent group docker
getent group sudo
sudo ./check_user_permissions.sh

# Verificar un usuario
id <username>
groups <username>
sudo -l -U <username>
su - <username> -c "docker ps"

# Re-sincronizar todo
sudo bash client/utils/sync_docker_group.sh

# Forzar reconexión de usuario
sudo pkill -u <username>
```

---

## 🎓 Resumen Técnico

**¿Qué cambió?**
- `system_gid` en BD: `2000` (admin) → `NULL` → Auto-detectado en cliente
- Grupo primario: `admin` → `docker` (GID variable por sistema)
- Archivos NSS: Regenerados desde BD con GID correcto

**¿Por qué funciona?**
- Sistema usa NSS con archivos generados desde PostgreSQL
- `fix_user_gid.sh` actualiza BD y regenera archivos
- `sync_docker_group.sh` mantiene sincronización
- Usuarios obtienen cambios al reconectar SSH

**¿Es automático para nuevos usuarios?**
- Sí, `sync_docker_group.sh` detecta GID y actualiza BD automáticamente
- No requiere configuración manual

---

**Simple, automático y seguro.** 🎯 🔒