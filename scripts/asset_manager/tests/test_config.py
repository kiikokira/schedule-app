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
