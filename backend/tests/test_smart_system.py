"""Smart System backend tests - full flow across roles."""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

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


# shared state for sequencing
STATE = {}


def _reset_new_user():
    """Reset seeded 'new' user back to unactivated via Supabase SQL (asyncpg)."""
    import asyncio
    import asyncpg
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        return

    async def _do():
        conn = await asyncpg.connect(dsn)
        try:
            # user_id is inside doc, pk is a random uuid
            row = await conn.fetchrow("SELECT pk, doc FROM c_users WHERE doc->>'user_id'=$1", "user_test_new")
            if not row:
                return
            import json as _j
            doc = row["doc"] if isinstance(row["doc"], dict) else _j.loads(row["doc"])
            for k in ("role", "employee_type", "org_id"):
                doc[k] = None
            await conn.execute("UPDATE c_users SET doc=$1::jsonb WHERE pk=$2", _j.dumps(doc, ensure_ascii=False), row["pk"])
        finally:
            await conn.close()

    try:
        asyncio.run(_do())
    except Exception as e:
        print(f"[DBG reset_new_user failed] {type(e).__name__}: {e}")
        raise


# --- Auth ---
class TestAuth:
    def test_me_owner(self):
        r = requests.get(f"{API}/auth/me", headers=H("owner"))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "OWNER"
        assert d["org"] and d["org"]["status"] == "ACTIVE"

    def test_me_agent(self):
        r = requests.get(f"{API}/auth/me", headers=H("agent"))
        assert r.status_code == 200
        assert r.json()["employee_type"] == "FIELD_AGENT"

    def test_me_dev(self):
        r = requests.get(f"{API}/auth/me", headers=H("dev"))
        assert r.status_code == 200
        assert r.json()["role"] == "DEVELOPER"

    def test_me_unauthenticated(self):
        assert requests.get(f"{API}/auth/me").status_code == 401
        assert requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer bad"}).status_code == 401


# --- Developer ---
class TestDeveloper:
    def test_dev_stats(self):
        r = requests.get(f"{API}/dev/stats", headers=H("dev"))
        assert r.status_code == 200
        for k in ("orgs", "active_orgs", "trials", "licenses_ready", "users", "sales"):
            assert k in r.json()

    def test_create_and_delete_license(self):
        r = requests.post(f"{API}/dev/licenses", headers=H("dev"),
                          json={"org_name": "TEST_LIC_ORG", "days": 30, "max_employees": 5})
        assert r.status_code == 200
        lic = r.json()
        assert lic["code"].startswith("LIC-") and lic["status"] == "READY"
        STATE["lic_id"] = lic["id"]
        STATE["lic_code"] = lic["code"]
        lst = requests.get(f"{API}/dev/licenses", headers=H("dev")).json()
        assert any(x["id"] == lic["id"] for x in lst)

    def test_dev_orgs_and_patch(self):
        orgs = requests.get(f"{API}/dev/orgs", headers=H("dev")).json()
        assert any(o["id"] == "org_test_1" for o in orgs)
        # extend
        r = requests.patch(f"{API}/dev/orgs/org_test_1", headers=H("dev"), json={"extend_days": 10})
        assert r.status_code == 200
        # Non-dev forbidden
        assert requests.get(f"{API}/dev/stats", headers=H("owner")).status_code == 403

    def test_suspend_and_restore(self):
        r = requests.patch(f"{API}/dev/orgs/org_test_1", headers=H("dev"), json={"status": "SUSPENDED"})
        assert r.status_code == 200
        # owner now blocked
        assert requests.get(f"{API}/products", headers=H("owner")).status_code == 403
        r = requests.patch(f"{API}/dev/orgs/org_test_1", headers=H("dev"), json={"status": "ACTIVE"})
        assert r.status_code == 200
        assert requests.get(f"{API}/products", headers=H("owner")).status_code == 200


