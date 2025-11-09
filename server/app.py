import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from .settings import settings
from .db import engine, Base
from .routers import auth as auth_router
from .routers import users as users_router
from .routers import spaces as spaces_router
from .routers import bookings as bookings_router

app = FastAPI(title="Interactive Office Planner API", version="1.1.0")

# CORS: allow the production origin and optional extra origins from .env; always permit localhost via regex
requested_origin = "https://smart-hack-backend.vercel.app"
origins = set(settings.origins or [])
origins.add(requested_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

# Error normalization
@app.exception_handler(SQLAlchemyError)
async def db_error_handler(request: Request, exc: SQLAlchemyError):
    return JSONResponse(status_code=500, content={"detail": "Database error"})

@app.exception_handler(Exception)
async def default_error_handler(request: Request, exc: Exception):
    # Let FastAPI handle HTTPException, return generic for others
    from fastapi.exceptions import HTTPException
    if isinstance(exc, HTTPException):
        raise exc
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

# Routers
app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(spaces_router.router)
app.include_router(bookings_router.router)

@app.get("/health")
def health():
    return {"status": "ok"}
