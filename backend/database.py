from supabase import create_client, Client
from .config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# Use service key on backend for full access
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
