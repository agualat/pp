from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .router.auth import router as auth_router
from .router.ansible import router as ansible_router
from .router.executions import router as executions_router
from .router.servers import router as servers_router
from .router.users import router as users_router
from .router.sync import router as sync_router
from .models.models import ServerCreate
from .utils.db import get_db

app = FastAPI()

# Middleware para logging de requests (para debugging)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"[REQUEST] {request.method} {request.url}")
    print(f"[HEADERS] Origin: {request.headers.get('origin')}")
    response = await call_next(request)
    print(f"[RESPONSE] Status: {response.status_code}")
    return response

# Configurar CORS - IMPORTANTE: debe ir ANTES de incluir routers
# Para desarrollo: permitir orígenes específicos con credenciales
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://frontend:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/")
def read_root():
    return {"hello": "server"}

app.include_router(auth_router)
app.include_router(ansible_router)
app.include_router(executions_router)
app.include_router(servers_router)
app.include_router(users_router)
app.include_router(sync_router)

# Endpoint público para auto-registro de servidores (sin autenticación)
from .CRUD.servers import create_server, get_server_by_ip, update_server

@app.post("/api/server-config/register")
def public_register_server(
    payload: ServerCreate,
    db: Session = Depends(get_db)
):
    """Endpoint público para que los clientes se auto-registren"""
    # Buscar si ya existe por IP
    existing = get_server_by_ip(db, payload.ip_address)
    
    if existing:
        # Actualizar información del servidor existente
        updates = {
            "name": payload.name,
            "ssh_user": payload.ssh_user
        }
        return update_server(db, existing.id, updates)
    
    # Crear nuevo servidor
    return create_server(db, payload)
