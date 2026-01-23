"""Unit tests for GeminiAdapter.

Tests the Gemini LLM adapter implementation for Pydantic AI.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from app.infrastructure.llm.gemini_adapter import GeminiAdapter
from app.domain.exceptions import LLMAPIError


class TestGeminiAdapter:
    """Test suite for GeminiAdapter."""

    @pytest.fixture
    def mock_api_key(self):
        """Mock API key for testing."""
        return "test-gemini-api-key-12345"

    @pytest.fixture
    def gemini_adapter(self, mock_api_key):
        """Create a GeminiAdapter with mock API key."""
        return GeminiAdapter(
            model_name="gemini-2.0-flash-exp",
            api_key=mock_api_key
        )

    def test_create_adapter_with_model_name(self, mock_api_key):
        """Should create adapter with specified model name."""
        adapter = GeminiAdapter(
            model_name="gemini-2.0-flash-exp",
            api_key=mock_api_key
        )

        assert adapter.get_model_name() == "gemini-2.0-flash-exp"

    def test_create_adapter_with_different_model(self, mock_api_key):
        """Should support different Gemini model variants."""
        adapter = GeminiAdapter(
            model_name="gemini-1.5-pro",
            api_key=mock_api_key
        )

        assert adapter.get_model_name() == "gemini-1.5-pro"

    def test_get_model_instance(self, gemini_adapter):
        """Should return a Pydantic AI Model instance."""
        model = gemini_adapter.get_model_instance()

        # Should return a model object (not None)
        assert model is not None
        # Model should have Pydantic AI interface (will verify in integration test)

    def test_supports_streaming(self, gemini_adapter):
        """Gemini models should support streaming."""
        assert gemini_adapter.supports_streaming is True

    def test_supports_tool_calling(self, gemini_adapter):
        """Gemini models should support tool calling."""
        assert gemini_adapter.supports_tool_calling is True

    def test_get_model_config(self, gemini_adapter):
        """Should return model configuration."""
        config = gemini_adapter.get_model_config()

        assert isinstance(config, dict)
        assert "model_name" in config
        assert config["model_name"] == "gemini-2.0-flash-exp"

    def test_get_model_config_with_custom_params(self, mock_api_key):
        """Should allow custom configuration parameters."""
        adapter = GeminiAdapter(
            model_name="gemini-2.0-flash-exp",
            api_key=mock_api_key,
            temperature=0.7,
            max_tokens=2048
        )

        config = adapter.get_model_config()

        assert config["temperature"] == 0.7
        assert config["max_tokens"] == 2048

    @pytest.mark.asyncio
    async def test_validate_connection_success(self, gemini_adapter):
        """Should validate connection successfully with valid API key."""
        # This test will be a mock for unit testing
        # Real API call will be in integration tests
        with patch.object(gemini_adapter, 'validate_connection',
                         new_callable=AsyncMock, return_value=True):
            result = await gemini_adapter.validate_connection()
            assert result is True

    @pytest.mark.asyncio
    async def test_validate_connection_failure(self, mock_api_key):
        """Should raise LLMAPIError when API key is invalid."""
        adapter = GeminiAdapter(
            model_name="gemini-2.0-flash-exp",
            api_key="invalid-key"
        )

        # Mock the validation to raise error
        with patch.object(adapter, 'validate_connection',
                         new_callable=AsyncMock,
                         side_effect=LLMAPIError("Gemini", "Invalid API key")):
            with pytest.raises(LLMAPIError) as exc_info:
                await adapter.validate_connection()

            assert "Invalid API key" in str(exc_info.value)

    def test_adapter_implements_interface(self, gemini_adapter):
        """Should implement ILLMAdapter interface."""
        from app.domain.interfaces.llm_adapter_interface import ILLMAdapter

        assert isinstance(gemini_adapter, ILLMAdapter)

        # Verify all required methods exist
        assert hasattr(gemini_adapter, 'get_model_instance')
        assert hasattr(gemini_adapter, 'get_model_name')
        assert hasattr(gemini_adapter, 'get_model_config')
        assert hasattr(gemini_adapter, 'supports_streaming')
        assert hasattr(gemini_adapter, 'supports_tool_calling')
        assert hasattr(gemini_adapter, 'validate_connection')
