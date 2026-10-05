from fastmcp.server.dependencies import get_access_token


def get_authenticated_user_id() -> str:
    token = get_access_token()

    if token is None:
        raise RuntimeError("No authenticated user found.")

    if not token.subject:
        raise RuntimeError("Authenticated token has no user ID.")

    return token.subject