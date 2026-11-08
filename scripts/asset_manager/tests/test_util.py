from scripts.asset_manager import util as u


def _raises(fn, *args):
    try:
        fn(*args)
    except ValueError:
        return True
    raise AssertionError(f"ValueErrorが発生しませんでした: {fn} {args}")


def test_slug_ok():
    u.assert_slug("brown_planks_03")
    u.assert_asset_id("Grass005")


def test_slug_bad():
    _raises(u.assert_slug, "../evil")


def test_zip_traversal_blocked():
    _raises(u.assert_safe_zip_name, "../../evil.sh")
    assert u.assert_safe_zip_name("a/b.png") == "a/b.png"
    assert u.assert_safe_zip_name("d/") == ""


def test_allowed_url():
    u.assert_allowed_url("https://dl.polyhaven.org/x/y.jpg")
    _raises(u.assert_allowed_url, "https://evil.example.com/x.zip")


def test_fmt_mb():
    assert u.fmt_mb(1048576) == "1.00 MB"
