"""共有設定。既存TSツール (.opencode/tools/polyhaven.ts, ambientcg.ts) の仕様を移植。"""

API_POLYHAVEN = "https://api.polyhaven.com"
API_AMBIENTCG_V3 = "https://ambientcg.com/api/v3"
UA = "schedule-app-assetmanager/0.1.0 (+https://kiikokira.github.io/schedule-app/)"

ALLOWED_DOWNLOAD_HOSTS = frozenset([
    "dl.polyhaven.org",
    "api.polyhaven.com",
    "cdn.polyhaven.com",
    "polyhaven.com",
    "ambientcg.com",
    "www.ambientcg.com",
    "acg-media.struffelproductions.com",
    "f003.backblazeb2.com",
])
ALLOWED_CDN_SUFFIXES = (".backblazeb2.com", ".struffelproductions.com")

SAVE_ROOT_POLYHAVEN = "artifacts/polyhaven"
SAVE_ROOT_AMBIENTCG = "artifacts/ambientcg"
INVENTORY_JSON = "artifacts/asset_inventory.json"

DEFAULT_RESOLUTION = "4K"
TIMEOUT = 30
RETRY = 3
CHUNK = 1024 * 64

CREDIT_POLYHAVEN = "Powered by Poly Haven (https://polyhaven.com/)"
CREDIT_AMBIENTCG = (
    "Created using assets from ambientCG.com, "
    "licensed under the Creative Commons CC0 1.0 Universal License."
)
LICENSE_POLYHAVEN = "https://polyhaven.com/license"
LICENSE_AMBIENTCG = "https://ambientcg.com/license"


def is_allowed_host(host: str) -> bool:
    if not host:
        return False
    h = host.lower()
    if h in ALLOWED_DOWNLOAD_HOSTS:
        return True
    return h.endswith(ALLOWED_CDN_SUFFIXES)
