from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Import BOTH the router and the limiter from routes.py
from app.api.routes import router as bid_router, limiter

app = FastAPI(
    title="CSePS API",
    description="Cryptographically Secure Government e-Procurement System",
    version="1.0.0"
)

# Attach the limiter to the FastAPI application state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Enable CORS to allow your React frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
        ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bid_router)

@app.get("/")
def read_root():
    return {"status": "success", "message": "CSePS API is running and secured!"}