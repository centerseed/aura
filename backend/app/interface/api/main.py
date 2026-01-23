from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Aura Business OS API - Naruvia")

class RawInputRequest(BaseModel):
    text: str

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/")
def read_root():
    return {"message": "Aura Business OS API is running."}

@app.post("/ingest")
async def ingest_input(request: RawInputRequest):
    """
    主要輸入介面：接收 Bot 或 Web 的原始文字。
    """
    # 這裡未來會串接 Gatekeeper Agent 實作
    return {
        "status": "received",
        "processed_data": {
            "text": request.text,
            "note": "Aura engine is ready to process."
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
