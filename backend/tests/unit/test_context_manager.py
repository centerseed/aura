"""Unit tests for ContextManager.

Tests conversation history compression and token management.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.application.services.context_manager import ContextManager, CompressionStrategy
from app.domain.entities.context_window import ContextWindow
from app.domain.interfaces.token_counter_interface import ITokenCounter
from app.domain.exceptions import ContextWindowExceededError


class TestContextManager:
    """Test suite for ContextManager."""

    @pytest.fixture
    def mock_token_counter(self):
        """Create mock token counter."""
        counter = MagicMock(spec=ITokenCounter)
        counter.get_model_name.return_value = "gemini-2.5-flash-lite"
        counter.count_tokens = AsyncMock(return_value=100)
        counter.estimate_conversation_tokens = AsyncMock(return_value=500)
        return counter

    @pytest.fixture
    def context_window(self):
        """Create context window for testing."""
        return ContextWindow.from_model("gemini-2.5-flash-lite")

    @pytest.fixture
    def context_manager(self, mock_token_counter, context_window):
        """Create ContextManager with mocks."""
        return ContextManager(
            token_counter=mock_token_counter,
            context_window=context_window
        )

    def test_create_context_manager(self, mock_token_counter, context_window):
        """Should create context manager with dependencies."""
        manager = ContextManager(
            token_counter=mock_token_counter,
            context_window=context_window
        )

        assert manager.get_model_name() == "gemini-2.5-flash-lite"
        assert manager.get_max_tokens() == 1_000_000

    @pytest.mark.asyncio
    async def test_estimate_conversation_tokens(self, context_manager, mock_token_counter):
        """Should estimate tokens for conversation."""
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ]

        mock_token_counter.estimate_conversation_tokens.return_value = 20

        token_count = await context_manager.estimate_tokens(messages)

        assert token_count == 20
        mock_token_counter.estimate_conversation_tokens.assert_called_once_with(messages)

    @pytest.mark.asyncio
    async def test_check_capacity_within_limit(self, context_manager, mock_token_counter):
        """Should return True when within capacity."""
        messages = [{"role": "user", "content": "Hello"}]
        mock_token_counter.estimate_conversation_tokens.return_value = 50000

        has_capacity = await context_manager.check_capacity(messages)

        assert has_capacity is True

    @pytest.mark.asyncio
    async def test_check_capacity_exceeds_limit(self, context_manager, mock_token_counter):
        """Should return False when exceeds capacity."""
        messages = [{"role": "user", "content": "Very long text..."}]
        # Exceeds 1M limit
        mock_token_counter.estimate_conversation_tokens.return_value = 1_100_000

        has_capacity = await context_manager.check_capacity(messages)

        assert has_capacity is False

    @pytest.mark.asyncio
    async def test_compress_conversation_sliding_window(self, context_manager, mock_token_counter):
        """Should compress using sliding window strategy."""
        messages = [
            {"role": "user", "content": "Message 1"},
            {"role": "assistant", "content": "Response 1"},
            {"role": "user", "content": "Message 2"},
            {"role": "assistant", "content": "Response 2"},
            {"role": "user", "content": "Message 3"},
            {"role": "assistant", "content": "Response 3"},
        ]

        # Mock: conversation exceeds safe limit
        mock_token_counter.estimate_conversation_tokens.return_value = 950_000

        compressed = await context_manager.compress_conversation(
            messages=messages,
            strategy=CompressionStrategy.SLIDING_WINDOW,
            keep_recent=4  # Keep last 4 messages
        )

        # Should keep only last 4 messages
        assert len(compressed) == 4
        assert compressed[0]["content"] == "Message 2"
        assert compressed[-1]["content"] == "Response 3"

    @pytest.mark.asyncio
    async def test_compress_conversation_preserve_system(self, context_manager, mock_token_counter):
        """Should preserve system messages during compression."""
        messages = [
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": "Message 1"},
            {"role": "assistant", "content": "Response 1"},
            {"role": "user", "content": "Message 2"},
            {"role": "assistant", "content": "Response 2"},
        ]

        mock_token_counter.estimate_conversation_tokens.return_value = 950_000

        compressed = await context_manager.compress_conversation(
            messages=messages,
            strategy=CompressionStrategy.SLIDING_WINDOW,
            keep_recent=2
        )

        # Should preserve system message + keep 2 recent
        assert len(compressed) == 3
        assert compressed[0]["role"] == "system"
        assert compressed[1]["content"] == "Message 2"

    @pytest.mark.asyncio
    async def test_compress_conversation_no_compression_needed(self, context_manager, mock_token_counter):
        """Should not compress when within safe limit."""
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi"}
        ]

        # Well within limit
        mock_token_counter.estimate_conversation_tokens.return_value = 100

        compressed = await context_manager.compress_conversation(
            messages=messages,
            strategy=CompressionStrategy.SLIDING_WINDOW
        )

        # Should return all messages unchanged
        assert len(compressed) == 2
        assert compressed == messages

    @pytest.mark.asyncio
    async def test_ensure_within_limit_success(self, context_manager, mock_token_counter):
        """Should pass when conversation within limit."""
        messages = [{"role": "user", "content": "Hello"}]
        mock_token_counter.estimate_conversation_tokens.return_value = 50000

        # Should not raise exception
        await context_manager.ensure_within_limit(messages)

    @pytest.mark.asyncio
    async def test_ensure_within_limit_fails(self, context_manager, mock_token_counter):
        """Should raise exception when exceeds limit."""
        messages = [{"role": "user", "content": "Very long..."}]
        mock_token_counter.estimate_conversation_tokens.return_value = 1_100_000

        with pytest.raises(ContextWindowExceededError) as exc_info:
            await context_manager.ensure_within_limit(messages)

        assert "gemini-2.5-flash-lite" in str(exc_info.value)
        assert "1100000" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_usage_stats(self, context_manager, mock_token_counter):
        """Should return usage statistics."""
        messages = [{"role": "user", "content": "Hello"}]
        mock_token_counter.estimate_conversation_tokens.return_value = 100_000

        stats = await context_manager.get_usage_stats(messages)

        assert stats["token_count"] == 100_000
        assert stats["max_tokens"] == 1_000_000
        assert stats["usage_percentage"] == 10.0
        assert stats["remaining_tokens"] == 900_000
        assert stats["model_name"] == "gemini-2.5-flash-lite"

    def test_get_model_name(self, context_manager):
        """Should return model name."""
        assert context_manager.get_model_name() == "gemini-2.5-flash-lite"

    def test_get_max_tokens(self, context_manager):
        """Should return max tokens."""
        assert context_manager.get_max_tokens() == 1_000_000
