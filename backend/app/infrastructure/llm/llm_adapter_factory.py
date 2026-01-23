"""LLM Adapter Factory for Pydantic AI.

This module provides a factory pattern for creating LLM adapters
based on provider type. It simplifies adapter instantiation and
enables easy switching between different LLM providers.
"""

from typing import Any
from app.domain.interfaces.llm_adapter_interface import ILLMAdapter
from app.infrastructure.llm.gemini_adapter import GeminiAdapter


class LLMAdapterFactory:
    """Factory for creating LLM adapters based on provider.

    The factory pattern allows centralized adapter creation and
    simplifies adding new LLM providers in the future.

    Supported Providers (Phase 1):
    - gemini / google: Google Gemini models (via GoogleModel)

    Planned Providers (Phase 2):
    - openai: OpenAI GPT models
    - anthropic / claude: Anthropic Claude models
    - mistral: Mistral AI models

    Example:
        ```python
        # Create Gemini adapter
        adapter = LLMAdapterFactory.create_adapter(
            provider="gemini",
            model_name="gemini-2.0-flash-exp",
            api_key=api_key,
            temperature=0.7
        )

        # Create OpenAI adapter (Phase 2)
        adapter = LLMAdapterFactory.create_adapter(
            provider="openai",
            model_name="gpt-4",
            api_key=api_key
        )
        ```
    """

    @staticmethod
    def create_adapter(
        provider: str,
        model_name: str,
        api_key: str,
        **kwargs: Any
    ) -> ILLMAdapter:
        """Create an LLM adapter based on provider type.

        Args:
            provider: Provider identifier (e.g., 'gemini', 'openai', 'claude')
            model_name: Model identifier specific to the provider
            api_key: API key for authentication
            **kwargs: Additional model configuration (temperature, max_tokens, etc.)

        Returns:
            An instance of ILLMAdapter for the specified provider

        Raises:
            ValueError: If the provider is not supported
            NotImplementedError: If the provider is planned but not yet implemented

        Examples:
            >>> # Gemini 2.0 Flash
            >>> adapter = LLMAdapterFactory.create_adapter(
            ...     provider="gemini",
            ...     model_name="gemini-2.0-flash-exp",
            ...     api_key="your-api-key"
            ... )

            >>> # Gemini with custom config
            >>> adapter = LLMAdapterFactory.create_adapter(
            ...     provider="google",
            ...     model_name="gemini-1.5-pro",
            ...     api_key="your-api-key",
            ...     temperature=0.7,
            ...     max_tokens=2048
            ... )
        """
        provider_lower = provider.lower()

        # Phase 1: Gemini/Google support
        if provider_lower in ("gemini", "google"):
            return GeminiAdapter(
                model_name=model_name,
                api_key=api_key,
                **kwargs
            )

        # Phase 2: OpenAI support (planned)
        elif provider_lower == "openai":
            raise NotImplementedError(
                "OpenAI adapter not yet implemented. "
                "Planned for Phase 2 with support for GPT-4, GPT-3.5, etc."
            )

        # Phase 2: Claude/Anthropic support (planned)
        elif provider_lower in ("claude", "anthropic"):
            raise NotImplementedError(
                "Claude adapter not yet implemented. "
                "Planned for Phase 2 with support for Claude 3 Opus, Sonnet, Haiku, etc."
            )

        # Phase 2: Mistral support (planned)
        elif provider_lower == "mistral":
            raise NotImplementedError(
                "Mistral adapter not yet implemented. "
                "Planned for Phase 2 with support for Mistral models."
            )

        # Unknown provider
        else:
            raise ValueError(
                f"Unsupported LLM provider: '{provider}'. "
                f"Supported providers: gemini, google. "
                f"Planned providers: openai, anthropic, mistral."
            )
