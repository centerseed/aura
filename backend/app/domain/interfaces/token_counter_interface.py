"""Token Counter Interface for LLM token estimation.

This module defines the abstract interface for counting tokens
across different LLM providers.
"""

from abc import ABC, abstractmethod
from typing import List


class ITokenCounter(ABC):
    """Abstract interface for token counting.

    Different LLM providers use different tokenization methods.
    This interface provides a unified way to count tokens regardless
    of the underlying provider.
    """

    @abstractmethod
    async def count_tokens(self, text: str) -> int:
        """Count tokens in a single text string.

        Args:
            text: Input text to tokenize

        Returns:
            Number of tokens

        Raises:
            TokenCountError: If token counting fails
        """
        pass

    @abstractmethod
    async def count_tokens_batch(self, texts: List[str]) -> List[int]:
        """Count tokens in multiple texts.

        Args:
            texts: List of input texts

        Returns:
            List of token counts for each text

        Raises:
            TokenCountError: If token counting fails
        """
        pass

    @abstractmethod
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
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Get the model name this counter is configured for.

        Returns:
            Model identifier string
        """
        pass
