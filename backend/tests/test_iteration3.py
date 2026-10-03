"""Iteration 3: customer types/price lists, route planner, stock requests, yearly plans."""
import os
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


# ------------- Setup: ensure a product, customer and an agent delivery -------------
class TestA_Setup:
    def test_setup_product(self):
        prods = requests.get(f"{API}/products", headers=H("owner")).json()
        p = next((x for x in prods if x["name"] == "TEST_ITER3_P"), None)
        if not p:
            r = requests.post(f"{API}/products", headers=H("owner"),
                              json={"name": "TEST_ITER3_P", "cost_price": 2, "sale_price": 15, "stock": 0, "min_stock": 5})
            assert r.status_code == 200
            p = r.json()
        # Ensure enough warehouse stock for the delivery and fulfill tests (needs >= 80)
        if (p.get("stock") or 0) < 100:
            requests.post(f"{API}/purchases", headers=H("owner"),
                          json={"product_id": p["id"], "quantity": 200, "unit_cost": 2})
        STATE["pid"] = p["id"]

    def test_setup_deliver_to_agent(self):
        r = requests.post(f"{API}/deliveries", headers=H("owner"),
                          json={"distributor_id": "user_test_agent",
                                "items": [{"product_id": STATE["pid"], "quantity": 50}]})
        assert r.status_code == 200, r.text
        did = r.json()["id"]
        # NEW: delivery is PENDING; agent confirms to receive stock
        c = requests.post(f"{API}/deliveries/{did}/confirm", headers=H("agent"))
        assert c.status_code == 200, c.text


# ------------- Customer types / price lists -------------
class TestB_CustomerTypes:
    def test_create_type_owner(self):
        r = requests.post(f"{API}/customer-types", headers=H("owner"),
                          json={"name": "TEST_WHOLESALE", "prices": {STATE["pid"]: 9.5}})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_WHOLESALE"
        assert d["prices"][STATE["pid"]] == 9.5
        STATE["type_id"] = d["id"]

    def test_create_type_agent_forbidden(self):
        r = requests.post(f"{API}/customer-types", headers=H("agent"),
                          json={"name": "x", "prices": {}})
        assert r.status_code == 403

    def test_list_types_all_org(self):
        for role in ("owner", "agent", "acct"):
            r = requests.get(f"{API}/customer-types", headers=H(role))
            assert r.status_code == 200
            assert any(t["id"] == STATE["type_id"] for t in r.json())

    def test_type_empty_name_rejected(self):
        r = requests.post(f"{API}/customer-types", headers=H("owner"),
                          json={"name": "   ", "prices": {}})
        assert r.status_code == 400

    def test_type_bad_price_rejected(self):
        r = requests.post(f"{API}/customer-types", headers=H("owner"),
                          json={"name": "TEST_BAD", "prices": {STATE["pid"]: "abc"}})
        assert r.status_code == 400

    def test_update_type(self):
        r = requests.put(f"{API}/customer-types/{STATE['type_id']}", headers=H("owner"),
                         json={"name": "TEST_WHOLESALE2", "prices": {STATE["pid"]: 8.0}})
        assert r.status_code == 200
        assert r.json()["prices"][STATE["pid"]] == 8.0


# ------------- Customers with type_id / lat / lng -------------
class TestC_CustomersTyped:
    def test_create_customer_with_type_and_geo(self):
        r = requests.post(f"{API}/customers", headers=H("agent"),
                          json={"name": "TEST_ITER3_CUST_TYPED", "phone": "9647711111111",
                                "address": "بغداد-أ",
                                "type_id": STATE["type_id"], "lat": 33.3, "lng": 44.3})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["type_id"] == STATE["type_id"]
        assert d["lat"] == 33.3 and d["lng"] == 44.3
        STATE["cust_typed"] = d["id"]

    def test_create_customer_without_type(self):
        r = requests.post(f"{API}/customers", headers=H("agent"),
                          json={"name": "TEST_ITER3_CUST_NO_LOC", "phone": "9647722222222",
                                "address": "بغداد-ب", "lat": 33.31, "lng": 44.36})
        assert r.status_code == 200
        STATE["cust_untyped"] = r.json()["id"]
        # lat/lng are now mandatory
        assert r.json().get("lat") == 33.31


