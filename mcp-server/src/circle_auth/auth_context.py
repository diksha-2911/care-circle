from fastmcp.server.dependencies import get_access_token


def get_authenticated_access_token() -> str:
    """Return the verified access token for the current MCP request."""
    token = get_access_token()

    if token is None:
        raise RuntimeError("No authenticated user found.")

    if not token.subject:
        raise RuntimeError("Authenticated token has no user ID.")

    if not token.token:
        raise RuntimeError("Authenticated access token is missing.")

    return token.token


def get_authenticated_user_id() -> str:
    """Return the authenticated user's ID."""
    token = get_access_token()

    if token is None:
        raise RuntimeError("No authenticated user found.")

    if not token.subject:
        raise RuntimeError("Authenticated token has no user ID.")

    return token.subject