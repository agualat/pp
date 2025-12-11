from fastapi import FastAPI, HTTPException
from client.router.metrics import router as metrics_router
from client.router.sync import router as sync_router
import psycopg2
import os

app = FastAPI()

@app.get("/")
def read_root():
    return {"hello": "client"}

@app.get("/health")
def health_check():
    """
    Health check endpoint que verifica la conectividad con la base de datos
    """
    try:
        # Intentar conectar a la base de datos
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            database=os.getenv("DB_NAME", "mydb"),
            user=os.getenv("NSS_DB_USER", "postgres"),
            password=os.getenv("NSS_DB_PASSWORD", "postgres")
        )
        
        # Verificar que la tabla users existe
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
        
        cur.close()
        conn.close()
        
        return {
            "status": "healthy",
            "database": "connected",
            "users_count": user_count
        }
    
    except psycopg2.OperationalError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {str(e)}"
        )
    
    except psycopg2.ProgrammingError as e:
        # La tabla no existe
        return {
            "status": "warning",
            "database": "connected",
            "message": "Users table does not exist yet. It will be created on first sync.",
            "error": str(e)
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )

app.include_router(metrics_router)
app.include_router(sync_router)