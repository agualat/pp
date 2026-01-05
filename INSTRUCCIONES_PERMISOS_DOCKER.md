# 🐳 Dar Permisos de Docker a Usuarios

## 📋 Resumen
Los usuarios creados desde la API necesitan estar en el grupo `docker` para poder usar Docker.

---

## ✅ Solución Rápida (Recomendada)

### Para servidores/clientes EXISTENTES:

**Opción 1: Comando de una línea (más rápido)**

```bash
# Conectarse al servidor
ssh root@tu-servidor

# Copiar y pegar este comando completo:
for user in $(awk -F: '$3 >= 2000 && $3 < 65534 && $6 ~ /^\/home\// {print $1}' /etc/passwd); do usermod -aG docker "$user" && echo "✅ $user"; done
```

**Opción 2: Usando el script de instalación**

```bash
# Conectarse al servidor
ssh root@tu-servidor

# Descargar y ejecutar
curl -O https://raw.githubusercontent.com/.../setup_docker_permissions.sh
sudo bash setup_docker_permissions.sh
```

El script instalará un comando permanente: `add-docker-users`

---

## 🔄 Para Nuevos Usuarios (después de sincronizar)

Cada vez que agregues nuevos usuarios, ejecuta:

```bash
sudo add-docker-users
```

O configura cron para que se ejecute automáticamente:

```bash
sudo crontab -e

# Agregar esta línea (ejecuta cada hora):
0 * * * * /usr/local/bin/add-docker-users >/dev/null 2>&1
```

---

## ✅ Verificar que Funciona

```bash
# 1. Ver grupos de un usuario
groups nombre_usuario
# Debe mostrar: nombre_usuario docker

# 2. El usuario debe cerrar sesión y volver a entrar
exit
ssh nombre_usuario@servidor

# 3. Probar Docker
docker ps
# Debe funcionar sin errores
```

---

## 🛠️ Método Manual (alternativa)

Si prefieres hacerlo manualmente para un usuario específico:

```bash
# Añadir usuario al grupo docker
sudo usermod -aG docker nombre_usuario

# El usuario debe cerrar sesión y volver a entrar
```

---

## 📝 Notas Importantes

1. **Los usuarios DEBEN cerrar sesión y volver a entrar** para que los cambios surtan efecto
2. Solo afecta usuarios con UID >= 2000 (usuarios de la app)
3. Es seguro ejecutar los comandos múltiples veces
4. No afecta a usuarios que ya tienen permisos

---

## 🐛 Solución de Problemas

### "docker: command not found"
Docker no está instalado:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### "permission denied while trying to connect to the Docker daemon socket"
El usuario no está en el grupo docker o no ha cerrado sesión:
```bash
# Verificar grupos
groups

# Si no aparece "docker", añadirlo:
sudo usermod -aG docker $USER

# IMPORTANTE: Cerrar sesión SSH y volver a entrar
exit
```

### "El grupo docker no existe"
```bash
sudo groupadd docker
```

---

## 📚 Resumen de Archivos Creados

- **`setup_docker_permissions.sh`**: Script de instalación (ejecutar una vez)
- **`/usr/local/bin/add-docker-users`**: Comando permanente para añadir usuarios
- **`client/utils/add_users_to_docker.sh`**: Script incluido en el contenedor cliente

---

## 🎯 Flujo Completo

1. **Instalación inicial** (una vez por servidor):
   ```bash
   sudo bash setup_docker_permissions.sh
   ```

2. **Cada vez que agregues usuarios** (manual):
   ```bash
   sudo add-docker-users
   ```

3. **O automatizar con cron** (opcional):
   ```bash
   sudo crontab -e
   # Agregar: 0 * * * * /usr/local/bin/add-docker-users >/dev/null 2>&1
   ```

4. **Los usuarios deben cerrar sesión** y volver a entrar

---

## ❓ FAQ

**P: ¿Por qué no se hace automáticamente?**  
R: Por seguridad, dar permisos de Docker requiere acceso root y modificar el sistema host.

**P: ¿Es seguro dar permisos de Docker a todos los usuarios?**  
R: Los usuarios en el grupo docker tienen acceso privilegiado. Solo dar a usuarios de confianza.

**P: ¿Qué pasa si ejecuto el script múltiples veces?**  
R: No hay problema, solo actualizará usuarios nuevos y saltará los que ya tienen permisos.

**P: ¿Funciona en todos los servidores Linux?**  
R: Sí, funciona en Ubuntu, Debian, CentOS, RHEL, etc.