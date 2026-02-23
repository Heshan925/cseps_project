from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as bid_router

app = FastAPI(
    title="CSePS API",
    description="Cryptographically Secure Government e-Procurement System",
    version="1.0.0"
)

# Enable CORS to allow your React frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite's default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bid_router)

@app.get("/")
def read_root():
    return {"status": "success", "message": "CSePS API is running!"}