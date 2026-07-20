import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import init_db
from routes import auth, documents, chat

# Setup loggers
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DocMind AI API",
    description="Production-Ready AI-powered Document Analyzer and QA engine.",
    version="1.0.0"
)

# CORS configurations for local React dev server hot reloading
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in strict production to [settings.FRONTEND_URL]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup hook to initialize DB connection pool & schemas
@app.on_event("startup")
async def startup_event():
    logger.info("Initializing database session engines...")
    await init_db()

# Mount API routers
app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

# Serve React static SPA output files if compiled (Production mode / AWS App Runner)
dist_path = os.path.join(os.path.dirname(__file__), "dist") # For built files inside container
if not os.path.exists(dist_path):
    # Local developer path fallback
    dist_path = os.path.join(os.path.dirname(__file__), "../frontend/dist")

if os.path.exists(dist_path):
    logger.info(f"Serving compiled frontend static files from: {dist_path}")
    
    # Mount assets folder
    assets_dir = os.path.join(dist_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")
    
    # Fallback all other routing matching to React Router SPA (index.html)
    @app.get("/{fallback_path:path}")
    async def serve_frontend(fallback_path: str):
        if fallback_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API Endpoint not found")
        
        index_file = os.path.join(dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Static index file not found")
else:
    logger.warning("Compiled frontend assets not found. API running in standalone developer mode.")
    
    @app.get("/")
    async def root():
        return {
            "message": "DocMind AI API is running. Standalone mode. API docs available at /docs",
            "docs": "/docs"
        }
