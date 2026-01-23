"""Unit tests for LLMAdapterFactory.

Tests the factory pattern for creating LLM adapters.
"""

import pytest
from app.infrastructure.llm.llm_adapter_factory import LLMAdapterFactory
from app.infrastructure.llm.gemini_adapter import GeminiAdapter
from app.domain.interfaces.llm_adapter_interface import ILLMAdapter


class TestLLMAdapterFactory:
    """Test suite for LLMAdapterFactory."""

    @pytest.fixture
    def mock_api_key(self):
        """Mock API key for testing."""
        return "test-api-key-12345"

    def test_create_gemini_adapter(self, mock_api_key):
        """Should create GeminiAdapter when provider is 'gemini'."""
        adapter = LLMAdapterFactory.create_adapter(
            provider="gemini",
            model_name="gemini-2.0-flash-exp",
            api_key=mock_api_key
        )

        assert isinstance(adapter, GeminiAdapter)
        assert isinstance(adapter, ILLMAdapter)
        assert adapter.get_model_name() == "gemini-2.0-flash-exp"

    def test_create_google_adapter(self, mock_api_key):
        """Should create GeminiAdapter when provider is 'google'."""
        adapter = LLMAdapterFactory.create_adapter(
            provider="google",
            model_name="gemini-1.5-pro",
            api_key=mock_api_key
        )

        assert isinstance(adapter, GeminiAdapter)
        assert adapter.get_model_name() == "gemini-1.5-pro"

    def test_create_adapter_with_custom_params(self, mock_api_key):
        """Should pass custom parameters to adapter."""
        adapter = LLMAdapterFactory.create_adapter(
            provider="gemini",
            model_name="gemini-2.0-flash-exp",
            api_key=mock_api_key,
            temperature=0.7,
            max_tokens=2048
        )

        config = adapter.get_model_config()
        assert config["temperature"] == 0.7
        assert config["max_tokens"] == 2048

    def test_create_adapter_case_insensitive(self, mock_api_key):
        """Should handle provider name case-insensitively."""
        adapter1 = LLMAdapterFactory.create_adapter(
            provider="Gemini",
            model_name="gemini-2.0-flash-exp",
            api_key=mock_api_key
        )

        adapter2 = LLMAdapterFactory.create_adapter(
            provider="GOOGLE",
            model_name="gemini-2.0-flash-exp",
            api_key=mock_api_key
        )

        assert isinstance(adapter1, GeminiAdapter)
        assert isinstance(adapter2, GeminiAdapter)

    def test_create_adapter_unsupported_provider(self, mock_api_key):
        """Should raise ValueError for unsupported provider."""
        with pytest.raises(ValueError) as exc_info:
            LLMAdapterFactory.create_adapter(
                provider="unknown-provider",
                model_name="some-model",
                api_key=mock_api_key
            )

        assert "Unsupported LLM provider" in str(exc_info.value)

    def test_create_adapter_openai_not_implemented(self, mock_api_key):
        """Should raise NotImplementedError for OpenAI (Phase 2)."""
        with pytest.raises(NotImplementedError) as exc_info:
            LLMAdapterFactory.create_adapter(
                provider="openai",
                model_name="gpt-4",
                api_key=mock_api_key
            )

        assert "OpenAI adapter not yet implemented" in str(exc_info.value)

    def test_create_adapter_claude_not_implemented(self, mock_api_key):
        """Should raise NotImplementedError for Claude (Phase 2)."""
        with pytest.raises(NotImplementedError) as exc_info:
            LLMAdapterFactory.create_adapter(
                provider="anthropic",
                model_name="claude-3-opus",
                api_key=mock_api_key
            )

        assert "Claude adapter not yet implemented" in str(exc_info.value)

    def test_factory_returns_interface(self, mock_api_key):
        """Should always return an ILLMAdapter instance."""
        adapter = LLMAdapterFactory.create_adapter(
            provider="gemini",
            model_name="gemini-2.0-flash-exp",
            api_key=mock_api_key
        )

        # Verify interface compliance
        assert hasattr(adapter, 'get_model_instance')
        assert hasattr(adapter, 'get_model_name')
        assert hasattr(adapter, 'get_model_config')
        assert hasattr(adapter, 'supports_streaming')
        assert hasattr(adapter, 'supports_tool_calling')
        assert hasattr(adapter, 'validate_connection')
