from scripts.asset_manager import polyhaven as ph


def _raises_value(fn, *args):
    try:
        fn(*args)
    except ValueError:
        return True
    raise AssertionError("ValueErrorが発生しませんでした")


def test_flatten_and_pick():
    sample = {"Color": {"4k": {"png": {"url": "https://dl.polyhaven.org/x.png", "size": 10, "md5": "a"}}}}
    entries = ph.flatten_files(sample)
    assert entries[0]["map"] == "Color" and entries[0]["resolution"] == "4k"
    picked = ph.pick_4k(entries)
    assert picked and picked[0]["resolution"].lower() == "4k"


def test_slug_validation():
    _raises_value(ph.get_files_url, "../x")


def test_pick_empty_when_no_4k():
    sample = {"Color": {"1k": {"jpg": {"url": "https://dl.polyhaven.org/x.jpg", "size": 5}}}}
    entries = ph.flatten_files(sample)
    assert ph.pick_4k(entries) == []
