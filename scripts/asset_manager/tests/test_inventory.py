from scripts.asset_manager import inventory as inv


def test_inventory_scan(tmp_path):
    m = tmp_path / "artifacts" / "polyhaven" / "x"
    m.mkdir(parents=True)
    (m / "manifest.json").write_text('{"id":"x"}', encoding="utf-8")
    rows = inv.scan_existing(tmp_path)
    assert any(r["id"] == "x" for r in rows)


def test_upsert_replaces():
    rows = [{"source": "polyhaven", "id": "a", "bytes": 1}]
    out = inv.upsert(rows, {"source": "polyhaven", "id": "a", "bytes": 2})
    assert len(out) == 1 and out[0]["bytes"] == 2
