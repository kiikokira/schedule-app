"""台帳管理。artifacts/asset_inventory.json + CSV。既存manifestの走査・追記。"""
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from . import config as C
from . import util as U


def _project_root(start: Path | None = None) -> Path:
    # scripts/asset_manager/ -> プロジェクトルート（3階層上）
    here = Path(__file__).resolve()
    return here.parents[2]


def scan_existing(project_root: Path | None = None) -> list:
    root = project_root or _project_root()
    rows: list = []
    for source, save_root in (
        ("polyhaven", C.SAVE_ROOT_POLYHAVEN),
        ("ambientCG", C.SAVE_ROOT_AMBIENTCG),
    ):
        base = root / save_root
        if not base.exists():
            continue
        for manifest in sorted(base.glob("*/manifest.json")):
            try:
                m = json.loads(manifest.read_text(encoding="utf-8"))
            except Exception:
                continue
            asset_id = m.get("assetId") or m.get("id") or manifest.parent.name
            rows.append({
                "id": asset_id,
                "name": m.get("assetName") or m.get("name") or asset_id,
                "source": m.get("source") or source,
                "url": m.get("originalUrl") or m.get("page") or "",
                "path": str(manifest.parent.relative_to(root)).replace("\\", "/"),
                "resolution": m.get("resolution") or "-",
                "format": m.get("fileFormat") or ",".join(m.get("formats", [])) or "-",
                "license": m.get("license") or "CC0",
                "bytes": m.get("total_bytes") or m.get("archiveSize") or 0,
                "downloaded_at": m.get("downloaded_at") or m.get("downloadDate") or "",
            })
    return rows


def load_inventory(project_root: Path | None = None) -> list:
    root = project_root or _project_root()
    inv = root / C.INVENTORY_JSON
    if not inv.exists():
        return []
    try:
        data = json.loads(inv.read_text(encoding="utf-8"))
        return data.get("assets", []) if isinstance(data, dict) else []
    except Exception:
        return []


def save_inventory(rows: list, project_root: Path | None = None) -> Path:
    root = project_root or _project_root()
    inv = root / C.INVENTORY_JSON
    U.safe_mkdir(inv.parent)
    payload = {
        "version": 1,
        "updated": datetime.now(timezone.utc).isoformat(),
        "note": "Poly Haven / ambientCG 4K資産台帳。既存index.jsonと併用。",
        "credit_polyhaven": C.CREDIT_POLYHAVEN,
        "credit_ambientcg": C.CREDIT_AMBIENTCG,
        "assets": sorted(rows, key=lambda r: (r.get("source", ""), r.get("id", ""))),
    }
    inv.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    # CSV併記
    csv_path = inv.with_suffix(".csv")
    fields = ["id", "name", "source", "url", "path", "resolution",
              "format", "license", "bytes", "downloaded_at", "md5", "verified"]
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in payload["assets"]:
            w.writerow(r)
    return inv


def upsert(rows: list, entry: dict) -> list:
    key = (entry.get("source"), entry.get("id"))
    out = [r for r in rows if (r.get("source"), r.get("id")) != key]
    out.append(entry)
    return out
