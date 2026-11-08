"""共通HTTP・安全ユーティリティ (stdlibのみ)。"""
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from . import config as C

_SLUG = re.compile(r"^[a-z0-9_]+$")
_ASSET = re.compile(r"^[A-Za-z0-9_-]+$")


def _req(url: str) -> urllib.request.Request:
    return urllib.request.Request(
        url, headers={"User-Agent": C.UA, "Accept": "application/json"}
    )


def fetch_json(url: str, attempt: int = 0):
    try:
        with urllib.request.urlopen(_req(url), timeout=C.TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code in (429, 500, 502, 503, 504) and attempt < C.RETRY:
            time.sleep(0.5 * (attempt + 1))
            return fetch_json(url, attempt + 1)
        raise


def assert_slug(s: str) -> None:
    if not _SLUG.match(s or ""):
        raise ValueError(f"不正なslugです: {s}")


def assert_asset_id(s: str) -> None:
    if not _ASSET.match(s or ""):
        raise ValueError(f"不正なassetIdです: {s}")


def assert_safe_zip_name(n: str) -> str:
    if not n or n.endswith("/"):
        return ""
    norm = n.replace("\\", "/")
    if norm.startswith("/") or "\0" in norm:
        raise ValueError(f"不正なファイル名: {n}")
    if len(norm) > 2 and norm[1] == ":":
        raise ValueError(f"不正なファイル名: {n}")
    if ".." in norm.split("/"):
        raise ValueError(f"パストラバーサルを検出: {n}")
    return norm


def assert_allowed_url(u: str) -> str:
    try:
        p = urlparse(u)
    except Exception:
        raise ValueError(f"不正なURLです: {u}")
    if p.scheme != "https":
        raise ValueError(f"httpsのみ許可: {u}")
    if not C.is_allowed_host(p.hostname or ""):
        raise ValueError(f"許可外ドメイン: {p.hostname}")
    return u


def fmt_mb(b: int) -> str:
    return f"{b / 1048576:.2f} MB"


def safe_mkdir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def file_exists(p: Path) -> bool:
    return p.exists()
