# 🔐 Permisos Docker (sin Sudo)

## ✅ Resumen

**Los usuarios tienen acceso a Docker pero NO a sudo.**

- ✅ Grupo `docker` → Pueden ejecutar comandos Docker
- ❌ Grupo `sudo` → NO pueden ejecutar comandos como root
- 🔒 Docker y sudo son permisos diferentes

## 🚀 Ejecutar en Clientes (Hosts)

### 1. Verificar estado actual

```bash
sudo ./check_user_permissions.sh
```

### 2. Si hay usuarios con sudo que no deberían tenerlo

```bash
sudo ./remove_sudo_from_db_users.sh
```

### 3. Si hay usuarios sin docker

```bash
sudo bash client/utils/sync_docker_group.sh
```

## 📋 Lo que pueden hacer los usuarios

### ✅ CON grupo docker (permitido)
- `docker ps` - Ver contenedores
- `docker run` - Crear contenedores
- `docker logs` - Ver logs
- `docker exec` - Entrar a contenedores

### ❌ SIN grupo sudo (bloqueado)
- `apt-get install` - Instalar software
- `systemctl restart` - Reiniciar servicios
- `useradd` - Crear usuarios
- Modificar archivos del sistema

## 🔍 Verificación rápida

```bash
# Ver grupos de un usuario (debe tener docker, NO sudo)
groups <username>

# Verificar permisos sudo (debe decir "not allowed")
sudo -l -U <username>

# Ver quién tiene sudo (solo admins)
getent group sudo

# Ver quién tiene docker (usuarios de la app)
getent group docker
```

## 📝 Notas

- El script `sync_docker_group.sh` automáticamente:
  - ✅ Agrega usuarios al grupo docker
  - 🔒 Remueve usuarios de grupos sudo/admin
  - 📊 Verifica configuración

- Usuarios deben hacer logout/login para aplicar cambios de grupos

## ✅ Estado esperado

```bash
groups usuario
# Output: usuario docker

sudo -l -U usuario  
# Output: User usuario is not allowed to run sudo on hostname
```

Eso es todo. Simple y seguro. 🎯