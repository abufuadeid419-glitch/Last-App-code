"""Iteration 2: org profile/logo, plans, upgrades, reports, GPS, idempotency."""
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-rebuild-22.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TOK = {
    "dev": "test_token_dev",
    "owner": "test_token_owner",
    "agent": "test_token_agent",
    "acct": "test_token_acct",
    "new": "test_token_new",
}


def H(role):
    return {"Authorization": f"Bearer {TOK[role]}", "Content-Type": "application/json"}


STATE = {}


# -------- Org profile --------
class TestOrgProfile:
    def test_get_profile_default(self):
        r = requests.get(f"{API}/org/profile", headers=H("owner"))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("name", "phone", "email", "address", "tax_no", "cr_no", "invoice_footer", "has_logo"):
            assert k in d

    def test_update_profile_persists(self):
        payload = {"name": "TEST_شركة النور للتوزيع", "phone": "+964 7701234567",
                   "email": "biz@test.com", "address": "بغداد", "tax_no": "T-1",
                   "cr_no": "CR-1", "invoice_footer": "شكراً لتعاملكم"}
        r = requests.put(f"{API}/org/profile", headers=H("owner"), json=payload)
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/org/profile", headers=H("owner")).json()
        for k, v in payload.items():
            assert g[k] == v, f"{k} not persisted"

    def test_update_profile_requires_owner(self):
        r = requests.put(f"{API}/org/profile", headers=H("agent"), json={"name": "x"})
        assert r.status_code == 403

    def test_agent_can_get_profile(self):
        # Any org user can read (needed for invoice rendering)
        r = requests.get(f"{API}/org/profile", headers=H("agent"))
        assert r.status_code == 200

    def test_logo_bad_data_rejected(self):
        r = requests.post(f"{API}/org/logo", headers=H("owner"),
                          json={"data": "@@notbase64@@", "content_type": "image/png"})
        assert r.status_code == 400

    def test_get_logo_returns_data_uri_shape(self):
        # Without upload we expect data_uri=None, but endpoint must respond 200
        r = requests.get(f"{API}/org/logo", headers=H("owner"))
        assert r.status_code == 200
        assert "data_uri" in r.json()


# -------- Plans (developer managed) --------
class TestPlans:
    def test_create_plan_dev(self):
        r = requests.post(f"{API}/dev/plans", headers=H("dev"),
                          json={"name": "TEST_Pro", "price": 99.0, "currency": "USD",
                                "days": 30, "max_employees": 10, "features": ["f1"], "active": True})
        assert r.status_code == 200, r.text
        STATE["plan_id"] = r.json()["id"]

    def test_create_plan_inactive(self):
        r = requests.post(f"{API}/dev/plans", headers=H("dev"),
                          json={"name": "TEST_Hidden", "price": 1, "days": 7, "max_employees": 1, "active": False})
        assert r.status_code == 200
        STATE["hidden_plan_id"] = r.json()["id"]

    def test_owner_sees_only_active_plans(self):
        r = requests.get(f"{API}/plans", headers=H("owner"))
        assert r.status_code == 200
        plans = r.json()
        ids = {p["id"] for p in plans}
        assert STATE["plan_id"] in ids
        assert STATE["hidden_plan_id"] not in ids

    def test_dev_sees_all_plans(self):
        r = requests.get(f"{API}/plans", headers=H("dev"))
        ids = {p["id"] for p in r.json()}
        assert STATE["hidden_plan_id"] in ids

    def test_plan_crud_denied_for_non_dev(self):
        r = requests.post(f"{API}/dev/plans", headers=H("owner"),
                          json={"name": "x", "price": 0, "days": 1, "max_employees": 1})
        assert r.status_code == 403

    def test_update_plan(self):
        r = requests.put(f"{API}/dev/plans/{STATE['plan_id']}", headers=H("dev"),
                         json={"name": "TEST_Pro+", "price": 120.0, "days": 60,
                               "max_employees": 20, "active": True, "features": ["a", "b"]})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Pro+"


