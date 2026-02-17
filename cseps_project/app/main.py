from fastapi import FastAPI

# Initialize the FastAPI application
app = FastAPI(
    title="CSePS API",
    description="Cryptographically Secure Government e-Procurement System API",
    version="1.0.0"
)

@app.get("/")
def read_root():
    return {
        "status": "success",
        "message": "Welcome to the CSePS API. The server is securely running!"
    }