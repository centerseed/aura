from abc import ABC, abstractmethod
from app.domain.entities.input_entity import StructuredInput

class IGatekeeper(ABC):
    @abstractmethod
    async def process_raw_input(self, raw_text: str) -> StructuredInput:
        """將原始輸入轉化為結構化數據"""
        pass

class ILibrarian(ABC):
    @abstractmethod
    async def archive_input(self, structured_input: StructuredInput) -> str:
        """自動決定物理路徑並儲存檔案，回傳儲存路徑"""
        pass

    @abstractmethod
    async def get_context(self, structured_input: StructuredInput) -> str:
        """根據目前的輸入抓取相關的 Reference 背景"""
        pass

class ICoach(ABC):
    @abstractmethod
    async def detect_conflicts(self) -> list:
        """掃描全域狀態，偵測潛在衝突"""
        pass

    @abstractmethod
    async def generate_evening_questions(self) -> list:
        """生成晚報的心理閉環問答"""
        pass
