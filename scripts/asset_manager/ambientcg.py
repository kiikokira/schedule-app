"""ambientCG API v3クライアント。公式: https://docs.ambientcg.com/api/ (v3優先)"""
from urllib.parse import urlencode

from . import config as C
from . import util as U

INCLUDE = "title,type,tags,downloads,maps,url,thumbnails,previews"

JP_DICT = {
    "森林の地面": "forest ground",
    "森林": "forest",
    "石畳": "cobblestone",
    "コンクリート": "concrete",
    "砂漠": "desert",
    "草原": "grass",
    "木材": "wood",
    "土壌": "soil",
    "レンガ": "brick",
    "れんが": "brick",
    "木": "wood",
    "板": "planks",
    "草": "grass",
    "芝": "grass",
    "土": "soil",
    "泥": "mud",
    "岩": "rock",
    "石": "stone",
    "砂": "sand",
    "森": "forest",
    "山": "mountain",
    "雪": "snow",
    "地面": "ground",
}


def translate_query(q: str):
    out = {q}
    keys = sorted(JP_DICT.keys(), key=len, reverse=True)
    for jp in keys:
        if jp in q:
            en = JP_DICT[jp]
            out.add(q.replace(jp, f" {en} ").strip().replace("  ", " "))
            out.add(en)
        if len(out) >= 3:
            break
    return list(out)[:3]


def _assets_url(params: dict) -> str:
    return f"{C.API_AMBIENTCG_V3}/assets?{urlencode(params)}"


def search(query: str, atype: str = "all", limit: int = 10):
    queries = translate_query(query.strip())
    seen: set = set()
    collected: list = []
    lim = min(max(limit, 1), 20)
    for q in queries:
        params = {"q": q, "limit": str(lim), "sort": "popular", "include": INCLUDE}
        if atype != "all":
            params["type"] = atype
        try:
            data = U.fetch_json(_assets_url(params))
        except Exception:
            continue
        for a in data.get("assets", []) or []:
            if not a or not a.get("id") or a["id"] in seen:
                continue
            seen.add(a["id"])
            collected.append(a)
            if len(collected) >= limit:
                break
        if len(collected) >= limit:
            break
    return collected[:limit]


def get_asset(asset_id: str) -> dict:
    U.assert_asset_id(asset_id)
    data = U.fetch_json(_assets_url({"id": asset_id, "include": INCLUDE}))
    assets = data.get("assets", []) or []
    if not assets:
        raise ValueError(f"素材が見つかりません: {asset_id}")
    return assets[0]


def list_downloads(asset: dict) -> list:
    return [d for d in (asset.get("downloads") or []) if d.get("url") and d.get("size") is not None]


def parse_attributes(attr: str):
    upper = (attr or "").upper()
    res = "-"
    for cand in ("16K", "12K", "8K", "4K", "2K", "1K"):
        if cand in upper:
            res = cand
            break
    if "PNG" in upper:
        fmt = "PNG"
    elif "JPG" in upper or "JPEG" in upper:
        fmt = "JPG"
    elif "EXR" in upper:
        fmt = "EXR"
    elif "HDR" in upper:
        fmt = "HDR"
    else:
        fmt = "-"
    return res, fmt


def pick_4k(downloads: list):
    """4K含有を優先。無ければNone（呼び出し側で欠品記録・DLしない）。"""
    dls = [d for d in (downloads or []) if d.get("url")]
    if not dls:
        return None
    four = [d for d in dls if "4K" in (d.get("attributes") or "").upper()]
    if not four:
        return None
    four_sorted = sorted(four, key=lambda d: (d.get("size") or 0))
    # JPG優先、最小サイズを代表に
    def score(d):
        a = (d.get("attributes") or "").upper()
        s = 0
        if "JPG" in a:
            s += 10
        if "PNG" in a:
            s += 5
        return s
    four_sorted.sort(key=lambda d: (-score(d), d.get("size") or 0))
    return four_sorted[0]
