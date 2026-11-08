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
    saved = d.extract_bytes(buf.getvalue(), tmp_path)
    assert saved == ["a/b.txt"]
    assert (tmp_path / "a" / "b.txt").read_text() == "hello"
