"""Gemini Token Counter implementation.

This module provides token counting functionality for Google Gemini models
using the Google Generative AI API.
"""

from typing import List
import google.generativeai as genai
from app.domain.interfaces.token_counter_interface import ITokenCounter
from app.domain.exceptions import TokenCountError


class GeminiTokenCounter(ITokenCounter):
    """Token counter for Google Gemini models.

    Uses the Google Generative AI API to count tokens in text.
    This provides accurate token counting for Gemini-specific tokenization.

    Example:
        ```python
        counter = GeminiTokenCounter(
            model_name="gemini-2.5-flash-lite",
            api_key=api_key
        )

        token_count = await counter.count_tokens("Hello, world!")
        print(f"Tokens: {token_count}")
        ```
    """

    def __init__(self, model_name: str, api_key: str):
        """Initialize Gemini token counter.

        Args:
            model_name: Gemini model identifier
            api_key: Google AI API key
        """
        self._model_name = model_name
        self._api_key = api_key

        # Configure the API
        genai.configure(api_key=api_key)
        self._genai_client = genai.GenerativeModel(model_name)

    async def count_tokens(self, text: str) -> int:
        """Count tokens in a single text string.

        Args:
            text: Input text to tokenize

        Returns:
            Number of tokens

        Raises:
            TokenCountError: If token counting fails
        """
        try:
            # Use Gemini's count_tokens API
            response = await self._genai_client.count_tokens_async(text)
            return response.total_tokens
        except Exception as e:
            raise TokenCountError(
                model_name=self._model_name,
                error_message=str(e)
            )

    async def count_tokens_batch(self, texts: List[str]) -> List[int]:
        """Count tokens in multiple texts.

        Args:
            texts: List of input texts

        Returns:
            List of token counts for each text

        Raises:
            TokenCountError: If token counting fails
        """
        counts = []
        for text in texts:
            count = await self.count_tokens(text)
            counts.append(count)
        return counts

    async def estimate_conversation_tokens(
        self,
        messages: List[dict]
    ) -> int:
        """Estimate tokens for a conversation history.

        Args:
            messages: List of message dicts with 'role' and 'content'

        Returns:
            Estimated total tokens for the conversation

        Raises:
            TokenCountError: If token counting fails
        """
        # Combine all message contents
        combined_text = "\n".join(
            f"{msg.get('role', 'user')}: {msg.get('content', '')}"
            for msg in messages
        )

        return await self.count_tokens(combined_text)

    def get_model_name(self) -> str:
        """Get the model name this counter is configured for.

        Returns:
            Model identifier string
        """
        return self._model_name
