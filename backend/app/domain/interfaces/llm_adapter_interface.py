"""LLM Adapter interface for Pydantic AI model integration.

This module defines the abstract interface for LLM adapters that wrap
different LLM providers (Gemini, OpenAI, Claude) for use with Pydantic AI.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class ILLMAdapter(ABC):
    """Abstract interface for LLM model adapters.

    Implementations provide configured Pydantic AI Model instances
    for different LLM providers (Gemini 2.5 Flash-Lite, OpenAI, etc).
    """

    @abstractmethod
    def get_model_instance(self) -> Any:
        """Get the Pydantic AI Model instance.

        Returns:
            A Pydantic AI Model object configured for the specific provider.
            For Gemini: pydantic_ai.models.gemini.GeminiModel
            For OpenAI: pydantic_ai.models.openai.OpenAIModel
        """
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Get the model identifier string.

        Returns:
            Model name string (e.g., "gemini-2.0-flash-exp")
        """
        pass

    @abstractmethod
    def get_model_config(self) -> Dict[str, Any]:
        """Get the model configuration parameters.

        Returns:
            Dict containing model settings like temperature, max_tokens, etc.
        """
        pass

    @property
    @abstractmethod
    def supports_streaming(self) -> bool:
        """Check if this model supports streaming responses.

        Returns:
            True if streaming is supported, False otherwise
        """
        pass

    @property
    @abstractmethod
    def supports_tool_calling(self) -> bool:
        """Check if this model supports function/tool calling.

        Returns:
            True if tool calling is supported, False otherwise
        """
        pass

    @abstractmethod
    async def validate_connection(self) -> bool:
        """Validate the connection to the LLM provider.

        Returns:
            True if connection is valid and API key works, False otherwise

        Raises:
            LLMAPIError: If connection fails
        """
        pass