# --- Activation + Trial ---
class TestActivation:
    def test_activated_user_cannot_reactivate(self):
        r = requests.post(f"{API}/activate", headers=H("owner"), json={"code": "LIC-XXXX"})
        assert r.status_code == 400

    def test_activate_with_license(self):
        _reset_new_user()
        code = STATE.get("lic_code")
        assert code
        r = requests.post(f"{API}/activate", headers=H("new"), json={"code": code})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "OWNER" and d["org"]["name"] == "TEST_LIC_ORG"
        _reset_new_user()

    def test_trial_creates_org(self):
        _reset_new_user()
        r = requests.post(f"{API}/trial", headers=H("new"), json={"org_name": "TEST_TRIAL_ORG"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "OWNER" and d["org"]["plan"] == "TRIAL"
        _reset_new_user()


# --- Owner flows ---
class TestOwnerFlow:
    def test_create_product(self):
        r = requests.post(f"{API}/products", headers=H("owner"),
                          json={"name": "TEST_منتج", "unit": "علبة", "cost_price": 10, "sale_price": 15, "stock": 0, "min_stock": 5})
        assert r.status_code == 200, r.text
        STATE["pid"] = r.json()["id"]
        # verify persistence
        prods = requests.get(f"{API}/products", headers=H("owner")).json()
        assert any(p["id"] == STATE["pid"] for p in prods)

    def test_agent_can_list_but_not_create_product(self):
        assert requests.get(f"{API}/products", headers=H("agent")).status_code == 200
        r = requests.post(f"{API}/products", headers=H("agent"), json={"name": "x"})
        assert r.status_code == 403

    def test_create_purchase_increases_stock(self):
        r = requests.post(f"{API}/purchases", headers=H("owner"),
                          json={"product_id": STATE["pid"], "quantity": 100, "unit_cost": 10, "supplier": "sup"})
        assert r.status_code == 200
        assert r.json()["total"] == 1000
        prod = next(p for p in requests.get(f"{API}/products", headers=H("owner")).json() if p["id"] == STATE["pid"])
        assert prod["stock"] == 100

    def test_create_customer(self):
        r = requests.post(f"{API}/customers", headers=H("owner"),
                          json={"name": "TEST_عميل", "phone": "0100", "address": "a", "location": "l"})
        assert r.status_code == 200
        STATE["cid"] = r.json()["id"]
        assert r.json()["balance"] == 0

    def test_invite_employee_generates_emp_code(self):
        r = requests.post(f"{API}/employees/invite", headers=H("owner"),
                          json={"name": "TEST_موظف", "employee_type": "FIELD_AGENT"})
        assert r.status_code == 200
        assert r.json()["code"].startswith("EMP-")
        STATE["emp_code"] = r.json()["code"]
        STATE["emp_id"] = r.json()["id"]

    def test_employees_list(self):
        r = requests.get(f"{API}/employees", headers=H("owner"))
        assert r.status_code == 200
        d = r.json()
        assert any(e["code"] == STATE["emp_code"] for e in d["invitations"])
        # cleanup
        requests.delete(f"{API}/employees/invite/{STATE['emp_id']}", headers=H("owner"))

    def test_deliver_to_agent(self):
        r = requests.post(f"{API}/deliveries", headers=H("owner"),
                          json={"distributor_id": "user_test_agent",
                                "items": [{"product_id": STATE["pid"], "quantity": 50}], "notes": "n"})
        assert r.status_code == 200
        # warehouse stock reduced
        prod = next(p for p in requests.get(f"{API}/products", headers=H("owner")).json() if p["id"] == STATE["pid"])
        assert prod["stock"] == 50
        # NEW: delivery is PENDING until agent confirms; agent confirms to receive stock
        did = r.json()["id"]
        assert r.json().get("status") == "PENDING"
        c = requests.post(f"{API}/deliveries/{did}/confirm", headers=H("agent"))
        assert c.status_code == 200, c.text
        STATE["delivery_id"] = did

    def test_delivery_over_stock_fails(self):
        r = requests.post(f"{API}/deliveries", headers=H("owner"),
                          json={"distributor_id": "user_test_agent",
                                "items": [{"product_id": STATE["pid"], "quantity": 999999}]})
        assert r.status_code == 400


# --- Agent flows ---
class TestAgentFlow:
    def test_my_inventory(self):
        r = requests.get(f"{API}/my/inventory", headers=H("agent"))
        assert r.status_code == 200
        inv = r.json()
        item = next((i for i in inv if i["product_id"] == STATE["pid"]), None)
        assert item and item["quantity"] >= 50
        assert item["sale_price"] == 15

    def test_create_sale_credit(self):
        r = requests.post(f"{API}/sales", headers=H("agent"),
                          json={"customer_id": STATE["cid"],
                                "items": [{"product_id": STATE["pid"], "quantity": 10, "price": 15}],
                                "paid_amount": 50})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 150 and d["paid_amount"] == 50 and d["remaining"] == 100
        assert d["payment_type"] == "CREDIT"
        assert d["invoice_no"].startswith("INV-")
        STATE["sale_id"] = d["id"]
        # customer balance updated
        cust = next(c for c in requests.get(f"{API}/customers", headers=H("owner")).json() if c["id"] == STATE["cid"])
        assert abs(cust["balance"] - 100) < 0.01

    def test_sale_over_inventory_fails(self):
        r = requests.post(f"{API}/sales", headers=H("agent"),
                          json={"customer_id": STATE["cid"],
                                "items": [{"product_id": STATE["pid"], "quantity": 99999, "price": 15}]})
        assert r.status_code == 400

    def test_owner_cannot_create_sale(self):
        r = requests.post(f"{API}/sales", headers=H("owner"),
                          json={"customer_id": STATE["cid"],
                                "items": [{"product_id": STATE["pid"], "quantity": 1, "price": 1}]})
        assert r.status_code == 403

    def test_collection_valid(self):
        r = requests.post(f"{API}/collections", headers=H("agent"),
                          json={"customer_id": STATE["cid"], "amount": 40})
        assert r.status_code == 200
        assert r.json()["receipt_no"].startswith("RCV-")

    def test_collection_exceeds_balance(self):
        r = requests.post(f"{API}/collections", headers=H("agent"),
                          json={"customer_id": STATE["cid"], "amount": 999999})
        assert r.status_code == 400

    def test_sales_return(self):
        r = requests.post(f"{API}/sales-returns", headers=H("agent"),
                          json={"customer_id": STATE["cid"],
                                "items": [{"product_id": STATE["pid"], "quantity": 2, "price": 15}],
                                "reason": "تالف"})
        assert r.status_code == 200
        assert r.json()["total"] == 30 and r.json()["return_no"].startswith("RET-")

    def test_customer_statement(self):
        r = requests.get(f"{API}/customers/{STATE['cid']}/statement", headers=H("agent"))
        assert r.status_code == 200
        d = r.json()
        types = {row["type"] for row in d["rows"]}
        assert {"SALE", "COLLECTION", "RETURN"}.issubset(types)


# --- Accountant / Stats ---
class TestStats:
    def test_overview_owner(self):
        r = requests.get(f"{API}/stats/overview", headers=H("owner"))
        assert r.status_code == 200
        d = r.json()
        assert d["sales_total"] > 0
        assert d["gross_profit"] is not None  # only owner sees profit

    def test_overview_agent_scoped(self):
        r = requests.get(f"{API}/stats/overview", headers=H("agent"))
        assert r.status_code == 200
        assert r.json()["gross_profit"] is None  # agent doesn't see

    def test_overview_accountant(self):
        r = requests.get(f"{API}/stats/overview", headers=H("acct"))
        assert r.status_code == 200

    def test_stats_agents(self):
        r = requests.get(f"{API}/stats/agents", headers=H("acct"))
        assert r.status_code == 200
        assert any(a["user_id"] == "user_test_agent" for a in r.json())
        # agent forbidden
        assert requests.get(f"{API}/stats/agents", headers=H("agent")).status_code == 403


# --- Permissions sanity ---
class TestPermissions:
    def test_agent_cannot_invite(self):
        r = requests.post(f"{API}/employees/invite", headers=H("agent"),
                          json={"name": "x", "employee_type": "FIELD_AGENT"})
        assert r.status_code == 403

    def test_accountant_cannot_create_product(self):
        r = requests.post(f"{API}/products", headers=H("acct"), json={"name": "x"})
        assert r.status_code == 403

    def test_accountant_can_list_sales_and_collect(self):
        assert requests.get(f"{API}/sales", headers=H("acct")).status_code == 200
        # accountant can collect
        r = requests.post(f"{API}/collections", headers=H("acct"),
                          json={"customer_id": STATE["cid"], "amount": 1})
        assert r.status_code == 200
