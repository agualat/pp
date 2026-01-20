# Configuración de Contraseñas de Become (Sudo) para Ansible

## Resumen

Este documento explica cómo el sistema maneja las contraseñas de `become` (sudo) para ejecutar playbooks de Ansible con privilegios elevados en los servidores.

## ¿Cómo Funciona?

El sistema **automáticamente guarda y usa la contraseña SSH** que proporcionas al crear un servidor. Esta contraseña se:

1. ✅ **Almacena encriptada** en la base de datos usando Fernet (symmetric encryption)
2. ✅ **Se usa inicialmente** para desplegar la clave SSH en el servidor
3. ✅ **Se reutiliza automáticamente** como contraseña de `become` cuando Ansible ejecuta playbooks con `become: yes`

**No necesitas hacer nada especial** - simplemente proporciona la contraseña SSH al crear el servidor y el sistema se encarga del resto.

## ¿Por qué es necesario?

Cuando un playbook de Ansible usa `become: yes` para ejecutar tareas con privilegios de superusuario (sudo), necesita la contraseña del usuario. Sin esta configuración, Ansible fallará al intentar ejecutar comandos que requieran sudo.

## Opciones de Configuración

Tienes **dos opciones** para manejar `become`:

### Opción 1: Usar la Contraseña SSH Guardada (Automático) ✨

Esta es la opción por defecto y **no requiere configuración adicional**.

#### Cómo funciona:

1. Al crear un servidor, proporcionas `ssh_password`:
   ```json
   {
     "name": "servidor-01",
     "ip_address": "192.168.1.100",
     "ssh_user": "admin",
     "ssh_password": "mi_contraseña_ssh"
   }
   ```

2. El sistema:
   - Encripta y guarda la contraseña
   - La usa para desplegar la clave SSH
   - **Automáticamente la configura como `ansible_become_password`**

3. Al ejecutar playbooks con `become: yes`, Ansible usa esta contraseña automáticamente

**Ventajas:**
- ✅ Funciona automáticamente, sin configuración
- ✅ No necesitas recordar hacer nada extra
- ✅ La contraseña está encriptada de forma segura
- ✅ Ideal para desarrollo y servidores donde SSH y sudo usan la misma contraseña

**Requisito:**
- ⚠️ El usuario SSH debe tener privilegios sudo con la misma contraseña

### Opción 2: Configurar NOPASSWD en los Servidores (Recomendado para Producción)

Esta es la opción más segura y es la práctica estándar en producción.

#### Pasos:

1. Conéctate al servidor como root o con un usuario con privilegios sudo:
   ```bash
   ssh admin@tu-servidor
   ```

2. Edita el archivo sudoers:
   ```bash
   sudo visudo
   ```

3. Agrega esta línea al final del archivo (reemplaza `admin` con tu usuario SSH real):
   ```
   admin ALL=(ALL) NOPASSWD: ALL
   ```

4. Guarda y cierra el archivo:
   - En nano: `Ctrl+X`, luego `Y`, luego `Enter`
   - En vim: `Esc`, luego `:wq`, luego `Enter`

5. Verifica que funcione:
   ```bash
   sudo -n true && echo "✅ NOPASSWD configurado correctamente" || echo "❌ Error"
   ```

**Ventajas:**
- ✅ **Más seguro** - No almacena ni transmite contraseñas
- ✅ **Recomendado para producción** - Es la práctica estándar
- ✅ **Mejor rendimiento** - No hay overhead de autenticación
- ✅ **Más confiable** - No hay riesgo de contraseñas incorrectas o expiradas

**Cuando configurar NOPASSWD:**
- ✅ Servidores de producción
- ✅ Ambientes automatizados
- ✅ Cuando tienes acceso root al servidor
- ✅ Cuando la seguridad física del servidor está garantizada

## Configuración Inicial del Sistema

### 1. Generar Clave de Encriptación

La primera vez que inicies el servidor **sin** `ENCRYPTION_KEY` configurada, se generará automáticamente una clave y se mostrará en la consola:

```
======================================================================
⚠️  ADVERTENCIA: No se encontró ENCRYPTION_KEY en el entorno
======================================================================

Se ha generado una nueva clave. Agrégala a tu archivo .env:

ENCRYPTION_KEY=gAAAAABl...Tu_Clave_Generada_Aqui...==

======================================================================
```

### 2. Guardar la Clave en .env

Copia la clave generada y agrégala a tu archivo `.env`:

```bash
# En pp/server/.env
ENCRYPTION_KEY=gAAAAABl...Tu_Clave_Generada_Aqui...==
```

⚠️ **CRÍTICO**: 
- Guarda esta clave de forma **MUY segura**
- Sin ella, **no podrás desencriptar** las contraseñas guardadas
- Si la pierdes, tendrás que **reconfigurar todos los servidores**
- **NO la compartas** en repositorios públicos
- Usa un gestor de secretos en producción (AWS Secrets Manager, HashiCorp Vault, etc.)

### 3. Instalar Dependencias

