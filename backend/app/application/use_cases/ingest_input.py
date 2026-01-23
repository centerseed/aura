from app.domain.interfaces.agent_interfaces import IGatekeeper, ILibrarian, ICoach
from app.domain.entities.input_entity import StructuredInput

class IngestInputUseCase:
    def __init__(self, gatekeeper: IGatekeeper, librarian: ILibrarian):
        self.gatekeeper = gatekeeper
        self.librarian = librarian

    async def execute(self, raw_text: str) -> dict:
        # 1. Gatekeeper 穩定化原始輸入
        structured_data = await self.gatekeeper.process_raw_input(raw_text)
        
        # 2. Librarian 自動歸檔並決定物理位置
        file_path = await self.librarian.archive_input(structured_data)
        
        # 3. Librarian 抓取上下文背景 (Context Linker)
        context_background = await self.librarian.get_context(structured_data)
        
        return {
            "status": "success",
            "data": structured_data,
            "path": file_path,
            "context": context_background
        }
