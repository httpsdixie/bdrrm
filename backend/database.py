import httpx
import httpcore
from supabase import create_client, Client
from .config import SUPABASE_URL, SUPABASE_SERVICE_KEY


def _make_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# Module-level client — reused across requests
supabase: Client = _make_client()


def _is_stale_connection(exc: Exception) -> bool:
    """
    Return True when the error is a stale/dead HTTP/2 connection
    (EAGAIN / errno 11 — Resource temporarily unavailable).
    These happen when a pooled connection has been idle and the
    server closed it before we sent the next request.
    """
    return isinstance(exc, (httpx.ReadError, httpcore.ReadError))


def fresh_supabase() -> Client:
    """
    Return a brand-new Supabase client.
    Use this when you suspect a stale-connection error and need
    a clean HTTP session without touching the module-level singleton.
    """
    return _make_client()


class _SupabaseWithRetry:
    """
    Thin proxy around the module-level Supabase client that
    transparently retries once with a fresh client on stale-connection
    errors (httpx.ReadError / errno 11).
    """

    def __getattr__(self, name: str):
        return getattr(supabase, name)

    def table(self, table_name: str):
        return _TableWithRetry(table_name)


class _TableWithRetry:
    """
    Wraps supabase.table() so that any .execute() call that hits a
    stale HTTP/2 connection is retried once with a fresh client.
    """

    def __init__(self, table_name: str):
        self._table_name = table_name

    def __getattr__(self, name: str):
        # Delegate everything to the real table builder
        return getattr(supabase.table(self._table_name), name)


# ── Retry helper ──────────────────────────────────────────────────────────────

def execute_with_retry(query_fn):
    """
    Execute a lambda that builds and calls .execute() on a Supabase query.

    Usage:
        result = execute_with_retry(
            lambda client: client.table("resources").select("*").execute()
        )

    On a stale-connection ReadError, the module-level client is refreshed
    and the query is retried once.
    """
    global supabase
    try:
        return query_fn(supabase)
    except (httpx.ReadError, httpcore.ReadError):
        # Recreate the client to get a fresh HTTP/2 connection pool
        supabase = _make_client()
        return query_fn(supabase)
