import os
from supabase import create_client, Client

_client: Client | None = None


def get_client() -> Client:
    """Lazily create a single shared Supabase client using the service key.

    The MCP server uses the service key (not the anon key) since it acts as
    a trusted backend, not an end-user client.
    """
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _client = create_client(url, key)
    return _client
