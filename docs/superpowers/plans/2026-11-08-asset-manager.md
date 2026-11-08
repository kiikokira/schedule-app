# Asset Manager (Poly Haven / ambientCG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OpenCodeからPoly HavenとambientCGの4K素材を検索・確認・安全ダウンロード・台帳管理できるPythonシステムを構築する。

**Architecture:** `scripts/asset_manager/`に標準ライブラリのみのPythonパッケージを新設し、既存TSツール（`.opencode/tools/polyhaven.ts, ambientcg.ts`）のAPI仕様・安全規則を移植する。保存先は`artifacts/`拡張を維持し、台帳は`artifacts/asset_inventory.json`+CSVに集約する。

**Tech Stack:** Python 3.10+ stdlib only (urllib, hashlib, zipfile, json, csv, pathlib, argparse), 公式API: `https://api.polyhaven.com`, `https://ambientcg.com/api/v3`

**Spec:** 本チャット承認済みC案（2026-11-08）。要求原文：岩/草地/森林/道/木材/HDRIの4K優先取得、ZIP展開、重複防止、チェックサム、Blender利用可、ワールド制作・RPG変更なし。

## Global Constraints

- 既存素材の削除・上書き禁止（`artifacts/`配下の既存ファイルは一切変更しない）。
- 公式API・公式ドメインのみ利用（許可外ダウンロードサイト禁止、ID推測DL禁止）。
- 同一素材の重複ダウンロード禁止（既存検出でスキップ）。
- ログイン・APIキー要求禁止、固有User-Agent必須。
- 出典表示必須（Poly Haven: Powered by Poly Haven / ambientCG: CC0クレジット）。
- `main`へのプッシュは許可制、プッシュ前に`npm run build`成功必須。
- ゲーム本体への自動配置なし、Blender作業は手動確認。

---

### Task 1: config基盤

**Files:**
- Create: `scripts/asset_manager/__init__.py`
- Create: `scripts/asset_manager/config.py`
- Test: `scripts/asset_manager/tests/test_config.py`

**Interfaces:**
- Consumes: なし
- Produces: `config.API_POLYHAVEN, API_AMBIENTCG_V3, UA, ALLOWED_DOWNLOAD_HOSTS, SAVE_ROOT_POLYHAVEN, SAVE_ROOT_AMBIENTCG, DEFAULT_RESOLUTION="4K", TIMEOUT, RETRY`（後続Taskがimport）

- [ ] **Step 1: Write the failing test**

```python
# scripts/asset_manager/tests/test_config.py
from scripts.asset_manager import config as c
def test_defaults():
    assert c.DEFAULT_RESOLUTION == "4K"
    assert "api.polyhaven.com" in c.API_POLYHAVEN
    assert "ambientcg.com/api/v3" in c.API_AMBIENTCG_V3
    assert "schedule-app-assetmanager" in c.UA
    assert "dl.polyhaven.org" in c.ALLOWED_DOWNLOAD_HOSTS
def test_save_roots():
    assert c.SAVE_ROOT_POLYHAVEN == "artifacts/polyhaven"
    assert c.SAVE_ROOT_AMBIENTCG == "artifacts/ambientcg"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest scripts/asset_manager/tests/test_config.py -v`
