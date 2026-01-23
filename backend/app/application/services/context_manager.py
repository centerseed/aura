"""Context Manager for conversation history and token management.

This module provides intelligent compression and management of conversation
history to stay within model token limits.
"""

from enum import Enum
from typing import List, Dict, Any
from app.domain.entities.context_window import ContextWindow
from app.domain.interfaces.token_counter_interface import ITokenCounter
from app.domain.exceptions import ContextWindowExceededError


class CompressionStrategy(str, Enum):
    """Strategies for compressing conversation history."""

    SLIDING_WINDOW = "sliding_window"  # Keep most recent N messages
    SUMMARIZE = "summarize"            # Summarize older messages (Phase 2)
    HIERARCHICAL = "hierarchical"      # Keep important + recent (Phase 2)


class ContextManager:
    """Manages conversation context and token budgets.

    This service handles:
    - Token counting for conversations
    - Intelligent compression when approaching limits
    - Preserving important messages (system prompts, etc.)
    - Usage monitoring and statistics

    Example:
        ```python
        manager = ContextManager(
            token_counter=gemini_counter,
            context_window=ContextWindow.from_model("gemini-2.5-flash-lite")
        )

        # Check if conversation fits
        if await manager.check_capacity(messages):
            # Safe to proceed
            pass
        else:
            # Compress conversation
            messages = await manager.compress_conversation(messages)
        ```
    """

    def __init__(
        self,
        token_counter: ITokenCounter,
        context_window: ContextWindow,
        default_buffer: float = 0.1  # 10% safety buffer
    ):
        """Initialize context manager.

        Args:
            token_counter: Token counter for the model
            context_window: Context window configuration
            default_buffer: Safety buffer percentage (default 10%)
        """
        self._token_counter = token_counter
        self._context_window = context_window
        self._default_buffer = default_buffer

    async def estimate_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """Estimate token count for conversation.

        Args:
            messages: List of message dictionaries

        Returns:
            Estimated token count
        """
        return await self._token_counter.estimate_conversation_tokens(messages)

    async def check_capacity(
        self,
        messages: List[Dict[str, Any]],
        buffer_percentage: float = None
    ) -> bool:
        """Check if conversation fits within token limit.

        Args:
            messages: Conversation history
            buffer_percentage: Override default buffer

        Returns:
            True if within capacity, False otherwise
        """
        token_count = await self.estimate_tokens(messages)
        buffer = buffer_percentage if buffer_percentage is not None else self._default_buffer
        safe_limit = self._context_window.get_safe_limit(buffer_percentage=buffer)

        return token_count <= safe_limit

    async def compress_conversation(
        self,
        messages: List[Dict[str, Any]],
        strategy: CompressionStrategy = CompressionStrategy.SLIDING_WINDOW,
        keep_recent: int = 10,
        force: bool = False
    ) -> List[Dict[str, Any]]:
        """Compress conversation history intelligently.

        Args:
            messages: Original conversation history
            strategy: Compression strategy to use
            keep_recent: Number of recent messages to keep (for sliding window)
            force: Force compression even if within limit

        Returns:
            Compressed conversation history
        """
        # Check if compression needed
        if not force and await self.check_capacity(messages):
            return messages  # No compression needed

        if strategy == CompressionStrategy.SLIDING_WINDOW:
            return self._compress_sliding_window(messages, keep_recent)
        elif strategy == CompressionStrategy.SUMMARIZE:
            # Phase 2: Use LLM to summarize older messages
            raise NotImplementedError("Summarize strategy not yet implemented")
        elif strategy == CompressionStrategy.HIERARCHICAL:
            # Phase 2: Keep important + recent messages
            raise NotImplementedError("Hierarchical strategy not yet implemented")
        else:
            raise ValueError(f"Unknown compression strategy: {strategy}")

    def _compress_sliding_window(
        self,
        messages: List[Dict[str, Any]],
        keep_recent: int
    ) -> List[Dict[str, Any]]:
        """Compress using sliding window (keep most recent N).

        Preserves:
        - System messages (always kept at start)
        - Most recent N messages

        Args:
            messages: Original messages
            keep_recent: Number of recent messages to keep

        Returns:
            Compressed messages
        """
        if len(messages) <= keep_recent:
            return messages

        # Separate system messages from conversation
        system_messages = [msg for msg in messages if msg.get("role") == "system"]
        conversation_messages = [msg for msg in messages if msg.get("role") != "system"]

        # Keep most recent N conversation messages
        recent_messages = conversation_messages[-keep_recent:]

        # Combine: system messages + recent conversation
        return system_messages + recent_messages

    async def ensure_within_limit(
        self,
        messages: List[Dict[str, Any]],
        buffer_percentage: float = None
    ) -> None:
        """Ensure conversation is within token limit.

        Args:
            messages: Conversation history
            buffer_percentage: Override default buffer

        Raises:
            ContextWindowExceededError: If exceeds limit
        """
        token_count = await self.estimate_tokens(messages)
        buffer = buffer_percentage if buffer_percentage is not None else self._default_buffer
        safe_limit = self._context_window.get_safe_limit(buffer_percentage=buffer)

        if token_count > safe_limit:
            raise ContextWindowExceededError(
                model_name=self._token_counter.get_model_name(),
                token_count=token_count,
                limit=safe_limit
            )

    async def get_usage_stats(
        self,
        messages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Get token usage statistics.

        Args:
            messages: Conversation history

        Returns:
            Dictionary with usage statistics:
            - token_count: Current token usage
            - max_tokens: Maximum tokens available
            - usage_percentage: Percentage used
            - remaining_tokens: Tokens remaining
            - model_name: Model identifier
        """
        token_count = await self.estimate_tokens(messages)
        max_tokens = self._context_window.max_input_tokens
        usage_percentage = self._context_window.get_usage_percentage(token_count)
        remaining_tokens = max_tokens - token_count

        return {
            "token_count": token_count,
            "max_tokens": max_tokens,
            "usage_percentage": usage_percentage,
            "remaining_tokens": remaining_tokens,
            "model_name": self._token_counter.get_model_name(),
        }

    def get_model_name(self) -> str:
        """Get model name.

        Returns:
            Model identifier
        """
        return self._token_counter.get_model_name()

    def get_max_tokens(self) -> int:
        """Get maximum token limit.

        Returns:
            Maximum input tokens
        """
        return self._context_window.max_input_tokens