# -------- Payment settings --------
class TestPaymentSettings:
    def test_update_payment_dev(self):
        r = requests.put(f"{API}/dev/settings/payment", headers=H("dev"),
                         json={"payment_address": "0x123", "whatsapp": "+964700",
                               "instructions": "ارسل التحويل"})
        assert r.status_code == 200

    def test_owner_can_read_payment(self):
        r = requests.get(f"{API}/settings/payment", headers=H("owner"))
        assert r.status_code == 200
        d = r.json()
        assert d["payment_address"] == "0x123"
        assert d["whatsapp"] == "+964700"

    def test_payment_update_requires_dev(self):
        r = requests.put(f"{API}/dev/settings/payment", headers=H("owner"), json={"payment_address": "x"})
        assert r.status_code == 403


# -------- Upgrade requests --------
class TestUpgradeRequests:
    def test_owner_submits_upgrade(self):
        r = requests.post(f"{API}/upgrade-requests", headers=H("owner"),
                          json={"plan_id": STATE["plan_id"], "payment_ref": "TXN-TEST-1", "notes": "note"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "PENDING"
        STATE["req_id"] = d["id"]

    def test_single_pending_enforced(self):
        r = requests.post(f"{API}/upgrade-requests", headers=H("owner"),
                          json={"plan_id": STATE["plan_id"], "payment_ref": "TXN-2"})
        assert r.status_code == 400

    def test_owner_lists_own_requests(self):
        r = requests.get(f"{API}/upgrade-requests", headers=H("owner"))
        assert r.status_code == 200
        assert any(x["id"] == STATE["req_id"] for x in r.json())

    def test_dev_lists_all_requests(self):
        r = requests.get(f"{API}/upgrade-requests", headers=H("dev"))
        assert r.status_code == 200
        assert any(x["id"] == STATE["req_id"] for x in r.json())

    def test_agent_forbidden_from_requests(self):
        assert requests.get(f"{API}/upgrade-requests", headers=H("agent")).status_code == 403

    def test_missing_payment_ref_rejected(self):
        # finish current request first (reject), then retry empty
        requests.patch(f"{API}/dev/upgrade-requests/{STATE['req_id']}", headers=H("dev"),
                       json={"action": "reject"})
        r = requests.post(f"{API}/upgrade-requests", headers=H("owner"),
                         json={"plan_id": STATE["plan_id"], "payment_ref": ""})
        assert r.status_code == 400

    def test_approve_extends_org(self):
        # fetch current expiry
        orgs = requests.get(f"{API}/dev/orgs", headers=H("dev")).json()
        org_before = next(o for o in orgs if o["id"] == "org_test_1")
        # new request
        r = requests.post(f"{API}/upgrade-requests", headers=H("owner"),
                         json={"plan_id": STATE["plan_id"], "payment_ref": "TXN-OK"})
        assert r.status_code == 200
        rid = r.json()["id"]
        r = requests.patch(f"{API}/dev/upgrade-requests/{rid}", headers=H("dev"),
                          json={"action": "approve", "note": "ok"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "APPROVED"
        orgs = requests.get(f"{API}/dev/orgs", headers=H("dev")).json()
        org_after = next(o for o in orgs if o["id"] == "org_test_1")
        assert org_after["expires_at"] > org_before["expires_at"]
        assert org_after.get("plan_name") == "TEST_Pro+"
        assert org_after["max_employees"] == 20


# -------- Reports --------
class TestReports:
    def test_reports_day_owner(self):
        r = requests.get(f"{API}/stats/reports?period=day", headers=H("owner"))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["period"] == "day"
        assert len(d["rows"]) == 7
        assert d["totals"]["profit"] is not None

    def test_reports_week(self):
        r = requests.get(f"{API}/stats/reports?period=week", headers=H("owner"))
        assert r.status_code == 200
        assert len(r.json()["rows"]) == 8

    def test_reports_month(self):
        r = requests.get(f"{API}/stats/reports?period=month", headers=H("owner"))
        assert r.status_code == 200
        assert len(r.json()["rows"]) == 6

    def test_reports_bad_period(self):
        r = requests.get(f"{API}/stats/reports?period=year", headers=H("owner"))
        assert r.status_code == 400

    def test_reports_accountant_no_profit(self):
        r = requests.get(f"{API}/stats/reports?period=day", headers=H("acct"))
        assert r.status_code == 200
        d = r.json()
        assert d["totals"]["profit"] is None
        for row in d["rows"]:
            assert row["profit"] is None

    def test_reports_agent_forbidden(self):
        r = requests.get(f"{API}/stats/reports?period=day", headers=H("agent"))
        assert r.status_code == 403


# -------- GPS --------
class TestTracking:
    def test_agent_posts_location(self):
        r = requests.post(f"{API}/locations", headers=H("agent"),
                          json={"lat": 33.3152, "lng": 44.3661, "accuracy": 10.0})
        assert r.status_code == 200

    def test_non_agent_cannot_post_location(self):
        r = requests.post(f"{API}/locations", headers=H("owner"),
                          json={"lat": 1.0, "lng": 1.0})
        assert r.status_code == 403

    def test_owner_lists_agents_locations(self):
        r = requests.get(f"{API}/tracking/agents", headers=H("owner"))
        assert r.status_code == 200
        d = r.json()
        agent = next((a for a in d if a["user_id"] == "user_test_agent"), None)
        assert agent is not None
        assert agent["last_location"] is not None
        assert agent["last_location"]["lat"] == 33.3152

    def test_accountant_lists_tracking(self):
        r = requests.get(f"{API}/tracking/agents", headers=H("acct"))
        assert r.status_code == 200

    def test_agent_cannot_list_tracking(self):
        r = requests.get(f"{API}/tracking/agents", headers=H("agent"))
        assert r.status_code == 403


# -------- Idempotency --------
class TestIdempotency:
    def _setup(self):
        # Need an agent with inventory for a product + a customer
        prods = requests.get(f"{API}/products", headers=H("owner")).json()
        pid = next((p["id"] for p in prods if p["stock"] >= 0 and p["sale_price"] > 0), None)
        if not pid:
            r = requests.post(f"{API}/products", headers=H("owner"),
                             json={"name": "TEST_IDEM_P", "cost_price": 2, "sale_price": 10, "stock": 0, "min_stock": 0})
            pid = r.json()["id"]
            requests.post(f"{API}/purchases", headers=H("owner"),
                         json={"product_id": pid, "quantity": 50, "unit_cost": 2})
        # ensure agent inventory
        requests.post(f"{API}/deliveries", headers=H("owner"),
                     json={"distributor_id": "user_test_agent", "items": [{"product_id": pid, "quantity": 20}]})
        STATE["idem_pid"] = pid
        # customer
        r = requests.post(f"{API}/customers", headers=H("owner"),
                         json={"name": "TEST_IDEM_CUST"})
        STATE["idem_cid"] = r.json()["id"]

    def test_customer_idempotent_create(self):
        cid = "test-idem-cust-fixed-id"
        payload = {"id": cid, "name": "TEST_IDEM_FIXED", "phone": "123"}
        r1 = requests.post(f"{API}/customers", headers=H("owner"), json=payload)
        assert r1.status_code == 200
        assert r1.json()["id"] == cid
        r2 = requests.post(f"{API}/customers", headers=H("owner"), json=payload)
        assert r2.status_code == 200
        assert r2.json()["id"] == cid
        STATE["idem_fixed_cid"] = cid

    def test_sale_idempotent_no_double_apply(self):
        self._setup()
        pid = STATE["idem_pid"]
        cid = STATE["idem_cid"]
        sale_id = "sale-idem-fixed-1"
        # inventory before
        inv_before = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json() if i["product_id"] == pid)["quantity"]
        payload = {"id": sale_id, "customer_id": cid, "lat": 10.0, "lng": 20.0,
                   "client_created_at": "2026-01-15T10:00:00+00:00",
                   "items": [{"product_id": pid, "quantity": 3, "price": 10}], "paid_amount": 10}
        r1 = requests.post(f"{API}/sales", headers=H("agent"), json=payload)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["id"] == sale_id
        # stored geo fields
        assert d1.get("lat") == 10.0 and d1.get("lng") == 20.0
        assert d1.get("client_created_at") == "2026-01-15T10:00:00+00:00"
        r2 = requests.post(f"{API}/sales", headers=H("agent"), json=payload)
        assert r2.status_code == 200
        assert r2.json()["invoice_no"] == d1["invoice_no"]
        inv_after = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json() if i["product_id"] == pid)["quantity"]
        # Only one deduction of 3 units
        assert inv_before - inv_after == 3, f"double-apply detected: before={inv_before} after={inv_after}"

    def test_collection_idempotent(self):
        cid = STATE["idem_cid"]
        # ensure a balance
        cust = next(c for c in requests.get(f"{API}/customers", headers=H("owner")).json() if c["id"] == cid)
        if cust["balance"] <= 0:
            pytest.skip("no balance on customer")
        bal_before = cust["balance"]
        col_id = "col-idem-fixed-1"
        payload = {"id": col_id, "customer_id": cid, "amount": 5}
        r1 = requests.post(f"{API}/collections", headers=H("agent"), json=payload)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/collections", headers=H("agent"), json=payload)
        assert r2.status_code == 200
        assert r1.json()["receipt_no"] == r2.json()["receipt_no"]
        cust_after = next(c for c in requests.get(f"{API}/customers", headers=H("owner")).json() if c["id"] == cid)
        assert abs((bal_before - cust_after["balance"]) - 5) < 0.01, "double-apply detected in collection"

    def test_sales_return_idempotent(self):
        pid = STATE["idem_pid"]
        cid = STATE["idem_cid"]
        ret_id = "ret-idem-fixed-1"
        payload = {"id": ret_id, "customer_id": cid,
                   "items": [{"product_id": pid, "quantity": 1, "price": 10}], "reason": "x"}
        r1 = requests.post(f"{API}/sales-returns", headers=H("agent"), json=payload)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/sales-returns", headers=H("agent"), json=payload)
        assert r2.status_code == 200
        assert r1.json()["return_no"] == r2.json()["return_no"]


# -------- Upgrade from expired org --------
class TestUpgradeFromExpired:
    def test_owner_can_request_upgrade_while_suspended(self):
        # Suspend org, owner /products is 403 but /upgrade-requests should still work
        requests.patch(f"{API}/dev/orgs/org_test_1", headers=H("dev"), json={"status": "SUSPENDED"})
        try:
            assert requests.get(f"{API}/products", headers=H("owner")).status_code == 403
            # Clear any pending request
            reqs = requests.get(f"{API}/upgrade-requests", headers=H("owner")).json()
            for q in reqs:
                if q["status"] == "PENDING":
                    requests.patch(f"{API}/dev/upgrade-requests/{q['id']}", headers=H("dev"),
                                   json={"action": "reject"})
            r = requests.post(f"{API}/upgrade-requests", headers=H("owner"),
                             json={"plan_id": STATE["plan_id"], "payment_ref": "FROM-EXPIRED"})
            assert r.status_code == 200, r.text
        finally:
            requests.patch(f"{API}/dev/orgs/org_test_1", headers=H("dev"), json={"status": "ACTIVE"})


# -------- Cleanup --------
def test_zz_cleanup():
    for pid_key in ("plan_id", "hidden_plan_id"):
        if STATE.get(pid_key):
            requests.delete(f"{API}/dev/plans/{STATE[pid_key]}", headers=H("dev"))
