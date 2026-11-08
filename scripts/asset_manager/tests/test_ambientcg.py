from scripts.asset_manager import ambientcg as ac


def test_pick_4k_and_parse():
    dls = [
        {"attributes": "1K-JPG", "extension": "zip", "url": "https://ambientcg.com/a", "size": 10},
        {"attributes": "4K-JPG", "extension": "zip", "url": "https://ambientcg.com/b", "size": 20},
    ]
    assert ac.pick_4k(dls)["attributes"] == "4K-JPG"
    assert ac.parse_attributes("4K-JPG") == ("4K", "JPG")


def test_pick_none_when_no_4k():
    dls = [{"attributes": "1K-JPG", "extension": "zip", "url": "https://ambientcg.com/a", "size": 10}]
    assert ac.pick_4k(dls) is None
