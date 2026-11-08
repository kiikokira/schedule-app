"""CLI: search/info/files/dry-run/download/inventory (stdlibのみ)。"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import ambientcg as AC
from . import config as C
from . import downloader as DL
from . import inventory as INV
from . import polyhaven as PH
from . import util as U

ROOT = Path(__file__).resolve().parents[2]

# Windowsコンソールでの文字化け防止（UTF-8強制、失敗時は無視）
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def cmd_search(args) -> int:
    limit = args.limit
    if args.source in ("polyhaven", "both"):
        print("=== Poly Haven ===")
        items = PH.search(args.query, args.type_poly, limit)
        if not items:
            print(f"見つかりませんでした: {args.query}")
        for it in items:
            info = it["info"] or {}
            print(f"■ {info.get('name', it['slug'])}")
            print(f"  slug/id: {it['slug']}")
            print(f"  page: https://polyhaven.com/a/{it['slug']}")
            print(f"  categories: {info.get('categories', info.get('category', '-'))}")
            print(f"  license: CC0 ({C.LICENSE_POLYHAVEN})")
        print(C.CREDIT_POLYHAVEN)
    if args.source in ("ambientcg", "both"):
        print("=== ambientCG ===")
        assets = AC.search(args.query, args.type_acg, limit)
        if not assets:
            print(f"見つかりませんでした: {args.query}")
        for a in assets:
            print(f"■ {a.get('title', a.get('id'))}")
            print(f"  素材ID: {a.get('id')}")
            print(f"  種別: {a.get('type', '-')}")
            print(f"  解像度: {', '.join(d.get('attributes', '-') for d in (a.get('downloads') or []))}")
            print(f"  公式: {a.get('url', '-')}")
            print(f"  ライセンス: CC0 ({C.LICENSE_AMBIENTCG})")
        print(C.CREDIT_AMBIENTCG)
    return 0


def cmd_info(args) -> int:
    if args.source == "polyhaven":
        info = PH.get_info(args.id)
        print(json.dumps(info, ensure_ascii=False, indent=2))
        print(f"page: https://polyhaven.com/a/{args.id}")
        print(f"license: CC0 ({C.LICENSE_POLYHAVEN})")
        print(C.CREDIT_POLYHAVEN)
    else:
        a = AC.get_asset(args.id)
        print(json.dumps({k: a.get(k) for k in ("id", "title", "type", "tags", "maps", "url")}, ensure_ascii=False, indent=2))
        print(f"license: CC0 ({C.LICENSE_AMBIENTCG})")
        print(C.CREDIT_AMBIENTCG)
    return 0


def cmd_files(args) -> int:
    resolution = (args.resolution or C.DEFAULT_RESOLUTION).upper()
    if args.source == "polyhaven":
        entries = PH.get_files(args.id)
        total = sum(e["size"] for e in entries)
        print(f"■ {args.id} ({len(entries)}件, 合計 {U.fmt_mb(total)})")
        for e in entries[:40]:
            print(f"  - [{e['map']}] {e['resolution']} / {e['format']} : {U.fmt_mb(e['size'])}")
            print(f"    {e['url']}")
        picked = PH.pick_4k(entries)
        if picked:
            print(f"4K候補: {len(picked)}件 (代表: [{picked[0]['map']}] {picked[0]['resolution']}/{picked[0]['format']})")
        else:
            print(f"4K欠品: {args.id} には4Kがありません（記録のみ・置換なし）")
        print(C.CREDIT_POLYHAVEN)
    else:
        a = AC.get_asset(args.id)
        dls = AC.list_downloads(a)
        total = sum(d.get("size", 0) for d in dls)
        print(f"■ {a.get('title', a.get('id'))} ({a.get('id')}) {len(dls)}件 合計 {U.fmt_mb(total)}")
        for d in dls:
            print(f"  - {d.get('attributes', '-')} / {d.get('extension', '-')} : {U.fmt_mb(d.get('size', 0))}")
            print(f"    {d.get('url', '-')}")
        best = AC.pick_4k(dls)
        if best:
            print(f"4K候補: {best.get('attributes')} ({U.fmt_mb(best.get('size', 0))})")
        else:
            print(f"4K欠品: {args.id} には4Kがありません（記録のみ・置換なし）")
        print(C.CREDIT_AMBIENTCG)
    _ = resolution
    return 0


def _resolve_targets(list_file: str | None, single: str | None, source: str):
    targets: list = []
    if single:
        targets.append(single)
    if list_file:
        p = Path(list_file)
        for line in p.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if s and not s.startswith("#"):
                targets.append(s)
    return [(source, t) for t in targets]


def cmd_dry_run(args) -> int:
    pairs = _resolve_targets(args.list, args.id, args.source)
    if not pairs:
        print("対象がありません。--id または --list を指定してください。")
        return 2
    total = 0
    print(f"解像度既定: {C.DEFAULT_RESOLUTION}（欠品はDLせず記録）")
    for source, tid in pairs:
        try:
            if source == "polyhaven":
                entries = PH.get_files(tid)
                picked = PH.pick_4k(entries)
                if not picked:
                    print(f"- polyhaven:{tid} 4K欠品（スキップ・記録のみ）")
                    continue
                sub = sum(e["size"] for e in picked)
                total += sub
                print(f"- polyhaven:{tid} → {C.SAVE_ROOT_POLYHAVEN}/{tid}/ ({len(picked)}件, {U.fmt_mb(sub)})")
            else:
                a = AC.get_asset(tid)
                best = AC.pick_4k(AC.list_downloads(a))
                if not best:
                    print(f"- ambientcg:{tid} 4K欠品（スキップ・記録のみ）")
                    continue
                total += best.get("size", 0)
                print(f"- ambientcg:{tid} → {C.SAVE_ROOT_AMBIENTCG}/{tid}/ ({best.get('attributes')}, {U.fmt_mb(best.get('size', 0))})")
        except Exception as e:
            print(f"- {source}:{tid} 確認失敗: {e}")
    print(f"合計推定: {U.fmt_mb(total)}")
    print("※ このコマンドはDLしません。download実行前に承認を得てください。")
    return 0


def cmd_download(args) -> int:
    pairs = _resolve_targets(args.list, args.id, args.source)
    if not pairs:
        print("対象がありません。--id または --list を指定してください。")
        return 2
    if not args.yes:
        print("安全ゲート: --yes が無いためDLしません。先に dry-run で容量・保存先を確認してください。")
        return 2
    rows = INV.load_inventory(ROOT)
    # 既存manifestも取り込み（二重防止）
    for r in INV.scan_existing(ROOT):
        rows = INV.upsert(rows, r)
    for source, tid in pairs:
        try:
            if source == "polyhaven":
                entries = PH.get_files(tid)
                picked = PH.pick_4k(entries)
                if not picked:
                    print(f"- polyhaven:{tid} 4K欠品のためスキップ（記録のみ）")
                    rows = INV.upsert(rows, {"id": tid, "name": tid, "source": "polyhaven",
                                             "url": f"https://polyhaven.com/a/{tid}",
                                             "path": f"{C.SAVE_ROOT_POLYHAVEN}/{tid}",
                                             "resolution": "4K-missing", "format": "-",
                                             "license": "CC0", "bytes": 0,
                                             "downloaded_at": datetime.now(timezone.utc).isoformat(),
                                             "md5": "", "verified": "missing"})
                    continue
                dest_dir = ROOT / C.SAVE_ROOT_POLYHAVEN / tid
                U.safe_mkdir(dest_dir)
                saved = []
                total_b = 0
                for e in picked:
                    fname = e["url"].split("/")[-1].split("?")[0] or f"{tid}_{e['map']}_{e['resolution']}.{e['format']}"
                    dest = dest_dir / fname
                    if dest.exists():
                        print(f"  既存スキップ: {fname}")
                        continue
                    DL.download_file(e["url"], dest, e["size"], e.get("md5"), show_progress=not args.quiet)
                    saved.append(fname)
                    total_b += dest.stat().st_size
                rows = INV.upsert(rows, {"id": tid, "name": tid, "source": "polyhaven",
                                         "url": f"https://polyhaven.com/a/{tid}",
                                         "path": f"{C.SAVE_ROOT_POLYHAVEN}/{tid}",
                                         "resolution": "4K", "format": ",".join(sorted({e['format'] for e in picked})),
                                         "license": "CC0", "bytes": total_b,
                                         "downloaded_at": datetime.now(timezone.utc).isoformat(),
                                         "md5": ";".join([e.get("md5") or "" for e in picked]),
                                         "verified": "md5-checked" if any(e.get("md5") for e in picked) else "size-only"})
                print(f"完了: polyhaven:{tid} {len(saved)}件")
            else:
                a = AC.get_asset(tid)
                best = AC.pick_4k(AC.list_downloads(a))
                if not best:
                    print(f"- ambientcg:{tid} 4K欠品のためスキップ（記録のみ）")
                    rows = INV.upsert(rows, {"id": tid, "name": a.get("title", tid), "source": "ambientCG",
                                             "url": a.get("url", f"https://ambientcg.com/a/{tid}"),
                                             "path": f"{C.SAVE_ROOT_AMBIENTCG}/{tid}",
                                             "resolution": "4K-missing", "format": "-",
                                             "license": "CC0", "bytes": 0,
                                             "downloaded_at": datetime.now(timezone.utc).isoformat(),
                                             "md5": "", "verified": "missing"})
                    continue
                dest_dir = ROOT / C.SAVE_ROOT_AMBIENTCG / tid
                U.safe_mkdir(dest_dir)
                res, fmt = AC.parse_attributes(best.get("attributes", ""))
                ext = (best.get("extension") or "zip").lower()
                fname = f"{tid}_{best.get('attributes')}.{best.get('extension', 'zip')}"
                dest = dest_dir / fname
                if dest.exists():
                    print(f"  既存スキップ: {fname}（上書き禁止）")
                else:
                    DL.download_file(best["url"], dest, best.get("size"), None, show_progress=not args.quiet)
                    if ext == "zip":
                        data = dest.read_bytes()
                        extracted = DL.extract_bytes(data, dest_dir)
                        print(f"  展開: {len(extracted)}件")
                rows = INV.upsert(rows, {"id": tid, "name": a.get("title", tid), "source": "ambientCG",
                                         "url": a.get("url", f"https://ambientcg.com/a/{tid}"),
                                         "path": f"{C.SAVE_ROOT_AMBIENTCG}/{tid}",
                                         "resolution": res, "format": fmt,
                                         "license": "CC0", "bytes": best.get("size", 0),
                                         "downloaded_at": datetime.now(timezone.utc).isoformat(),
                                         "md5": "", "verified": "size-checked"})
                print(f"完了: ambientcg:{tid}")
        except FileExistsError as e:
            print(f"スキップ（既存）: {e}")
        except Exception as e:
            print(f"失敗: {source}:{tid}: {e}")
    inv_path = INV.save_inventory(rows, ROOT)
    print(f"台帳更新: {inv_path} (+ CSV)")
    return 0


def cmd_inventory(args) -> int:
    rows = INV.scan_existing(ROOT)
    merged = INV.load_inventory(ROOT)
    for r in rows:
        merged = INV.upsert(merged, r)
    p = INV.save_inventory(merged, ROOT)
    print(f"台帳再生成: {p}（{len(merged)}件）")
    for r in sorted(merged, key=lambda x: (x.get("source", ""), x.get("id", "")))[:50]:
        print(f"- {r.get('source')}:{r.get('id')} {r.get('resolution')} {r.get('path')}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Poly Haven / ambientCG 4K asset manager")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search", help="素材検索")
    s.add_argument("--query", required=True)
    s.add_argument("--source", default="both", choices=["polyhaven", "ambientcg", "both"])
    s.add_argument("--type-poly", default="all", choices=["hdris", "textures", "models", "all"])
    s.add_argument("--type-acg", default="all", choices=["material", "hdri", "decal", "3d-model", "terrain", "all"])
    s.add_argument("--limit", type=int, default=10)
    s.set_defaults(func=cmd_search)
    s2 = sub.add_parser("info", help="素材情報取得")
    s2.add_argument("--source", required=True, choices=["polyhaven", "ambientcg"])
    s2.add_argument("--id", required=True)
    s2.set_defaults(func=cmd_info)
    s3 = sub.add_parser("files", help="DL可能ファイル確認（容量・形式・4K有無）")
    s3.add_argument("--source", required=True, choices=["polyhaven", "ambientcg"])
    s3.add_argument("--id", required=True)
    s3.add_argument("--resolution", default=C.DEFAULT_RESOLUTION)
    s3.set_defaults(func=cmd_files)
    s4 = sub.add_parser("dry-run", help="DL前の一覧・容量提示（DLしない）")
    s4.add_argument("--source", default="polyhaven", choices=["polyhaven", "ambientcg"])
    s4.add_argument("--id")
    s4.add_argument("--list")
    s4.set_defaults(func=cmd_dry_run)
    s5 = sub.add_parser("download", help="4Kダウンロード（--yes必須）")
    s5.add_argument("--source", default="polyhaven", choices=["polyhaven", "ambientcg"])
    s5.add_argument("--id")
    s5.add_argument("--list")
    s5.add_argument("--yes", action="store_true", help="承認済みの合図。無しではDLしない")
    s5.add_argument("--quiet", action="store_true")
    s5.set_defaults(func=cmd_download)
    s6 = sub.add_parser("inventory", help="既存走査＋台帳再生成")
    s6.set_defaults(func=cmd_inventory)
    return p


def main(argv=None) -> int:
    p = build_parser()
    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
