import io
import zipfile

from scripts.asset_manager import downloader as d


def _raises_value(fn, *args):
    try:
        fn(*args)
    except ValueError:
        return True
    raise AssertionError("ValueErrorが発生しませんでした")


def test_zip_slip_blocked(tmp_path):
    buf = io.BytesIO()
    z = zipfile.ZipFile(buf, "w")
    z.writestr("../../evil.txt", "x")
    z.close()
    assert _raises_value(d.extract_bytes, buf.getvalue(), tmp_path)


def test_md5(tmp_path):
    p = tmp_path / "a.bin"
    p.write_bytes(b"abc")
    assert len(d.md5_of(p)) == 32


def test_extract_ok(tmp_path):
    buf = io.BytesIO()
    z = zipfile.ZipFile(buf, "w")
    z.writestr("a/b.txt", "hello")
    z.close()
    saved, skipped = d.extract_bytes(buf.getvalue(), tmp_path)
    assert saved == ["a/b.txt"] and skipped == []
    assert (tmp_path / "a" / "b.txt").read_text() == "hello"


def test_extract_skips_existing(tmp_path):
    (tmp_path / "keep.txt").write_text("old")
    buf = io.BytesIO()
    z = zipfile.ZipFile(buf, "w")
    z.writestr("keep.txt", "new")
    z.writestr("fresh.txt", "hi")
    z.close()
    saved, skipped = d.extract_bytes(buf.getvalue(), tmp_path)
    assert saved == ["fresh.txt"] and skipped == ["keep.txt"]
    assert (tmp_path / "keep.txt").read_text() == "old"
