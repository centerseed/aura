import json
from app.domain.entities.input_entity import StructuredInput, InputType, Status, EntityTag, RiskLevel
from app.domain.interfaces.agent_interfaces import IGatekeeper
import uuid

class GeminiGatekeeper(IGatekeeper):
    def __init__(self, api_key: str):
        self.api_key = api_key
        # 這裡未來會初始化 Google Generative AI 客戶端

    async def process_raw_input(self, raw_text: str) -> StructuredInput:
        """
        這裡會調用 LLM (e.g. Gemini 1.5 Pro) 並使用 Structured Outputs 模型。
        本實例為 MVP 的 Mock 實作邏輯。
        """
        # TODO: 調用 LLM API 並傳入 system_prompt (基於 naming_convention.md)
        
        # 模擬 LLM 回傳的結構化結果
        mock_id = str(uuid.uuid4())
        return StructuredInput(
            id=mock_id,
            raw_content=raw_text,
            type=InputType.ACTION, # 假設辨識為任務
            status=Status.ACTIVE,
            entity=EntityTag(area="04_Product", project="SAM_System", topic="MVP_Scaffold"),
            summary="建立後端基礎架構骨架",
            risk_level=RiskLevel.GREEN
        )
