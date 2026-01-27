from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from config import settings
from api.analysis import router as analysis_router

app = FastAPI(
    title="Error Analysis Service",
    description="AI Intent Error Attribution Analysis Service",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(analysis_router, prefix="/api/analysis", tags=["Analysis"])

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "error-analysis"}

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=settings.debug)
