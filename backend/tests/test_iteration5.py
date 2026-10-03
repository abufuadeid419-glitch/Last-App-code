"""Iteration 5 backend tests.

Covers GET /api/stats/leaderboard?month=YYYY-MM:
  - OWNER and ACCOUNTANT allowed, FIELD_AGENT (and no-org) get 403.
  - Default is the current month when no param given.
  - Invalid month string returns 400.
  - Agents sorted by sales_total desc; each row carries rank, sales_total,
    sales_count, customers_count, collections_total, returns_total.
  - Voided sales are excluded from the leaderboard.
  - A month with no activity returns zeros for every agent.
"""
import os
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                          "https://mobile-rebuild-22.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TOK = {"dev": "test_token_dev", "owner": "test_token_owner",
       "agent": "test_token_agent", "acct": "test_token_acct", "new": "test_token_new"}


def H(r):
    return {"Authorization": f"Bearer {TOK[r]}", "Content-Type": "application/json"}


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


S = {}


# ---------- Access control ----------
class TestA_LeaderboardAccess:
    def test_owner_can_fetch(self):
        r = requests.get(f"{API}/stats/leaderboard", headers=H("owner"))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "month" in d and "agents" in d
        assert isinstance(d["agents"], list)

    def test_accountant_can_fetch(self):
        r = requests.get(f"{API}/stats/leaderboard", headers=H("acct"))
        assert r.status_code == 200, r.text

    def test_agent_forbidden(self):
        r = requests.get(f"{API}/stats/leaderboard", headers=H("agent"))
        assert r.status_code == 403

    def test_new_user_forbidden(self):
        # user with no role/org cannot hit STAFF-gated endpoints
        r = requests.get(f"{API}/stats/leaderboard", headers=H("new"))
        assert r.status_code == 403

    def test_bad_token_401(self):
        r = requests.get(f"{API}/stats/leaderboard",
                         headers={"Authorization": "Bearer invalid"})
        assert r.status_code == 401


# ---------- Default month + shape ----------
class TestB_LeaderboardShape:
    def test_default_month_is_current(self):
        r = requests.get(f"{API}/stats/leaderboard", headers=H("owner"))
        assert r.status_code == 200
        assert r.json()["month"] == _current_month()

    def test_explicit_current_month(self):
        m = _current_month()
        r = requests.get(f"{API}/stats/leaderboard?month={m}", headers=H("owner"))
        assert r.status_code == 200
        d = r.json()
        assert d["month"] == m

    def test_row_fields_present(self):
        r = requests.get(f"{API}/stats/leaderboard", headers=H("owner"))
        agents = r.json()["agents"]
        assert len(agents) >= 1, "seed should include at least one field agent"
        required = {"user_id", "name", "email", "rank", "sales_total",
                    "sales_count", "customers_count", "collections_total",
                    "returns_total"}
        for a in agents:
            missing = required - set(a.keys())
            assert not missing, f"agent row missing fields: {missing}"

    def test_rank_is_1_based_and_sorted_by_sales(self):
        r = requests.get(f"{API}/stats/leaderboard", headers=H("owner"))
        agents = r.json()["agents"]
        assert [a["rank"] for a in agents] == list(range(1, len(agents) + 1))
        totals = [a["sales_total"] for a in agents]
        assert totals == sorted(totals, reverse=True)


# ---------- Invalid month ----------
class TestC_InvalidMonth:
    @pytest.mark.parametrize("bad", ["not-a-month", "2025-13", "abcd-01", "2025/01", "2025-1a"])
    def test_bad_month_400(self, bad):
        r = requests.get(f"{API}/stats/leaderboard?month={bad}", headers=H("owner"))
        assert r.status_code == 400, f"{bad} -> {r.status_code}: {r.text}"


# ---------- Empty month returns zeros ----------
class TestD_EmptyMonth:
    def test_old_month_returns_zeros(self):
        # Jan 2000 is guaranteed to have no activity
        r = requests.get(f"{API}/stats/leaderboard?month=2000-01", headers=H("owner"))
        assert r.status_code == 200
        d = r.json()
        assert d["month"] == "2000-01"
        for a in d["agents"]:
            assert a["sales_total"] == 0
            assert a["sales_count"] == 0
            assert a["customers_count"] == 0
            assert a["collections_total"] == 0
            assert a["returns_total"] == 0


# ---------- Voided sales excluded ----------
class TestE_VoidedExcluded:
    """Create a sale, snapshot leaderboard, void it, then confirm the agent's
    sales_total dropped by the sale's total (voided sales are excluded)."""

    def test_setup_product_and_customer(self):
        prods = requests.get(f"{API}/products", headers=H("owner")).json()
        p = next((x for x in prods if x["name"] == "TEST_IT5_P"), None)
        if not p:
            r = requests.post(f"{API}/products", headers=H("owner"),
                              json={"name": "TEST_IT5_P", "cost_price": 1,
                                    "sale_price": 20, "stock": 0, "min_stock": 1})
            assert r.status_code == 200, r.text
            p = r.json()
        S["pid"] = p["id"]
        # top-up warehouse
        requests.post(f"{API}/purchases", headers=H("owner"),
                      json={"product_id": p["id"], "quantity": 100, "unit_cost": 1})
        # deliver 20 to the agent so they have inventory
        d = requests.post(f"{API}/deliveries", headers=H("owner"),
                          json={"distributor_id": "user_test_agent",
                                "items": [{"product_id": p["id"], "quantity": 20}]})
        did = d.json()["id"]
        requests.post(f"{API}/deliveries/{did}/confirm", headers=H("agent"))
        custs = requests.get(f"{API}/customers", headers=H("owner")).json()
        c = next((x for x in custs if x["name"] == "TEST_IT5_C"), None)
        if not c:
            r = requests.post(f"{API}/customers", headers=H("agent"),
                              json={"name": "TEST_IT5_C", "phone": "9647700000555",
                                    "address": "بغداد", "lat": 33.31, "lng": 44.36})
            assert r.status_code == 200
            c = r.json()
        S["cid"] = c["id"]

    def test_void_removes_from_leaderboard(self):
        before = requests.get(f"{API}/stats/leaderboard", headers=H("owner")).json()
        a_before = next(a for a in before["agents"] if a["user_id"] == "user_test_agent")

        # Create a sale (price 20, qty 2 -> total 40)
        r = requests.post(f"{API}/sales", headers=H("agent"),
                          json={"customer_id": S["cid"],
                                "items": [{"product_id": S["pid"], "quantity": 2, "price": 20}],
                                "paid_amount": 0})
        assert r.status_code == 200, r.text
        sale = r.json()
        sid = sale["id"]
        total = sale["total"]

        mid = requests.get(f"{API}/stats/leaderboard", headers=H("owner")).json()
        a_mid = next(a for a in mid["agents"] if a["user_id"] == "user_test_agent")
        # sale was created in current month, so leaderboard should see it
        assert round(a_mid["sales_total"] - a_before["sales_total"], 2) == round(total, 2)
        assert a_mid["sales_count"] == a_before["sales_count"] + 1

        # Void it
        v = requests.post(f"{API}/sales/{sid}/void", headers=H("owner"),
                          json={"reason": "iter5 test"})
        assert v.status_code == 200, v.text

        after = requests.get(f"{API}/stats/leaderboard", headers=H("owner")).json()
        a_after = next(a for a in after["agents"] if a["user_id"] == "user_test_agent")
        # Voided sale must be excluded -> back to original totals
        assert round(a_after["sales_total"], 2) == round(a_before["sales_total"], 2)
        assert a_after["sales_count"] == a_before["sales_count"]
