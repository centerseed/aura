"""Integration test for Gemini 2.5 Flash Lite model.

This test verifies that the GeminiAdapter can successfully connect to
and use the Gemini 2.5 Flash Lite model, which is optimized for:
- Low latency
- Cost efficiency
- No thinking mode by default (prioritizing speed)

Reference: https://ai.google.dev/gemini-api/docs/models
Model Name: gemini-2.5-flash-lite
"""

import pytest
import os
from dotenv import load_dotenv
from app.infrastructure.llm.gemini_adapter import GeminiAdapter
from app.infrastructure.llm.llm_adapter_factory import LLMAdapterFactory

# Load environment variables from .env file
load_dotenv()


@pytest.mark.skipif(
    not os.getenv("GEMINI_API_KEY"),
    reason="GEMINI_API_KEY environment variable not set"
)
class TestGeminiFlashLiteIntegration:
    """Integration tests for Gemini 2.5 Flash Lite model."""

    @pytest.fixture
    def api_key(self):
        """Get API key from environment."""
        return os.getenv("GEMINI_API_KEY")

    @pytest.mark.asyncio
    async def test_gemini_flash_lite_stable_connection(self, api_key):
        """Should successfully connect to Gemini 2.5 Flash Lite stable version."""
        adapter = GeminiAdapter(
            model_name="gemini-2.5-flash-lite",
            api_key=api_key
        )

        # Verify connection
        is_valid = await adapter.validate_connection()
        assert is_valid is True
        assert adapter.get_model_name() == "gemini-2.5-flash-lite"

    @pytest.mark.asyncio
    async def test_gemini_flash_lite_via_factory(self, api_key):
        """Should create Gemini 2.5 Flash Lite adapter via factory."""
        adapter = LLMAdapterFactory.create_adapter(
            provider="gemini",
            model_name="gemini-2.5-flash-lite",
            api_key=api_key
        )

        assert adapter.get_model_name() == "gemini-2.5-flash-lite"
        assert adapter.supports_streaming is True
        assert adapter.supports_tool_calling is True

        # Validate connection
        is_valid = await adapter.validate_connection()
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_gemini_flash_lite_with_temperature(self, api_key):
        """Should apply custom temperature configuration."""
        adapter = GeminiAdapter(
            model_name="gemini-2.5-flash-lite",
            api_key=api_key,
            temperature=0.3  # Lower temperature for more deterministic output
        )

        config = adapter.get_model_config()
        assert config["temperature"] == 0.3
        assert config["model_name"] == "gemini-2.5-flash-lite"

        # Verify connection works with custom config
        is_valid = await adapter.validate_connection()
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_gemini_flash_lite_preview_version(self, api_key):
        """Should support preview version of Gemini 2.5 Flash Lite."""
        adapter = GeminiAdapter(
            model_name="gemini-2.5-flash-lite-preview-09-2025",
            api_key=api_key
        )

        assert adapter.get_model_name() == "gemini-2.5-flash-lite-preview-09-2025"

        # Note: Preview version may not always be available, so we only test adapter creation
        # If connection fails, it's expected behavior

    def test_gemini_flash_lite_adapter_properties(self, api_key):
        """Should have correct adapter properties for Flash Lite."""
        adapter = GeminiAdapter(
            model_name="gemini-2.5-flash-lite",
            api_key=api_key
        )

        # Flash Lite should support streaming and tool calling
        assert adapter.supports_streaming is True
        assert adapter.supports_tool_calling is True

        # Verify model instance exists
        model = adapter.get_model_instance()
        assert model is not None


@pytest.mark.skipif(
    not os.getenv("GEMINI_API_KEY"),
    reason="GEMINI_API_KEY environment variable not set"
)
class TestMultipleGeminiModels:
    """Test multiple Gemini model variants for comparison."""

    @pytest.fixture
    def api_key(self):
        """Get API key from environment."""
        return os.getenv("GEMINI_API_KEY")

    @pytest.mark.asyncio
    async def test_compare_gemini_models(self, api_key):
        """Should support multiple Gemini 2.5 model variants."""
        models = [
            "gemini-2.5-flash-lite",  # Fastest, lowest cost
            "gemini-2.0-flash-exp",   # Experimental flash
            "gemini-1.5-pro",          # High capability
        ]

        for model_name in models:
            adapter = LLMAdapterFactory.create_adapter(
                provider="gemini",
                model_name=model_name,
                api_key=api_key
            )

            assert adapter.get_model_name() == model_name
            is_valid = await adapter.validate_connection()

            # Note: Some models may not be available, skip if connection fails
            if not is_valid:
                pytest.skip(f"Model {model_name} not available")