Si estás actualizando un sistema existente:

```bash
pip install cryptography
```

O reconstruye el contenedor Docker:
```bash
docker-compose build server
docker-compose up -d
```

## Migración de Base de Datos

Si ya tienes servidores creados, ejecuta la migración SQL:

### Desde el host:
```bash
cd pp/server
psql -U postgres -d postgres -f migrations/add_become_password.sql
```

### Desde Docker:
```bash
docker exec -i tu_contenedor_postgres psql -U postgres -d postgres < migrations/add_become_password.sql
```

### Verificar migración:
```sql
-- Conectarse a la base de datos
psql -U postgres -d postgres

-- Verificar que la columna existe
\d servers

-- Deberías ver: ssh_password_encrypted | character varying(255) | 
```

## Ejemplos de Uso

### Ejemplo 1: Crear Servidor con Contraseña SSH

```bash
curl -X POST http://localhost:8000/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-server-01",
    "ip_address": "192.168.1.100",
    "ssh_user": "admin",
    "ssh_password": "mi_contraseña_segura"
  }'
```

La contraseña se guarda encriptada y se usa automáticamente para `become`.

### Ejemplo 2: Playbook con Become

```yaml
# playbooks/install_nginx.yml
---
- name: Instalar Nginx
  hosts: all
  become: yes  # <- Usa sudo
  tasks:
    - name: Actualizar apt cache
      apt:
        update_cache: yes
    
    - name: Instalar nginx
      apt:
        name: nginx
        state: present
    
    - name: Iniciar nginx
      systemd:
        name: nginx
        state: started
        enabled: yes
```

Al ejecutar este playbook:
- ✅ Si guardaste la contraseña SSH: Funciona automáticamente
- ✅ Si configuraste NOPASSWD: Funciona automáticamente
- ❌ Si no hay contraseña guardada ni NOPASSWD: Fallará con "Missing sudo password"

### Ejemplo 3: Verificar Estado

```python
# Ver si un servidor tiene contraseña guardada
response = requests.get("http://localhost:8000/api/servers/1")
data = response.json()

if data["has_ssh_password"]:
    print("✅ Servidor tiene contraseña guardada para become")
else:
    print("⚠️ Servidor necesita NOPASSWD configurado")
```

## Verificación y Pruebas

### 1. Probar que NOPASSWD está configurado:

```bash
# En el servidor remoto
ssh admin@tu-servidor "sudo -n true && echo '✅ NOPASSWD funciona' || echo '❌ Se requiere contraseña'"
```

### 2. Probar con un playbook simple:

```yaml
# test_become.yml
---
- name: Test Become/Sudo
  hosts: all
  become: yes
  tasks:
    - name: Verificar privilegios
      command: whoami
      register: result
    
    - name: Mostrar usuario actual
      debug:
        msg: "Ejecutando como: {{ result.stdout }}"
    
    - name: Verificar que es root
      assert:
        that:
          - result.stdout == "root"
        fail_msg: "❌ No se obtuvieron privilegios de root"
        success_msg: "✅ Privilegios de root correctos"
```

### 3. Ver logs de ejecución:

```bash
# Ver logs del worker de Celery
docker logs -f celery_worker

# Buscar errores relacionados con become
docker logs celery_worker 2>&1 | grep -i "sudo\|become\|password"
```

## Solución de Problemas

### Error: "Missing sudo password"

**Síntomas:**
```
fatal: [servidor]: FAILED! => {"msg": "Missing sudo password"}
```

**Causas posibles:**
1. La contraseña SSH no se guardó al crear el servidor
2. NOPASSWD no está configurado en el servidor
3. El usuario SSH no tiene privilegios sudo

**Soluciones:**

**A. Recrear el servidor con contraseña:**
```bash
# 1. Eliminar el servidor actual
DELETE /api/servers/{id}

# 2. Crear nuevamente con ssh_password
POST /api/servers
{
  "name": "servidor-01",
  "ip_address": "192.168.1.100",
  "ssh_user": "admin",
  "ssh_password": "tu_contraseña"  # ← Asegúrate de incluir esto
}
```

**B. Configurar NOPASSWD en el servidor:**
```bash
ssh admin@servidor
sudo visudo
# Agregar: admin ALL=(ALL) NOPASSWD: ALL
```

### Error: "Incorrect sudo password"

**Síntomas:**
```
fatal: [servidor]: FAILED! => {"msg": "Incorrect sudo password"}
```

**Causa:** La contraseña guardada no es correcta para sudo.

**Solución:**
```bash
# Opción 1: Recrear el servidor con la contraseña correcta
# Opción 2: Configurar NOPASSWD (ver arriba)
```

### Error: "Failed to decrypt password"

**Síntomas:**
```
Error desencriptando contraseña: Invalid token
```

**Causas:**
1. La `ENCRYPTION_KEY` en `.env` cambió
2. La base de datos se migró sin la clave correcta
3. Corrupción de datos

