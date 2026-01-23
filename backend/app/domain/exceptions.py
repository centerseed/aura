"""Domain layer exceptions for Aura Backend.

This module defines all domain-specific exceptions used across the application.
These exceptions represent business rule violations and should be caught and
translated into appropriate HTTP responses at the interface layer.
"""


class AuraBaseException(Exception):
    """Base exception for all Aura domain errors.

    All domain exceptions should inherit from this class to enable
    centralized error handling.
    """

    def __init__(self, message: str, details: dict = None):
        """Initialize exception with message and optional details.

        Args:
            message: Human-readable error message
            details: Optional dict with additional context
        """
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


# Session Management Exceptions

class SessionError(AuraBaseException):
    """Base exception for session-related errors."""
    pass


class SessionNotFoundError(SessionError):
    """Raised when attempting to access a non-existent session."""

    def __init__(self, session_id: str):
        """Initialize with session ID.

        Args:
            session_id: The session ID that was not found
        """
        super().__init__(
            message=f"Session not found: {session_id}",
            details={"session_id": session_id}
        )


class SessionAlreadyExistsError(SessionError):
    """Raised when attempting to create a session that already exists."""

    def __init__(self, session_id: str):
        """Initialize with session ID.

        Args:
            session_id: The session ID that already exists
        """
        super().__init__(
            message=f"Session already exists: {session_id}",
            details={"session_id": session_id}
        )


# LLM Service Exceptions

class LLMError(AuraBaseException):
    """Base exception for LLM service errors."""
    pass


class LLMAPIError(LLMError):
    """Raised when LLM API call fails."""

    def __init__(self, provider: str, error_message: str):
        """Initialize with provider and error details.

        Args:
            provider: LLM provider name (e.g., "Gemini")
            error_message: Error message from the provider
        """
        super().__init__(
            message=f"{provider} API error: {error_message}",
            details={"provider": provider, "error": error_message}
        )


class LLMResponseParseError(LLMError):
    """Raised when LLM response cannot be parsed into expected format."""

    def __init__(self, response_text: str):
        """Initialize with unparseable response.

        Args:
            response_text: The response that failed to parse
        """
        super().__init__(
            message="Failed to parse LLM response",
            details={"response": response_text[:200]}  # Truncate for logging
        )


# Agent Execution Exceptions

class AgentError(AuraBaseException):
    """Base exception for agent execution errors."""
    pass


class AgentExecutionError(AgentError):
    """Raised when an agent fails to execute its task."""

    def __init__(self, agent_name: str, error_message: str):
        """Initialize with agent name and error details.

        Args:
            agent_name: Name of the agent that failed
            error_message: Description of the failure
        """
        super().__init__(
            message=f"{agent_name} execution failed: {error_message}",
            details={"agent": agent_name, "error": error_message}
        )


# MCP Tool Exceptions

class MCPError(AuraBaseException):
    """Base exception for MCP tool errors."""
    pass


class ToolCallError(MCPError):
    """Raised when MCP tool invocation fails."""

    def __init__(self, tool_name: str, error_message: str):
        """Initialize with tool name and error details.

        Args:
            tool_name: Name of the MCP tool that failed
            error_message: Description of the failure
        """
        super().__init__(
            message=f"Tool call failed: {tool_name} - {error_message}",
            details={"tool": tool_name, "error": error_message}
        )


# Validation Exceptions

class ValidationError(AuraBaseException):
    """Raised when input validation fails."""

    def __init__(self, field_name: str, error_message: str):
        """Initialize with field name and validation error.

        Args:
            field_name: The field that failed validation
            error_message: Validation error description
        """
        super().__init__(
            message=f"Validation error on field '{field_name}': {error_message}",
            details={"field": field_name, "error": error_message}
        )


# Token Management Exceptions

class TokenCountError(LLMError):
    """Raised when token counting fails."""

    def __init__(self, model_name: str, error_message: str):
        """Initialize with model name and error details.

        Args:
            model_name: Name of the model for which token counting failed
            error_message: Description of the failure
        """
        super().__init__(
            message=f"Token counting failed for {model_name}: {error_message}",
            details={"model": model_name, "error": error_message}
        )


class ContextWindowExceededError(LLMError):
    """Raised when conversation exceeds model's context window."""

    def __init__(self, model_name: str, token_count: int, limit: int):
        """Initialize with model, token count, and limit.

        Args:
            model_name: Name of the model
            token_count: Actual token count
            limit: Context window limit
        """
        super().__init__(
            message=f"Context window exceeded for {model_name}: "
                   f"{token_count} tokens > {limit} limit",
            details={
                "model": model_name,
                "token_count": token_count,
                "limit": limit
            }
        )


# MCP Server Management Exceptions

class MCPServerError(AuraBaseException):
    """Base exception for MCP server management errors."""
    pass


class MCPServerNotFoundError(MCPServerError):
    """Raised when a requested MCP server is not found."""

    def __init__(self, server_id: str):
        """Initialize with server ID.

        Args:
            server_id: ID of the server that was not found
        """
        super().__init__(
            message=f"MCP server not found: {server_id}",
            details={"server_id": server_id}
        )


class MCPConnectionError(MCPServerError):
    """Raised when MCP server connection fails."""

    def __init__(self, server_id: str, error_message: str):
        """Initialize with server ID and error details.

        Args:
            server_id: ID of the server
            error_message: Description of the connection error
        """
        super().__init__(
            message=f"MCP connection error for {server_id}: {error_message}",
            details={"server_id": server_id, "error": error_message}
        )


class MCPServerAlreadyRegisteredError(MCPServerError):
    """Raised when attempting to register a server that already exists."""

    def __init__(self, server_id: str):
        """Initialize with server ID.

        Args:
            server_id: ID of the server that already exists
        """
        super().__init__(
            message=f"MCP server already registered: {server_id}",
            details={"server_id": server_id}
        )


class MCPToolCallError(MCPError):
    """Raised when tool call on MCP server fails."""

    def __init__(self, server_id: str, tool_name: str, error_message: str):
        """Initialize with server, tool, and error details.

        Args:
            server_id: ID of the MCP server
            tool_name: Name of the tool that failed
            error_message: Description of the failure
        """
        super().__init__(
            message=f"MCP tool call failed: {server_id}.{tool_name} - {error_message}",
            details={
                "server_id": server_id,
                "tool": tool_name,
                "error": error_message
            }
        )
