"""Unit tests for GeminiTokenCounter.

Tests token counting functionality for Gemini models.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.infrastructure.llm.gemini_token_counter import GeminiTokenCounter
from app.domain.interfaces.token_counter_interface import ITokenCounter
from app.domain.exceptions import TokenCountError


class TestGeminiTokenCounter:
    """Test suite for GeminiTokenCounter."""

    @pytest.fixture
    def mock_api_key(self):
        """Mock API key for testing."""
        return "test-gemini-api-key-12345"

    @pytest.fixture
    def token_counter(self, mock_api_key):
        """Create GeminiTokenCounter with mock API key."""
        return GeminiTokenCounter(
            model_name="gemini-2.5-flash-lite",
            api_key=mock_api_key
        )

    def test_create_token_counter(self, mock_api_key):
        """Should create token counter with model name."""
        counter = GeminiTokenCounter(
            model_name="gemini-2.5-flash-lite",
            api_key=mock_api_key
        )

        assert counter.get_model_name() == "gemini-2.5-flash-lite"
        assert isinstance(counter, ITokenCounter)

    def test_token_counter_implements_interface(self, token_counter):
        """Should implement ITokenCounter interface."""
        assert hasattr(token_counter, 'count_tokens')
        assert hasattr(token_counter, 'count_tokens_batch')
        assert hasattr(token_counter, 'estimate_conversation_tokens')
        assert hasattr(token_counter, 'get_model_name')

    @pytest.mark.asyncio
    async def test_count_tokens_simple_text(self, token_counter):
        """Should count tokens in simple text."""
        with patch.object(token_counter, '_genai_client') as mock_client:
            # Mock the count_tokens response
            mock_response = MagicMock()
            mock_response.total_tokens = 10
            mock_client.count_tokens_async = AsyncMock(return_value=mock_response)

            result = await token_counter.count_tokens("Hello, world!")

            assert result == 10
            mock_client.count_tokens_async.assert_called_once_with("Hello, world!")

    @pytest.mark.asyncio
    async def test_count_tokens_empty_string(self, token_counter):
        """Should return 0 for empty string."""
        with patch.object(token_counter, '_genai_client') as mock_client:
            mock_response = MagicMock()
            mock_response.total_tokens = 0
            mock_client.count_tokens_async = AsyncMock(return_value=mock_response)

            result = await token_counter.count_tokens("")

            assert result == 0

    @pytest.mark.asyncio
    async def test_count_tokens_batch(self, token_counter):
        """Should count tokens for multiple texts."""
        texts = ["Hello", "World", "How are you?"]

        with patch.object(token_counter, 'count_tokens') as mock_count:
            # Mock returns different counts for each text
            mock_count.side_effect = [2, 2, 4]

            results = await token_counter.count_tokens_batch(texts)

            assert results == [2, 2, 4]
            assert mock_count.call_count == 3

    @pytest.mark.asyncio
    async def test_estimate_conversation_tokens(self, token_counter):
        """Should estimate tokens for conversation history."""
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
            {"role": "user", "content": "How are you?"}
        ]

        with patch.object(token_counter, 'count_tokens') as mock_count:
            # Mock returns token count for combined text
            mock_count.return_value = 20

            result = await token_counter.estimate_conversation_tokens(messages)

            assert result == 20
            # Should combine all message contents
            mock_count.assert_called_once()

    @pytest.mark.asyncio
    async def test_count_tokens_api_error(self, token_counter):
        """Should raise TokenCountError when API fails."""
        with patch.object(token_counter, '_genai_client') as mock_client:
            mock_client.count_tokens = AsyncMock(
                side_effect=Exception("API Error")
            )

            with pytest.raises(TokenCountError) as exc_info:
                await token_counter.count_tokens("test")

            assert "gemini-2.5-flash-lite" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_count_tokens_long_text(self, token_counter):
        """Should handle long text."""
        long_text = "Lorem ipsum " * 1000  # ~2000 words

        with patch.object(token_counter, '_genai_client') as mock_client:
            mock_response = MagicMock()
            mock_response.total_tokens = 2500
            mock_client.count_tokens_async = AsyncMock(return_value=mock_response)

            result = await token_counter.count_tokens(long_text)

            assert result > 1000  # Should be substantial token count

    def test_get_model_name(self, token_counter):
        """Should return configured model name."""
        assert token_counter.get_model_name() == "gemini-2.5-flash-lite"