**Solución:**
```bash
# 1. Verificar que ENCRYPTION_KEY no haya cambiado
cat server/.env | grep ENCRYPTION_KEY

# 2. Si perdiste la clave, necesitas:
#    a. Generar una nueva (eliminar ENCRYPTION_KEY del .env y reiniciar)
#    b. Recrear todos los servidores con sus contraseñas
```

### Error: "Connection refused" o timeout SSH

**Síntomas:**
```
fatal: [servidor]: UNREACHABLE! => {"msg": "Failed to connect to the host via ssh"}
```

**No es un problema de become**, verifica:
1. Firewall permite puerto SSH (22)
2. Servidor está online
3. Clave SSH se desplegó correctamente

## Seguridad - Mejores Prácticas

### ✅ Hacer:

1. **Usar NOPASSWD en producción**
   ```bash
   echo "ansible ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/ansible
   sudo chmod 0440 /etc/sudoers.d/ansible
   ```

2. **Proteger ENCRYPTION_KEY**
   - Usar gestor de secretos (AWS Secrets Manager, Vault)
   - No commitear en git
   - Limitar acceso solo a personal autorizado

3. **Rotar contraseñas regularmente**
   ```bash
   # Cambiar contraseña SSH cada 90 días
   passwd
   # Actualizar en el sistema si no usas NOPASSWD
   ```

4. **Limitar privilegios sudo** (si NOPASSWD no es opción):
   ```
   # Solo permitir comandos específicos
   usuario ALL=(ALL) NOPASSWD: /usr/bin/apt, /usr/bin/systemctl
   ```

5. **Auditar accesos**
   ```bash
   # Ver últimos comandos sudo
   sudo cat /var/log/auth.log | grep sudo
   ```

### ❌ NO Hacer:

1. ❌ **NO** uses la misma contraseña en todos los servidores
2. ❌ **NO** compartas ENCRYPTION_KEY en repositorios públicos
3. ❌ **NO** uses contraseñas débiles
4. ❌ **NO** deshabilites la autenticación de sudo sin control adecuado
5. ❌ **NO** ignores logs de seguridad

## Comparación: Contraseña Guardada vs NOPASSWD

| Característica | Contraseña Guardada | NOPASSWD |
|---------------|---------------------|----------|
| **Seguridad** | Media (encriptada) | Alta |
| **Configuración** | Automática | Manual (requiere acceso root) |
| **Mantenimiento** | Bajo | Muy bajo |
| **Ideal para** | Desarrollo, pruebas | Producción |
| **Riesgo** | Contraseña almacenada | Acceso sin contraseña |
| **Dependencia** | ENCRYPTION_KEY | Configuración del servidor |
| **Velocidad** | Normal | Más rápido |
| **Recomendación** | ⚠️ OK para dev | ✅ Recomendado |

## Arquitectura Técnica

### Flujo de Encriptación:

```
1. Usuario crea servidor con ssh_password
                ↓
2. Backend recibe contraseña en texto plano
                ↓
3. encrypt_password(ssh_password) → Fernet.encrypt()
                ↓
4. Se guarda en DB: ssh_password_encrypted (Base64)
                ↓
5. Contraseña original se descarta (no se guarda)
```

### Flujo de Ejecución de Playbook:

```
1. Usuario ejecuta playbook con become: yes
                ↓
2. Backend obtiene servidores desde DB
                ↓
3. Para cada servidor:
   - Busca ssh_password_encrypted
   - Si existe: decrypt_password() → contraseña en texto plano
   - Agrega a inventario: ansible_become_password: <password>
                ↓
4. Ansible ejecuta playbook
   - Cuando encuentra become: yes
   - Usa ansible_become_password automáticamente
                ↓
5. Tarea se ejecuta con privilegios sudo ✓
```

### Algoritmo de Encriptación:

- **Librería**: `cryptography` (Python)
- **Algoritmo**: Fernet (AES 128 CBC + HMAC)
- **Formato**: Base64 URL-safe
- **Seguridad**: Autenticación + Encriptación
- **Resistencia**: Protege contra modificación y lectura

## Referencias

- [Ansible Become Documentation](https://docs.ansible.com/ansible/latest/user_guide/become.html)
- [Ansible Inventory Variables](https://docs.ansible.com/ansible/latest/user_guide/intro_inventory.html#connecting-to-hosts-behavioral-inventory-parameters)
- [Sudo NOPASSWD Configuration](https://www.sudo.ws/docs/man/sudoers.man/)
- [Cryptography Fernet Specification](https://cryptography.io/en/latest/fernet/)
- [Security Best Practices for Ansible](https://docs.ansible.com/ansible/latest/tips_tricks/ansible_tips_tricks.html#keep-vaulted-variables-safely-visible)

## Soporte

Si encuentras problemas:

1. Revisa los logs del backend: `docker logs server`
2. Revisa los logs de Celery: `docker logs celery_worker`
3. Verifica la configuración del servidor: `ssh usuario@servidor "sudo -n true"`
4. Consulta esta documentación
5. Revisa los ejemplos de playbooks de prueba

---