Expected: FAIL with "No module named 'scripts.asset_manager'"

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/asset_manager/__init__.py
"""Poly Haven / ambientCG 4K asset manager (stdlib only)."""
__version__ = "0.1.0"
```

```python
# scripts/asset_manager/config.py
API_POLYHAVEN = "https://api.polyhaven.com"
API_AMBIENTCG_V3 = "https://ambientcg.com/api/v3"
UA = "schedule-app-assetmanager/0.1.0 (+https://kiikokira.github.io/schedule-app/)"
ALLOWED_DOWNLOAD_HOSTS = frozenset([
    "dl.polyhaven.org", "api.polyhaven.com", "cdn.polyhaven.com", "polyhaven.com",
    "ambientcg.com", "www.ambientcg.com",
    "acg-media.struffelproductions.com", "f003.backblazeb2.com",
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
CREDIT_AMBIENTCG = "Created using assets from ambientCG.com, licensed under the Creative Commons CC0 1.0 Universal License."
LICENSE_POLYHAVEN = "https://polyhaven.com/license"
LICENSE_AMBIENTCG = "https://ambientcg.com/license"
def is_allowed_host(host: str) -> bool:
    if host in ALLOWED_DOWNLOAD_HOSTS:
        return True
    return host.endswith(ALLOWED_CDN_SUFFIXES)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest scripts/asset_manager/tests/test_config.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add scripts/asset_manager/__init__.py scripts/asset_manager/config.py scripts/asset_manager/tests/test_config.py
git commit -m "feat: add asset_manager config baseline"
```

### Task 2: 共通HTTP・安全ユーティリティ

**Files:**
- Create: `scripts/asset_manager/util.py`
- Test: `scripts/asset_manager/tests/test_util.py`

**Interfaces:**
- Consumes: `config.UA, TIMEOUT, RETRY, is_allowed_host`
- Produces: `fetch_json(url)->dict`, `assert_slug(s)`, `assert_asset_id(s)`, `assert_safe_zip_name(n)->str`, `assert_allowed_url(u)->str`, `fmt_mb(b)->str`, `safe_mkdir(p)`, `file_exists(p)->bool`

- [ ] **Step 1: Write the failing test**

```python
# scripts/asset_manager/tests/test_util.py
import pytest
from scripts.asset_manager import util as u
def test_slug_ok():
    u.assert_slug("brown_planks_03")
    u.assert_asset_id("Grass005")
def test_slug_bad():
    with pytest.raises(ValueError):
        u.assert_slug("../evil")
def test_zip_traversal_blocked():
    with pytest.raises(ValueError):
        u.assert_safe_zip_name("../../evil.sh")
    assert u.assert_safe_zip_name("a/b.png") == "a/b.png"
    assert u.assert_safe_zip_name("d/") == ""
def test_allowed_url():
    u.assert_allowed_url("https://dl.polyhaven.org/x/y.jpg")
    with pytest.raises(ValueError):
        u.assert_allowed_url("https://evil.example.com/x.zip")
def test_fmt_mb():
    assert u.fmt_mb(1048576) == "1.00 MB"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest scripts/asset_manager/tests/test_util.py -v`
Expected: FAIL with "No module named" / "has no attribute"

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/asset_manager/util.py (抜粋・完全版を実装)
import json, time, urllib.request, urllib.error
from pathlib import Path
from . import config as C
def _req(url: str) -> urllib.request.Request:
    return urllib.request.Request(url, headers={"User-Agent": C.UA, "Accept": "application/json"})
def fetch_json(url: str, attempt: int = 0):
    try:
        with urllib.request.urlopen(_req(url), timeout=C.TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code in (429, 500, 502, 503, 504) and attempt < C.RETRY:
            time.sleep(0.5 * (attempt + 1))
            return fetch_json(url, attempt + 1)
        raise
import re
_SLUG = re.compile(r"^[a-z0-9_]+$")
_ASSET = re.compile(r"^[A-Za-z0-9_-]+$")
def assert_slug(s: str):
    if not _SLUG.match(s or ""): raise ValueError(f"不正なslugです: {s}")
def assert_asset_id(s: str):
    if not _ASSET.match(s or ""): raise ValueError(f"不正なassetIdです: {s}")
def assert_safe_zip_name(n: str) -> str:
    if not n or n.endswith("/"): return ""
    norm = n.replace("\\", "/")
    if norm.startswith("/") or ".." in norm.split("/") or "\0" in norm: raise ValueError(f"パストラバーサルを検出: {n}")
    if len(norm) > 2 and norm[1] == ":": raise ValueError(f"不正なファイル名: {n}")
    return norm
from urllib.parse import urlparse
def assert_allowed_url(u: str) -> str:
    p = urlparse(u)
    if p.scheme != "https": raise ValueError(f"httpsのみ許可: {u}")
    if not C.is_allowed_host(p.hostname or ""): raise ValueError(f"許可外ドメイン: {p.hostname}")
    return u
def fmt_mb(b: int) -> str: return f"{b/1048576:.2f} MB"
def safe_mkdir(p: Path): p.mkdir(parents=True, exist_ok=True)
def file_exists(p: Path) -> bool: return p.exists()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest scripts/asset_manager/tests/test_util.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/asset_manager/util.py scripts/asset_manager/tests/test_util.py
git commit -m "feat: add asset_manager http and safety utils"
```

### Task 3: Poly Haven APIクライアント

**Files:**
- Create: `scripts/asset_manager/polyhaven.py`
- Test: `scripts/asset_manager/tests/test_polyhaven.py`

**Interfaces:**
- Consumes: `config.API_POLYHAVEN`, `util.fetch_json/assert_slug`
- Produces: `search(query, atype="all", limit=10)->list[dict]`, `get_info(slug)->dict`, `get_files(slug)->list[dict]{map,resolution,format,size,url,md5}`, `pick_4k(entries, prefer="png")->list[dict]`

- [ ] **Step 1: Write the failing test**

```python
def test_flatten_and_pick():
    from scripts.asset_manager import polyhaven as ph
    sample = {"Color": {"4k": {"png": {"url": "https://dl.polyhaven.org/x.png", "size": 10, "md5": "a"}}}}
    entries = ph.flatten_files(sample)
    assert entries[0]["map"] == "Color" and entries[0]["resolution"] == "4k"
    picked = ph.pick_4k(entries)
    assert picked and picked[0]["resolution"].lower() == "4k"
def test_slug_validation():
    from scripts.asset_manager import polyhaven as ph
    import pytest
    with pytest.raises(ValueError):
        ph.get_files_url("../x")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest scripts/asset_manager/tests/test_polyhaven.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/asset_manager/polyhaven.py（要点）
from urllib.parse import quote, urlencode
from . import config as C, util as U
JP = {"レンガ":"brick","木材":"wood","木":"wood","草原":"grass","草":"grass","岩":"rock","石":"stone","砂":"sand","雪":"snow","壁":"wall","床":"floor","森":"forest"}
def _t(q):
    out={q}
    for jp,en in JP.items():
        if jp in q: out.add(q.replace(jp,en)); out.add(en)
    return list(out)[:3]
def search_url(q, atype="all"):
    p={"q":q}
    if atype!="all": p["t"]=atype
    return f"{C.API_POLYHAVEN}/search?{urlencode(p)}"
def get_info_url(slug): U.assert_slug(slug); return f"{C.API_POLYHAVEN}/info/{slug}"
def get_files_url(slug): U.assert_slug(slug); return f"{C.API_POLYHAVEN}/files/{slug}"
def search(query, atype="all", limit=10): ...
def get_info(slug): U.assert_slug(slug); return U.fetch_json(get_info_url(slug))
def flatten_files(files_json: dict) -> list: ...  # map/resolution/format/size/url/md5 + include関連をrelated化
def get_files(slug): return flatten_files(U.fetch_json(get_files_url(slug)))
def pick_4k(entries, prefer="png") -> list:
    # 4K完全一致→2K→1Kの順でフォールバック、同一map+resolutionに絞る。4K欠品時は[]+呼び出し側で記録
    ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest scripts/asset_manager/tests/test_polyhaven.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/asset_manager/polyhaven.py scripts/asset_manager/tests/test_polyhaven.py
git commit -m "feat: add polyhaven api client with 4k pick"
```

### Task 4: ambientCG API v3クライアント

**Files:**
- Create: `scripts/asset_manager/ambientcg.py`
- Test: `scripts/asset_manager/tests/test_ambientcg.py`

**Interfaces:**
- Consumes: `config.API_AMBIENTCG_V3`, `util.fetch_json/assert_asset_id`
- Produces: `search(query, atype="all", limit=10)->list[dict]`, `get_asset(asset_id)->dict`, `list_downloads(asset)->list[dict]`, `pick_4k(downloads)->dict|None`

- [ ] **Step 1: Write the failing test**

```python
def test_pick_4k_and_parse():
    from scripts.asset_manager import ambientcg as ac
    dls=[{"attributes":"1K-JPG","extension":"zip","url":"https://ambientcg.com/a","size":10},{"attributes":"4K-JPG","extension":"zip","url":"https://ambientcg.com/b","size":20}]
    assert ac.pick_4k(dls)["attributes"]=="4K-JPG"
    assert ac.parse_attributes("4K-JPG")==("4K","JPG")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest scripts/asset_manager/tests/test_ambientcg.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```python
# scripts/asset_manager/ambientcg.py（要点）
from urllib.parse import urlencode
from . import config as C, util as U
INCLUDE="title,type,tags,downloads,maps,url,thumbnails,previews"
def search(query, atype="all", limit=10): ...  # assets?q=&limit=&sort=popular&include=
def get_asset(asset_id): U.assert_asset_id(asset_id); return U.fetch_json(f"{C.API_AMBIENTCG_V3}/assets?id={asset_id}&include={INCLUDE}")["assets"][0]
def list_downloads(asset): return [d for d in asset.get("downloads",[]) if d.get("url")]
def parse_attributes(attr): ...  # "4K-JPG" -> ("4K","JPG")
def pick_4k(downloads): ...  # 4K含有を優先、無ければNone（呼び出し側で記録・DLしない）
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest scripts/asset_manager/tests/test_ambientcg.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/asset_manager/ambientcg.py scripts/asset_manager/tests/test_ambientcg.py
git commit -m "feat: add ambientcg v3 client with 4k pick"
```

### Task 5: ダウンローダ（再開・検証・展開・進捗）

**Files:**
- Create: `scripts/asset_manager/downloader.py`
- Test: `scripts/asset_manager/tests/test_downloader.py`

**Interfaces:**
- Consumes: `config.CHUNK/RETRY/TIMEOUT`, `util.assert_allowed_url/assert_safe_zip_name/safe_mkdir`
- Produces: `download_file(url, dest:Path, expected_size:int|None, expected_md5:str|None, show_progress=True)->Path`, `extract_zip(buf_or_path, dest_dir:Path)->list[str]`, `md5_of(path)->str`

- [ ] **Step 1: Write the failing test**

```python
import zipfile
def test_zip_slip_blocked(tmp_path):
    from scripts.asset_manager import downloader as d
    import pytest, io
    buf=io.BytesIO(); z=zipfile.ZipFile(buf,"w"); z.writestr("../../evil.txt","x"); z.close()
    with pytest.raises(ValueError):
        d.extract_bytes(buf.getvalue(), tmp_path)
def test_md5(tmp_path):
    from scripts.asset_manager import downloader as d
    p=tmp_path/"a.bin"; p.write_bytes(b"abc")
    assert len(d.md5_of(p))==32
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest scripts/asset_manager/tests/test_downloader.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```python
# downloader.py要点: urllibでRange再開(.part)、Content-Length突合、MD5突合、tqdm無し自前進捗表示、zipfile安全展開
def download_file(url, dest, expected_size=None, expected_md5=None, show_progress=True): ...
def extract_bytes(data: bytes, dest_dir): ...  # Zip Slip検査必須
def extract_zip_file(zippath, dest_dir): ...
def md5_of(path): ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest scripts/asset_manager/tests/test_downloader.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/asset_manager/downloader.py scripts/asset_manager/tests/test_downloader.py
git commit -m "feat: add resumable verified downloader with safe unzip"
```

### Task 6: 台帳＋CLI（dry-run/承認ゲート）

**Files:**
- Create: `scripts/asset_manager/inventory.py`
- Create: `scripts/asset_manager/cli.py`
- Test: `scripts/asset_manager/tests/test_inventory.py`

**Interfaces:**
- Consumes: 全Taskの関数
- Produces: CLI `python -m scripts.asset_manager.cli search|info|files|dry-run|download|inventory [--resolution 4K]`, `artifacts/asset_inventory.json` + `.csv`

- [ ] **Step 1: Write the failing test**

```python
def test_inventory_scan(tmp_path):
    from scripts.asset_manager import inventory as inv
    m=tmp_path/"artifacts/polyhaven/x"; m.mkdir(parents=True); (m/"manifest.json").write_text('{"id":"x"}',encoding="utf-8")
    rows=inv.scan_existing(tmp_path)
    assert any(r["id"]=="x" for r in rows)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest scripts/asset_manager/tests/test_inventory.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```python
# inventory.py: scan_existing(project_root)->list, upsert(entry), save_json+csv
# cli.py: argparseで6サブコマンド、dry-runはDLせず一覧+合計MB+保存先表示、downloadは既存スキップ・4K欠品記録・承認済みのみ実行
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest scripts/asset_manager/tests/ -v`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add scripts/asset_manager/inventory.py scripts/asset_manager/cli.py scripts/asset_manager/tests/test_inventory.py
git commit -m "feat: add inventory and cli with dry-run gate"
```

### Task 7: 既存資産の4K可否確認レポート＋代表候補提示（非DL）

**Files:**
- Modify: なし（実行のみ、結果をチャット報告）
- Test: `python -m scripts.asset_manager.cli files --source polyhaven --id brown_planks_03` 等が4K有無を表示すること

- [ ] **Step 1: 既存4件のfiles確認**

Run: `python -m scripts.asset_manager.cli files --source polyhaven --id brown_planks_03` / `python -m scripts.asset_manager.cli files --source ambientcg --id Grass005`（他Rock030/035、Ground093C、Snow011も同様）
Expected: 4K有無・形式・容量が出力される、DLは行わない

- [ ] **Step 2: カテゴリ代表候補のsearch**

Run: `python -m scripts.asset_manager.cli search --source both --query rock --limit 5` 等（岩/草地/森林/道/木材/HDRI）
Expected: ID・名称・種別・ライセンスが表示される、推測IDなし

- [ ] **Step 3: dry-runで容量提示**

Run: `python -m scripts.asset_manager.cli dry-run --list candidates.txt --resolution 4K`
Expected: 対象・合計MB・保存先一覧のみ表示、DLなし。結果をユーザーに提示し承認を得る

- [ ] **Step 4: Commit（台帳のみ更新時）**

```bash
git add artifacts/asset_inventory.json
git commit -m "chore: update asset inventory (4k check, no downloads)"
```

### Task 8: 検証・ビルド・コミット

- [ ] **Step 1: 全テスト実行**

Run: `python -m pytest scripts/asset_manager/tests/ -v`
Expected: PASS

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功（本作業はscriptsのみ変更のため影響なしのはず）

- [ ] **Step 3: 対象のみコミット**

```bash
git status --short
git add scripts/asset_manager docs/superpowers/plans/2026-11-08-asset-manager.md
git commit -m "feat: add polyhaven/ambientcg 4k asset manager"
```
プッシュはユーザー許可後に `main` へ（許可なしにpushしない）。
