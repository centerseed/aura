import os
import pytest
from google.cloud import firestore
from dotenv import load_dotenv

load_dotenv()

def test_firestore_write():
    """
    驗證後端是否能成功寫入 Firestore。
    這是 Task 001-10 的關鍵驗證步驟。
    """
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    db = firestore.Client(project=project_id)
    
    # 建立一筆測試資料
    doc_ref = db.collection("system_check").document("connectivity_test")
    doc_ref.set({
        "status": "success",
        "message": "Aura Backend successfully connected to Firestore",
        "timestamp": firestore.SERVER_TIMESTAMP
    })
    
    # 讀取回來驗證
    doc = doc_ref.get()
    assert doc.exists
    assert doc.to_dict()["status"] == "success"
    print("\n✅ Firestore 聯通測試成功！")
