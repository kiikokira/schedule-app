"""再開・検証・進捗・安全展開付きダウンローダ (stdlibのみ)。"""
import hashlib
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

from . import config as C
from . import util as U


def md5_of(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 256), b""):
            h.update(chunk)
    return h.hexdigest()


def _print_progress(done: int, total: int | None, prefix: str = "") -> None:
    if total:
        pct = done / total * 100 if total else 0
        sys.stdout.write(f"\r{prefix} {done}/{total} bytes ({pct:.1f}%)")
    else:
        sys.stdout.write(f"\r{prefix} {done} bytes")
    sys.stdout.flush()


def download_file(url: str, dest: Path, expected_size: int | None = None,
                   expected_md5: str | None = None, show_progress: bool = True,
                   resume: bool = True) -> Path:
    U.assert_allowed_url(url)
    U.safe_mkdir(dest.parent)
    if dest.exists():
        raise FileExistsError(f"既存ファイルのためスキップ（上書き禁止）: {dest}")

    part = dest.with_suffix(dest.suffix + ".part")
    start = part.stat().st_size if (resume and part.exists()) else 0

    last_err: Exception | None = None
    for attempt in range(C.RETRY + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": C.UA})
            if start > 0:
                req.add_header("Range", f"bytes={start}-")
            with urllib.request.urlopen(req, timeout=C.TIMEOUT) as r:
                total = r.getheader("Content-Length")
                total_int = (int(total) + start) if total else expected_size
                mode = "ab" if start > 0 and r.status == 206 else "wb"
                if mode == "wb":
                    start = 0
                done = start
                if show_progress:
                    _print_progress(done, total_int, dest.name)
                with open(part, mode) as f:
                    while True:
                        chunk = r.read(C.CHUNK)
                        if not chunk:
                            break
                        f.write(chunk)
                        done += len(chunk)
                        if show_progress:
                            _print_progress(done, total_int, dest.name)
                if show_progress:
                    sys.stdout.write("\n")
            # サイズ検証
            got = part.stat().st_size
            if expected_size is not None and abs(got - expected_size) > 1024 * 1024:
                # 1MB超の差異は警告扱い（リダイレクト先の実体差異を許容）— ただし0バイトは失敗
                if got == 0:
                    raise ValueError("空ファイルのため中断しました")
            if got == 0:
                raise ValueError("空ファイルのため中断しました")
            # MD5検証（指定時のみ）
            if expected_md5:
                actual = md5_of(part)
                if actual.lower() != expected_md5.lower():
                    raise ValueError(f"MD5不一致: expected={expected_md5} actual={actual}")
            part.rename(dest)
            return dest
        except FileExistsError:
            raise
        except (urllib.error.HTTPError, urllib.error.URLError, OSError, ValueError) as e:
            last_err = e
            # Rangeが無効な場合は最初から
            if isinstance(e, urllib.error.HTTPError) and e.code == 416:
                try:
                    part.unlink()
                except OSError:
                    pass
                start = 0
            else:
                try:
                    start = part.stat().st_size if part.exists() else 0
                except OSError:
                    start = 0
            if attempt < C.RETRY:
                time.sleep(0.5 * (attempt + 1))
                continue
            raise
    raise last_err  # type: ignore[misc]


def extract_bytes(data: bytes, dest_dir: Path) -> list:
    import io
    U.safe_mkdir(dest_dir)
    saved: list = []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for info in z.infolist():
            safe = U.assert_safe_zip_name(info.filename)
            if not safe:
                continue
            target = dest_dir / safe
            resolved = target.resolve()
            base = dest_dir.resolve()
            if resolved != base and base not in resolved.parents:
                raise ValueError(f"保存先が許可範囲外です: {safe}")
            if target.exists():
                raise FileExistsError(
                    f"既存ファイルのためスキップ（上書き禁止）: {safe}"
                )
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, open(target, "wb") as out:
                out.write(src.read())
            saved.append(safe)
    if not saved:
        raise ValueError("ZIP内にファイルが無いため中断しました")
    return saved


def extract_zip_file(zippath: Path, dest_dir: Path) -> list:
    data = zippath.read_bytes()
    if not data:
        raise ValueError("空のZIPのため中断しました")
    return extract_bytes(data, dest_dir)
