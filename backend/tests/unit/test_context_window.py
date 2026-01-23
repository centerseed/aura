"""Unit tests for ContextWindow value object.

Tests the context window configuration for different LLM models.
"""

import pytest
from app.domain.entities.context_window import ContextWindow


class TestContextWindow:
    """Test suite for ContextWindow value object."""

    def test_create_context_window_with_defaults(self):
        """Should create context window with model name only."""
        window = ContextWindow(model_name="gemini-2.5-flash-lite")

        assert window.model_name == "gemini-2.5-flash-lite"
        assert window.max_input_tokens > 0
        assert window.max_output_tokens > 0
        assert window.total_limit > 0

    def test_gemini_flash_lite_context_window(self):
        """Should have 1M context window for Gemini 2.5 Flash Lite."""
        window = ContextWindow.from_model("gemini-2.5-flash-lite")

        # Gemini 2.5 Flash Lite has 1M context window
        assert window.max_input_tokens == 1_000_000
        assert window.model_name == "gemini-2.5-flash-lite"

    def test_gemini_pro_context_window(self):
        """Should have 2M context window for Gemini 1.5 Pro."""
        window = ContextWindow.from_model("gemini-1.5-pro")

        # Gemini 1.5 Pro has 2M context window
        assert window.max_input_tokens == 2_000_000
        assert window.model_name == "gemini-1.5-pro"

    def test_custom_context_window(self):
        """Should allow custom context window configuration."""
        window = ContextWindow(
            model_name="custom-model",
            max_input_tokens=50000,
            max_output_tokens=10000
        )

        assert window.max_input_tokens == 50000
        assert window.max_output_tokens == 10000
        assert window.total_limit == 60000

    def test_context_window_total_limit(self):
        """Should calculate total limit correctly."""
        window = ContextWindow(
            model_name="test-model",
            max_input_tokens=100000,
            max_output_tokens=8192
        )

        assert window.total_limit == 108192

    def test_context_window_usage_percentage(self):
        """Should calculate usage percentage."""
        window = ContextWindow.from_model("gemini-2.5-flash-lite")

        # 50K tokens used out of 1M
        percentage = window.get_usage_percentage(used_tokens=50000)
        assert percentage == 5.0

    def test_context_window_has_capacity(self):
        """Should check if window has capacity for additional tokens."""
        window = ContextWindow(
            model_name="test-model",
            max_input_tokens=100000,
            max_output_tokens=8192
        )

        # Current usage: 50K, want to add 30K
        assert window.has_capacity(
            current_tokens=50000,
            additional_tokens=30000
        ) is True

        # Current usage: 90K, want to add 30K -> exceeds limit
        assert window.has_capacity(
            current_tokens=90000,
            additional_tokens=30000
        ) is False

    def test_context_window_get_safe_limit(self):
        """Should return safe limit with buffer."""
        window = ContextWindow.from_model("gemini-2.5-flash-lite")

        # Default buffer is 10%
        safe_limit = window.get_safe_limit()
        assert safe_limit == int(1_000_000 * 0.9)

        # Custom buffer
        safe_limit = window.get_safe_limit(buffer_percentage=0.2)
        assert safe_limit == int(1_000_000 * 0.8)

    def test_unsupported_model_raises_error(self):
        """Should raise ValueError for unsupported model."""
        with pytest.raises(ValueError) as exc_info:
            ContextWindow.from_model("unknown-model-xyz")

        assert "Unsupported model" in str(exc_info.value)
