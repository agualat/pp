# 🚀 Actualización de Clientes Existentes - Permisos Docker

## ⚡ Acción Requerida para Servidores Existentes

Los usuarios creados desde la API necesitan permisos para usar Docker. 
**Ejecuta esto UNA VEZ en cada servidor cliente:**

---

## 📦 Opción 1: Comando Rápido (Copy-Paste)

```bash
# SSH al servidor como root
ssh root@servidor-cliente

# Ejecutar este comando:
for user in $(awk -F: '$3 >= 2000 && $3 < 65534 && $6 ~ /^\/home\// {print $1}' /etc/passwd); do usermod -aG docker "$user" && echo "✅ $user"; done

# Listo!
```

---

## 🛠️ Opción 2: Script de Instalación Completo

```bash
# SSH al servidor como root
ssh root@servidor-cliente

# Descargar y ejecutar el script de setup
cd /tmp
wget https://raw.githubusercontent.com/[tu-repo]/pp/main/setup_docker_permissions.sh
sudo bash setup_docker_permissions.sh
```

Esto instalará el comando `add-docker-users` que puedes ejecutar cada vez que agregues usuarios:
```bash
sudo add-docker-users
```

---

## ✅ Verificación

Para verificar que un usuario tiene permisos:

```bash
# Como root
groups nombre_usuario
# Debe mostrar: nombre_usuario docker

# Como el usuario (debe cerrar sesión y volver a entrar primero)
docker ps
# Debe funcionar sin errores
```

---

## 🔄 Para Nuevos Usuarios (futuro)

**Opción A - Manual:** Ejecutar después de crear usuarios
```bash
sudo add-docker-users
```

**Opción B - Automático:** Configurar cron (ejecuta cada hora)
```bash
sudo crontab -e
# Agregar esta línea:
0 * * * * /usr/local/bin/add-docker-users >/dev/null 2>&1
```

---

## ⚠️ IMPORTANTE

**Los usuarios DEBEN cerrar sesión SSH y volver a entrar** para que los cambios de grupo surtan efecto.

```bash
# Como usuario
exit

# Volver a conectar
ssh usuario@servidor

# Ahora docker funcionará
docker ps
```

---

## 🐛 Problemas Comunes

### "docker: command not found"
Docker no está instalado:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### "permission denied" al ejecutar docker
1. Verificar grupos: `groups`
2. Si no aparece "docker", añadir: `sudo usermod -aG docker $USER`
3. **Cerrar sesión y volver a entrar**

### Script no encuentra usuarios
Los usuarios se crean con UID >= 2000. Verificar:
```bash
awk -F: '$3 >= 2000 && $3 < 65534 {print $1, $3}' /etc/passwd
```

---

## 📋 Lista de Verificación

- [ ] Conectado al servidor como root
- [ ] Docker está instalado (`docker --version`)
- [ ] Ejecutado el comando/script de permisos
- [ ] Verificado que los usuarios aparecen en el grupo docker
- [ ] Los usuarios cerraron sesión y volvieron a entrar
- [ ] Probado `docker ps` como usuario
- [ ] (Opcional) Configurado cron para automatizar

---

## 📞 Soporte

Si tienes problemas, verifica:
1. Docker está instalado y corriendo: `docker ps`
2. El grupo docker existe: `getent group docker`
3. Los usuarios existen en el sistema: `cat /etc/passwd | grep 2000`
4. Los usuarios cerraron sesión SSH completamente

Ver documentación completa: [INSTRUCCIONES_PERMISOS_DOCKER.md](./INSTRUCCIONES_PERMISOS_DOCKER.md)