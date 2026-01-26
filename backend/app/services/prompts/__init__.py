"""
Prompt 模板模組

集中管理 AI Agent 的 system prompt 和治理原則。
"""
from .librarian_prompts import (
    GOVERNANCE_PRINCIPLES,
    ONTOLOGY_HEURISTICS,
    build_structure_agent_prompt,
    build_governance_agent_prompt,
    build_insight_agent_prompt,
)

__all__ = [
    "GOVERNANCE_PRINCIPLES",
    "ONTOLOGY_HEURISTICS",
    "build_structure_agent_prompt",
    "build_governance_agent_prompt",
    "build_insight_agent_prompt",
]
