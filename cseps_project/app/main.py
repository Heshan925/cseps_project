from fastapi import FastAPI
from app.api.routes import router as bid_router

app = FastAPI(
    title="CSePS API",
    description="Cryptographically Secure Government e-Procurement System",
    version="1.0.0"
)

# Attach our secure bidding endpoints to the main application
app.include_router(bid_router)

@app.get("/")
def read_root():
    return {
        "status": "success",
        "message": "Welcome to the CSePS API. The server is securely running!"
    }