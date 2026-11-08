"""Poly Haven APIクライアント。公式: https://api.polyhaven.com"""
from urllib.parse import urlencode

from . import config as C
from . import util as U

JP_DICT = {
    "レンガ": "brick",
    "れんが": "brick",
    "木": "wood",
    "木材": "wood",
    "板": "planks",
    "草原": "grass",
    "草": "grass",
    "芝": "grass",
    "空": "sky",
    "雲": "cloud",
    "岩": "rock",
    "石": "stone",
    "砂": "sand",
    "海": "ocean",
    "水": "water",
    "金属": "metal",
    "布": "fabric",
    "壁": "wall",
    "床": "floor",
    "森": "forest",
    "山": "mountain",
    "雪": "snow",
    "夜": "night",
    "建物": "building",
    "家": "house",
}


def translate_query(q: str):
    out = {q}
    for jp, en in JP_DICT.items():
        if jp in q:
            out.add(q.replace(jp, f" {en} ").strip().replace("  ", " "))
            out.add(en)
        if len(out) >= 3:
            break
    return list(out)[:3]


def search_url(q: str, atype: str = "all") -> str:
    params = {"q": q}
    if atype != "all":
        params["t"] = atype
    return f"{C.API_POLYHAVEN}/search?{urlencode(params)}"


def get_info_url(slug: str) -> str:
    U.assert_slug(slug)
    return f"{C.API_POLYHAVEN}/info/{slug}"


def get_files_url(slug: str) -> str:
    U.assert_slug(slug)
    return f"{C.API_POLYHAVEN}/files/{slug}"


def type_label(t, fallback: str) -> str:
    if isinstance(t, str):
        return t
    if t == 0:
        return "hdris"
    if t == 1:
        return "textures"
    if t == 2:
        return "models"
    return fallback


def search(query: str, atype: str = "all", limit: int = 10):
    queries = translate_query(query.strip())
    seen: set = set()
    slugs: list = []
    for q in queries:
        try:
            data = U.fetch_json(search_url(q, atype))
        except Exception:
            continue
        for r in data.get("results", []) or []:
            s = r.get("slug")
            if s and s not in seen:
                seen.add(s)
                slugs.append(s)
            if len(slugs) >= limit * 2:
                break
        if len(slugs) >= limit:
            break
    top = slugs[:limit]
    items = []
    for slug in top:
        try:
            info = get_info(slug)
        except Exception:
            info = {"name": slug}
        items.append({"slug": slug, "info": info})
    return items


def get_info(slug: str) -> dict:
    U.assert_slug(slug)
    return U.fetch_json(get_info_url(slug))


def flatten_files(files_json: dict) -> list:
    out: list = []

    def walk(map_name: str, node, resolution: str = "", fmt: str = ""):
        if not isinstance(node, dict):
            return
        if isinstance(node.get("url"), str) and isinstance(node.get("size"), int):
            out.append({
                "map": map_name,
                "resolution": resolution or "-",
                "format": fmt or "-",
                "size": node["size"],
                "url": node["url"],
                "md5": node.get("md5") if isinstance(node.get("md5"), str) else None,
            })
            inc = node.get("include")
            if isinstance(inc, dict):
                for k, v in inc.items():
                    if isinstance(v, dict) and isinstance(v.get("size"), int):
                        out.append({
                            "map": f"{map_name} (related: {k})",
                            "resolution": resolution or "-",
                            "format": "related",
                            "size": v.get("size", 0),
                            "url": v.get("url", ""),
                            "md5": None,
                        })
            return
        for k, v in node.items():
            if k == "include":
                continue
            if not resolution:
                walk(map_name, v, k, fmt)
            elif not fmt or fmt == "-":
                walk(map_name, v, resolution, k)
            else:
                walk(map_name, v, resolution, fmt)

    for m, node in (files_json or {}).items():
        walk(m, node)
    return out


def get_files(slug: str) -> list:
    U.assert_slug(slug)
    data = U.fetch_json(get_files_url(slug))
    return flatten_files(data)


def _res_rank(res: str) -> int:
    r = (res or "").lower()
    if r == "4k":
        return 100
    if r == "2k":
        return 50
    if r == "1k":
        return 10
    if "8k" in r or "16k" in r:
        return -100
    return 0


def pick_4k(entries: list, prefer: str = "png") -> list:
    """4K完全一致を優先、無ければ空リスト（呼び出し側で欠品記録・DLしない）。"""
    cands = [e for e in entries if e.get("format") != "related" and e.get("url")]
    if not cands:
        return []
    four = [e for e in cands if (e.get("resolution") or "").lower() == "4k"]
    pool = four if four else []
    if not pool:
        return []
    # マップ種別ごとに最小サイズ（PNG優先）を選択
    by_map: dict = {}
    for e in pool:
        by_map.setdefault(e["map"], []).append(e)
    picked = []
    for m, lst in by_map.items():
        lst_sorted = sorted(
            lst,
            key=lambda e: (
                0 if (e.get("format") or "").lower() == prefer.lower() else 1,
                e.get("size", 0),
            ),
        )
        picked.append(lst_sorted[0])
    # BaseColor/テクスチャ用途の優先度で先頭を代表に
    def score(e):
        s = 0
        ml = (e.get("map") or "").lower()
        if "color" in ml or "diff" in ml or "albedo" in ml:
            s += 50
        if (e.get("format") or "").lower() == prefer.lower():
            s += 10
        return s
    picked.sort(key=score, reverse=True)
    return picked
