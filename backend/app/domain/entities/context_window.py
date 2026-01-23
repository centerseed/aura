"""Context Window configuration for different LLM models.

This module provides context window limits for various LLM providers
to help manage conversation history and prevent token limit errors.
"""

from dataclasses import dataclass
from typing import Dict


# Model context window configurations
# Source: Official documentation from each provider
MODEL_CONTEXT_WINDOWS: Dict[str, Dict[str, int]] = {
    # Gemini models
    "gemini-2.5-flash-lite": {
        "max_input_tokens": 1_000_000,
        "max_output_tokens": 8_192,
    },
    "gemini-2.5-flash-lite-preview-09-2025": {
        "max_input_tokens": 1_000_000,
        "max_output_tokens": 8_192,
    },
    "gemini-2.0-flash-exp": {
        "max_input_tokens": 1_000_000,
        "max_output_tokens": 8_192,
    },
    "gemini-1.5-pro": {
        "max_input_tokens": 2_000_000,
        "max_output_tokens": 8_192,
    },
    "gemini-1.5-flash": {
        "max_input_tokens": 1_000_000,
        "max_output_tokens": 8_192,
    },
    # OpenAI models (Phase 2)
    "gpt-4": {
        "max_input_tokens": 128_000,
        "max_output_tokens": 4_096,
    },
    "gpt-4-turbo": {
        "max_input_tokens": 128_000,
        "max_output_tokens": 4_096,
    },
    "gpt-3.5-turbo": {
        "max_input_tokens": 16_385,
        "max_output_tokens": 4_096,
    },
    # Claude models (Phase 2)
    "claude-3-opus": {
        "max_input_tokens": 200_000,
        "max_output_tokens": 4_096,
    },
    "claude-3-sonnet": {
        "max_input_tokens": 200_000,
        "max_output_tokens": 4_096,
    },
    "claude-3-haiku": {
        "max_input_tokens": 200_000,
        "max_output_tokens": 4_096,
    },
}


@dataclass(frozen=True)
class ContextWindow:
    """Context window configuration for an LLM model.

    This value object encapsulates the token limits for a specific model,
    providing utilities for checking capacity and calculating usage.

    Attributes:
        model_name: Identifier of the LLM model
        max_input_tokens: Maximum input/prompt tokens
        max_output_tokens: Maximum output/completion tokens
        total_limit: Total tokens (input + output)

    Example:
        ```python
        # Create from known model
        window = ContextWindow.from_model("gemini-2.5-flash-lite")
        print(window.max_input_tokens)  # 1_000_000

        # Check capacity
        if window.has_capacity(current_tokens=50000, additional_tokens=10000):
            # Safe to add more context
            pass

        # Get safe limit with buffer
        safe_limit = window.get_safe_limit(buffer_percentage=0.1)
        ```
    """

    model_name: str
    max_input_tokens: int = 100_000  # Default conservative limit
    max_output_tokens: int = 4_096   # Common output limit

    @property
    def total_limit(self) -> int:
        """Total token limit (input + output)."""
        return self.max_input_tokens + self.max_output_tokens

    @classmethod
    def from_model(cls, model_name: str) -> "ContextWindow":
        """Create ContextWindow from known model name.

        Args:
            model_name: Model identifier (e.g., "gemini-2.5-flash-lite")

        Returns:
            ContextWindow instance with model-specific limits

        Raises:
            ValueError: If model is not supported
        """
        if model_name not in MODEL_CONTEXT_WINDOWS:
            raise ValueError(
                f"Unsupported model: '{model_name}'. "
                f"Supported models: {', '.join(MODEL_CONTEXT_WINDOWS.keys())}"
            )

        config = MODEL_CONTEXT_WINDOWS[model_name]
        return cls(
            model_name=model_name,
            max_input_tokens=config["max_input_tokens"],
            max_output_tokens=config["max_output_tokens"],
        )

    def get_usage_percentage(self, used_tokens: int) -> float:
        """Calculate percentage of context window used.

        Args:
            used_tokens: Number of tokens currently used

        Returns:
            Usage percentage (0-100)
        """
        return (used_tokens / self.max_input_tokens) * 100

    def has_capacity(self, current_tokens: int, additional_tokens: int) -> bool:
        """Check if context window has capacity for additional tokens.

        Args:
            current_tokens: Currently used tokens
            additional_tokens: Tokens to add

        Returns:
            True if adding tokens won't exceed limit
        """
        return (current_tokens + additional_tokens) <= self.max_input_tokens

    def get_safe_limit(self, buffer_percentage: float = 0.1) -> int:
        """Get safe token limit with buffer.

        Args:
            buffer_percentage: Buffer as decimal (0.1 = 10%)

        Returns:
            Safe limit accounting for buffer

        Example:
            >>> window = ContextWindow.from_model("gemini-2.5-flash-lite")
            >>> window.get_safe_limit()  # 900000 (90% of 1M)
            900000
        """
        return int(self.max_input_tokens * (1 - buffer_percentage))