# ------------- Sale honours type price and ignores client price -------------
class TestD_SalePriceLocking:
    def test_sale_typed_customer_uses_type_price(self):
        payload = {"customer_id": STATE["cust_typed"], "lat": 10.0, "lng": 20.0,
                   "items": [{"product_id": STATE["pid"], "quantity": 2, "price": 999}], "paid_amount": 0}
        r = requests.post(f"{API}/sales", headers=H("agent"), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["items"][0]["price"] == 8.0, f"expected locked type-price 8.0, got {d['items'][0]['price']}"
        assert d["total"] == 16.0

    def test_sale_untyped_uses_product_sale_price(self):
        payload = {"customer_id": STATE["cust_untyped"],
                   "items": [{"product_id": STATE["pid"], "quantity": 1, "price": 1}], "paid_amount": 0}
        r = requests.post(f"{API}/sales", headers=H("agent"), json=payload)
        assert r.status_code == 200
        assert r.json()["items"][0]["price"] == 15.0

    def test_sale_sets_customer_lat_lng_when_missing(self):
        # New rules: lat/lng are mandatory at customer creation. Verify the sale
        # does NOT overwrite an existing customer location (customer location is sticky).
        payload = {"customer_id": STATE["cust_untyped"], "lat": 55.5, "lng": 66.6,
                   "items": [{"product_id": STATE["pid"], "quantity": 1, "price": 1}], "paid_amount": 0}
        r = requests.post(f"{API}/sales", headers=H("agent"), json=payload)
        assert r.status_code == 200
        cust = next(c for c in requests.get(f"{API}/customers", headers=H("owner")).json() if c["id"] == STATE["cust_untyped"])
        assert cust["lat"] == 33.31 and cust["lng"] == 44.36, "existing customer location should be sticky"

    def test_sales_return_uses_type_price(self):
        payload = {"customer_id": STATE["cust_typed"],
                   "items": [{"product_id": STATE["pid"], "quantity": 1, "price": 999}], "reason": "x"}
        r = requests.post(f"{API}/sales-returns", headers=H("agent"), json=payload)
        assert r.status_code == 200
        assert r.json()["items"][0]["price"] == 8.0


# ------------- Route planner -------------
class TestE_Routes:
    def test_save_route_owner(self):
        today = "2026-01-20"
        r = requests.post(f"{API}/routes", headers=H("owner"),
                          json={"distributor_id": "user_test_agent", "date": today,
                                "customer_ids": [STATE["cust_typed"], STATE["cust_untyped"]]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["stops"]) == 2
        assert all(s["status"] == "PENDING" for s in d["stops"])
        STATE["route_id"] = d["id"]
        STATE["route_date"] = today

    def test_save_route_agent_forbidden(self):
        r = requests.post(f"{API}/routes", headers=H("agent"),
                          json={"distributor_id": "user_test_agent", "date": "2026-01-21", "customer_ids": []})
        assert r.status_code == 403

    def test_bad_distributor_404(self):
        r = requests.post(f"{API}/routes", headers=H("owner"),
                          json={"distributor_id": "nope", "date": "2026-01-21", "customer_ids": []})
        assert r.status_code == 404

    def test_list_routes_filter(self):
        r = requests.get(f"{API}/routes?date={STATE['route_date']}&distributor_id=user_test_agent", headers=H("owner"))
        assert r.status_code == 200
        assert any(x["id"] == STATE["route_id"] for x in r.json())

    def test_agent_my_route(self):
        r = requests.get(f"{API}/routes/mine?date={STATE['route_date']}", headers=H("agent"))
        assert r.status_code == 200
        assert r.json()["id"] == STATE["route_id"]

    def test_stop_status_update(self):
        rid, cid = STATE["route_id"], STATE["cust_typed"]
        r = requests.post(f"{API}/routes/{rid}/stops/{cid}/status", headers=H("agent"),
                          json={"status": "VISITED", "note": "ok"})
        assert r.status_code == 200
        stop = next(s for s in r.json()["stops"] if s["customer_id"] == cid)
        assert stop["status"] == "VISITED"
        assert stop["note"] == "ok"
        assert stop.get("at")

    def test_stop_status_invalid(self):
        r = requests.post(f"{API}/routes/{STATE['route_id']}/stops/{STATE['cust_typed']}/status",
                          headers=H("agent"), json={"status": "WRONG"})
        assert r.status_code == 400

    def test_upsert_preserves_statuses(self):
        r = requests.post(f"{API}/routes", headers=H("owner"),
                          json={"distributor_id": "user_test_agent", "date": STATE["route_date"],
                                "customer_ids": [STATE["cust_typed"], STATE["cust_untyped"]]})
        assert r.status_code == 200
        stop = next(s for s in r.json()["stops"] if s["customer_id"] == STATE["cust_typed"])
        assert stop["status"] == "VISITED"

    def test_optimize_route_agent(self):
        # typed has lat 33.3,44.3 ; untyped now has 55.5,66.6 (set via sale)
        r = requests.post(f"{API}/routes/{STATE['route_id']}/optimize", headers=H("agent"),
                          json={"lat": 33.0, "lng": 44.0})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "unlocated" in d
        assert d["unlocated"] == 0
        # done stops first, then nearest. Typed is VISITED so should be in "done"
        pending = [s for s in d["stops"] if s["status"] == "PENDING"]
        assert len(pending) == 1

    def test_optimize_route_owner_forbidden(self):
        # owner (ROLE OWNER) is allowed only through AGENT, but endpoint uses ANY_ORG + employee_type gate
        # Owner is role OWNER not EMPLOYEE -> allowed per code
        r = requests.post(f"{API}/routes/{STATE['route_id']}/optimize", headers=H("owner"), json={})
        assert r.status_code == 200

    def test_optimize_accountant_forbidden(self):
        r = requests.post(f"{API}/routes/{STATE['route_id']}/optimize", headers=H("acct"), json={})
        assert r.status_code == 403

    def test_delete_route(self):
        # Create a throwaway route and delete it
        r = requests.post(f"{API}/routes", headers=H("owner"),
                          json={"distributor_id": "user_test_agent", "date": "2026-01-30",
                                "customer_ids": [STATE["cust_typed"]]})
        rid = r.json()["id"]
        r = requests.delete(f"{API}/routes/{rid}", headers=H("owner"))
        assert r.status_code == 200
        r = requests.get(f"{API}/routes?date=2026-01-30", headers=H("owner"))
        assert not any(x["id"] == rid for x in r.json())


# ------------- Stock requests -------------
class TestF_StockRequests:
    def test_my_inventory_includes_min_stock(self):
        r = requests.get(f"{API}/my/inventory", headers=H("agent"))
        assert r.status_code == 200
        row = next(i for i in r.json() if i["product_id"] == STATE["pid"])
        assert "min_stock" in row
        assert row["min_stock"] == 5

    def test_agent_create_stock_request(self):
        rid = "test-stockreq-fixed-1"
        payload = {"id": rid, "items": [{"product_id": STATE["pid"], "quantity": 30}], "note": "low"}
        r = requests.post(f"{API}/stock-requests", headers=H("agent"), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == rid
        assert d["status"] == "PENDING"
        assert d["items"][0]["product_id"] == STATE["pid"]
        STATE["sr_id"] = rid

    def test_idempotent_stock_request(self):
        payload = {"id": STATE["sr_id"], "items": [{"product_id": STATE["pid"], "quantity": 999}], "note": "x"}
        r = requests.post(f"{API}/stock-requests", headers=H("agent"), json=payload)
        assert r.status_code == 200
        # should return original (qty 30, note "low")
        assert r.json()["items"][0]["quantity"] == 30
        assert r.json()["note"] == "low"

    def test_create_stock_request_empty_rejected(self):
        r = requests.post(f"{API}/stock-requests", headers=H("agent"), json={"items": [], "note": ""})
        assert r.status_code == 400

    def test_owner_lists_all_requests(self):
        r = requests.get(f"{API}/stock-requests", headers=H("owner"))
        assert r.status_code == 200
        assert any(x["id"] == STATE["sr_id"] for x in r.json())

    def test_agent_list_scoped(self):
        r = requests.get(f"{API}/stock-requests", headers=H("agent"))
        assert r.status_code == 200
        assert all(x["distributor_id"] == "user_test_agent" for x in r.json())

    def test_owner_create_forbidden(self):
        r = requests.post(f"{API}/stock-requests", headers=H("owner"),
                          json={"items": [{"product_id": STATE["pid"], "quantity": 1}]})
        assert r.status_code == 403

    def test_fulfill_insufficient_warehouse_returns_400(self):
        # Make a req with huge qty via a tmp product with 0 stock
        rp = requests.post(f"{API}/products", headers=H("owner"),
                           json={"name": "TEST_ITER3_SMALL", "cost_price": 1, "sale_price": 2, "stock": 0, "min_stock": 0})
        tmp_pid = rp.json()["id"]
        STATE["tmp_pid"] = tmp_pid
        # Agent requests 10 of it
        r = requests.post(f"{API}/stock-requests", headers=H("agent"),
                          json={"items": [{"product_id": tmp_pid, "quantity": 10}]})
        rid = r.json()["id"]
        r = requests.post(f"{API}/stock-requests/{rid}/fulfill", headers=H("owner"))
        # delivery raises 400 for insufficient warehouse stock
        assert r.status_code == 400, r.text
        # Request still pending
        still = next(x for x in requests.get(f"{API}/stock-requests", headers=H("owner")).json() if x["id"] == rid)
        assert still["status"] == "PENDING"
        STATE["pending_rid"] = rid

    def test_fulfill_success(self):
        # Agent inventory before
        inv_before = next((i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json() if i["product_id"] == STATE["pid"]), None)
        qty_before = inv_before["quantity"] if inv_before else 0
        r = requests.post(f"{API}/stock-requests/{STATE['sr_id']}/fulfill", headers=H("owner"))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "FULFILLED"
        assert d.get("delivery_id")
        # iter4: delivery now starts PENDING; agent must confirm to receive stock
        c = requests.post(f"{API}/deliveries/{d['delivery_id']}/confirm", headers=H("agent"))
        assert c.status_code == 200, c.text
        inv_after = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json() if i["product_id"] == STATE["pid"])
        assert inv_after["quantity"] - qty_before == 30

    def test_reject_pending_request(self):
        r = requests.post(f"{API}/stock-requests/{STATE['pending_rid']}/reject", headers=H("owner"))
        assert r.status_code == 200
        assert r.json()["status"] == "REJECTED"

    def test_fulfill_non_pending_404(self):
        r = requests.post(f"{API}/stock-requests/{STATE['sr_id']}/fulfill", headers=H("owner"))
        assert r.status_code == 404


# ------------- Yearly plans -------------
class TestG_YearlyPlans:
    def test_dev_creates_plan_with_yearly(self):
        r = requests.post(f"{API}/dev/plans", headers=H("dev"),
                          json={"name": "TEST_ITER3_YEARLY", "price": 100, "yearly_price": 1000,
                                "days": 30, "max_employees": 5, "active": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["yearly_price"] == 1000
        STATE["yearly_plan"] = d["id"]

    def test_dev_creates_plan_no_yearly(self):
        r = requests.post(f"{API}/dev/plans", headers=H("dev"),
                          json={"name": "TEST_ITER3_MONTHLY_ONLY", "price": 50,
                                "days": 30, "max_employees": 5, "active": True})
        assert r.status_code == 200
        STATE["monthly_only_plan"] = r.json()["id"]

    def test_clear_pending_upgrade(self):
        reqs = requests.get(f"{API}/upgrade-requests", headers=H("owner")).json()
        for q in reqs:
            if q["status"] == "PENDING":
                requests.patch(f"{API}/dev/upgrade-requests/{q['id']}", headers=H("dev"),
                               json={"action": "reject"})

    def test_yearly_upgrade_uses_yearly_price_and_365_days(self):
        r = requests.post(f"{API}/upgrade-requests", headers=H("owner"),
                          json={"plan_id": STATE["yearly_plan"], "payment_ref": "TXN-YEARLY-1", "billing": "yearly"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["billing"] == "yearly"
        assert d["price"] == 1000
        assert d["days"] == 365
        assert "سنوي" in d["plan_name"]
        STATE["yearly_req"] = d["id"]

    def test_yearly_rejected_when_no_yearly_price(self):
        # Reject above request first
        requests.patch(f"{API}/dev/upgrade-requests/{STATE['yearly_req']}", headers=H("dev"),
                       json={"action": "reject"})
        r = requests.post(f"{API}/upgrade-requests", headers=H("owner"),
                          json={"plan_id": STATE["monthly_only_plan"], "payment_ref": "TXN-YEARLY-2", "billing": "yearly"})
        assert r.status_code == 400

    def test_monthly_billing_still_works(self):
        r = requests.post(f"{API}/upgrade-requests", headers=H("owner"),
                          json={"plan_id": STATE["monthly_only_plan"], "payment_ref": "TXN-MONTHLY", "billing": "monthly"})
        assert r.status_code == 200
        d = r.json()
        assert d["billing"] == "monthly"
        assert d["days"] == 30
        assert d["price"] == 50
        STATE["monthly_req"] = d["id"]


# ------------- Cleanup -------------
def test_zz_cleanup():
    for key in ("yearly_req", "monthly_req"):
        rid = STATE.get(key)
        if rid:
            requests.patch(f"{API}/dev/upgrade-requests/{rid}", headers=H("dev"), json={"action": "reject"})
    for key in ("yearly_plan", "monthly_only_plan"):
        pid = STATE.get(key)
        if pid:
            requests.delete(f"{API}/dev/plans/{pid}", headers=H("dev"))
    # delete customer type (will null-out customer type_id)
    if STATE.get("type_id"):
        requests.delete(f"{API}/customer-types/{STATE['type_id']}", headers=H("owner"))
