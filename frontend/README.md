# Frontend - Sistema PP

Frontend desarrollado con Next.js 14, React 18 y TypeScript para el sistema de gestión de servidores.

## 🚀 Inicio Rápido

### Instalación

```bash
cd frontend
npm install
```

### Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

### Build para Producción

```bash
npm run build
npm start
```

## 📁 Estructura del Proyecto

```
frontend/
├── app/
│   ├── login/          # Página de login
│   ├── dashboard/      # Dashboard principal (próximo)
│   ├── globals.css     # Estilos globales
│   ├── layout.tsx      # Layout principal
│   └── page.tsx        # Página de inicio (redirige a login)
├── lib/
│   └── api.ts          # Configuración de API y servicios
├── public/             # Archivos estáticos
├── .env.local          # Variables de entorno
└── package.json        # Dependencias
```

## 🔐 Autenticación

El sistema usa JWT para la autenticación:

1. El usuario inicia sesión en `/login`
2. Se obtiene un token JWT del backend
3. El token se guarda en `localStorage`
4. Todas las peticiones incluyen el token en el header `Authorization`
5. Si el token expira o es inválido, se redirige automáticamente a login

## 🎨 Estilos

- **Tailwind CSS** para los estilos
- Tema personalizado con colores primarios azules
- Componentes reutilizables definidos en `globals.css`:
  - `.btn` - Botones base
  - `.btn-primary` - Botón primario
  - `.btn-secondary` - Botón secundario
  - `.input` - Campos de entrada
  - `.card` - Tarjetas

## 🔧 Configuración

### Variables de Entorno

Edita `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### API Base URL

La URL del backend se configura en:
- `.env.local` para desarrollo local
- Variables de entorno en producción/Docker

## 📦 Dependencias Principales

- **Next.js 14** - Framework React
- **React 18** - Librería UI
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Framework CSS
- **Axios** - Cliente HTTP

## 🐳 Docker

Para construir y ejecutar con Docker, ver el `Dockerfile` en la raíz del proyecto frontend.

## 📝 Credenciales por Defecto

- **Usuario:** admin
- **Contraseña:** admin123

⚠️ Cambia estas credenciales en producción.
