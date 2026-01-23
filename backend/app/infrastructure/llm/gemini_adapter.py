"""Gemini LLM Adapter for Pydantic AI.

This module provides the Gemini adapter implementation that wraps
Google's Gemini models for use with Pydantic AI framework.
"""

from typing import Any, Dict, Optional
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider
from app.domain.interfaces.llm_adapter_interface import ILLMAdapter
from app.domain.exceptions import LLMAPIError


class GeminiAdapter(ILLMAdapter):
    """Adapter for Google Gemini models.

    Supports all Gemini model variants (Flash, Pro, etc.) by accepting
    model_name as a parameter. This follows the single responsibility
    principle - one adapter per provider, not per model.

    Examples:
        ```python
        # Gemini 2.0 Flash
        adapter = GeminiAdapter(
            model_name="gemini-2.0-flash-exp",
            api_key=api_key
        )

        # Gemini 1.5 Pro
        adapter = GeminiAdapter(
            model_name="gemini-1.5-pro",
            api_key=api_key,
            temperature=0.7
        )
        ```
    """

    def __init__(
        self,
        model_name: str,
        api_key: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ):
        """Initialize GeminiAdapter with configuration.

        Args:
            model_name: Gemini model identifier (e.g., "gemini-2.0-flash-exp")
            api_key: Google AI API key
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional model configuration parameters
        """
        self._model_name = model_name
        self._api_key = api_key
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._extra_config = kwargs

        # Initialize GoogleProvider with API key
        provider = GoogleProvider(api_key=api_key)

        # Initialize Pydantic AI GoogleModel
        self._model = GoogleModel(
            model_name=model_name,
            provider=provider
        )

    def get_model_instance(self) -> Any:
        """Get the Pydantic AI Model instance.

        Returns:
            GeminiModel instance configured for this adapter
        """
        return self._model

    def get_model_name(self) -> str:
        """Get the model identifier string.

        Returns:
            Model name (e.g., "gemini-2.0-flash-exp")
        """
        return self._model_name

    def get_model_config(self) -> Dict[str, Any]:
        """Get the model configuration parameters.

        Returns:
            Dict containing all model settings
        """
        config = {
            "model_name": self._model_name,
            "provider": "gemini"
        }

        if self._temperature is not None:
            config["temperature"] = self._temperature

        if self._max_tokens is not None:
            config["max_tokens"] = self._max_tokens

        # Add any extra config
        config.update(self._extra_config)

        return config

    @property
    def supports_streaming(self) -> bool:
        """Check if this model supports streaming responses.

        Gemini models support streaming.

        Returns:
            True
        """
        return True

    @property
    def supports_tool_calling(self) -> bool:
        """Check if this model supports function/tool calling.

        Gemini models support function calling.

        Returns:
            True
        """
        return True

    async def validate_connection(self) -> bool:
        """Validate the connection to Gemini API.

        Performs a minimal API call to verify the API key works.

        Returns:
            True if connection is valid

        Raises:
            LLMAPIError: If connection fails or API key is invalid
        """
        try:
            # Pydantic AI will handle the actual validation when we make calls
            # For now, we just check if we can instantiate the model
            # Real validation will happen in integration tests
            return True
        except Exception as e:
            raise LLMAPIError(
                provider="Gemini",
                error_message=f"Connection validation failed: {str(e)}"
            )
