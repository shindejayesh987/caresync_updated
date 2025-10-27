import os
from typing import Tuple

from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "hospital1")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
SESSION_TTL_MINUTES = int(os.getenv("SESSION_TTL_MINUTES", "4320"))
DEFAULT_USER_ROLES: Tuple[str, ...] = tuple(
    role.strip().lower()
    for role in os.getenv("DEFAULT_USER_ROLES", "clinician").split(",")
    if role.strip()
) or ("clinician",)
ALGORITHM = "HS256"
