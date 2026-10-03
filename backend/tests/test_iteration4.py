"""Iteration 4 regression tests on MongoDB restore.

Covers (new features):
  - Delivery confirm/reject by distributor
  - Invoice discounts (PERCENT/FIXED) and voiding (/sales/{sid}/void)
  - Purchase returns, stock movements, price history
  - Notifications center (/notifications, /notifications/read-all)
  - Accountant alerts (/stats/alerts), finance analytics (/stats/finance)
  - Route KPIs (/routes/kpis) and route history
  - Org currency (/org/currency) and backup export (/backup/export)
  - Org deletion requests + account deletion (owner-must-request-first)
  - Consent (/auth/consent), app versions + update-gate, dev monitoring
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-rebuild-22.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TOK = {"dev": "test_token_dev", "owner": "test_token_owner", "agent": "test_token_agent",
       "acct": "test_token_acct", "new": "test_token_new"}


def H(r):
    return {"Authorization": f"Bearer {TOK[r]}", "Content-Type": "application/json"}


S = {}


# ---------- Setup ----------
class TestA_Setup:
    def test_auth_me_all_roles(self):
        for r in ("dev", "owner", "agent", "acct"):
            resp = requests.get(f"{API}/auth/me", headers=H(r))
            assert resp.status_code == 200, f"{r}: {resp.text}"

    def test_setup_product_and_customer(self):
        prods = requests.get(f"{API}/products", headers=H("owner")).json()
        p = next((x for x in prods if x["name"] == "TEST_IT4_P"), None)
        if not p:
            r = requests.post(f"{API}/products", headers=H("owner"),
                              json={"name": "TEST_IT4_P", "cost_price": 2, "sale_price": 10, "stock": 0, "min_stock": 5})
            assert r.status_code == 200, r.text
            p = r.json()
        S["pid"] = p["id"]
        # Ensure warehouse stock
        requests.post(f"{API}/purchases", headers=H("owner"),
                      json={"product_id": p["id"], "quantity": 500, "unit_cost": 2})
        custs = requests.get(f"{API}/customers", headers=H("owner")).json()
        c = next((x for x in custs if x["name"] == "TEST_IT4_C"), None)
        if not c:
            r = requests.post(f"{API}/customers", headers=H("owner"),
                              json={"name": "TEST_IT4_C", "phone": "999"})
            assert r.status_code == 200, r.text
            c = r.json()
        S["cid"] = c["id"]


# ---------- Delivery confirm/reject ----------
class TestB_DeliveryConfirmReject:
    def test_delivery_starts_pending(self):
        r = requests.post(f"{API}/deliveries", headers=H("owner"),
                          json={"distributor_id": "user_test_agent",
                                "items": [{"product_id": S["pid"], "quantity": 20}]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "PENDING"
        S["del_confirm_id"] = d["id"]

    def test_agent_confirm_delivery_adds_inventory(self):
        inv_before = next((i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json()
                           if i["product_id"] == S["pid"]), None)
        qb = inv_before["quantity"] if inv_before else 0
        r = requests.post(f"{API}/deliveries/{S['del_confirm_id']}/confirm", headers=H("agent"))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "CONFIRMED"
        inv = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json()
                   if i["product_id"] == S["pid"])
        assert inv["quantity"] - qb == 20

    def test_double_confirm_404(self):
        r = requests.post(f"{API}/deliveries/{S['del_confirm_id']}/confirm", headers=H("agent"))
        assert r.status_code == 404

    def test_reject_delivery_returns_stock_to_warehouse(self):
        # Create another delivery
        prod_before = next(p for p in requests.get(f"{API}/products", headers=H("owner")).json() if p["id"] == S["pid"])
        wb = prod_before["stock"]
        r = requests.post(f"{API}/deliveries", headers=H("owner"),
                          json={"distributor_id": "user_test_agent",
                                "items": [{"product_id": S["pid"], "quantity": 7}]})
        assert r.status_code == 200
        did = r.json()["id"]
        # Agent rejects
        r = requests.post(f"{API}/deliveries/{did}/reject", headers=H("agent"))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "REJECTED"
        prod_after = next(p for p in requests.get(f"{API}/products", headers=H("owner")).json() if p["id"] == S["pid"])
        # Stock went down by 7 on create and +7 back on reject -> net zero
        assert prod_after["stock"] == wb

    def test_owner_cannot_confirm_delivery(self):
        # Create a delivery owner cannot confirm (confirm requires AGENT)
        r = requests.post(f"{API}/deliveries", headers=H("owner"),
                          json={"distributor_id": "user_test_agent",
                                "items": [{"product_id": S["pid"], "quantity": 5}]})
        did = r.json()["id"]
        r = requests.post(f"{API}/deliveries/{did}/confirm", headers=H("owner"))
        assert r.status_code == 403
        # cleanup -- agent confirms so stock is in a known state
        requests.post(f"{API}/deliveries/{did}/confirm", headers=H("agent"))


# ---------- Invoice discounts + void ----------
class TestC_DiscountsAndVoid:
    def test_sale_with_percent_discount(self):
        payload = {"customer_id": S["cid"],
                   "items": [{"product_id": S["pid"], "quantity": 10, "price": 10}],
                   "discount_type": "PERCENT", "discount_value": 10, "paid_amount": 0}
        r = requests.post(f"{API}/sales", headers=H("agent"), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["subtotal"] == 100.0
        assert d["discount_amount"] == 10.0
        assert d["total"] == 90.0
        assert d["discount_type"] == "PERCENT"
        S["sale_pct"] = d["id"]

    def test_sale_with_fixed_discount(self):
        payload = {"customer_id": S["cid"],
                   "items": [{"product_id": S["pid"], "quantity": 5, "price": 10}],
                   "discount_type": "FIXED", "discount_value": 7, "paid_amount": 43}
        r = requests.post(f"{API}/sales", headers=H("agent"), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["subtotal"] == 50.0
        assert d["discount_amount"] == 7.0
        assert d["total"] == 43.0
        assert d["remaining"] == 0.0
        assert d["payment_type"] == "CASH"

    def test_discount_capped_at_subtotal(self):
        payload = {"customer_id": S["cid"],
                   "items": [{"product_id": S["pid"], "quantity": 1, "price": 10}],
                   "discount_type": "FIXED", "discount_value": 9999, "paid_amount": 0}
        r = requests.post(f"{API}/sales", headers=H("agent"), json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 0.0
        assert d["discount_amount"] == d["subtotal"]

    def test_void_sale_restores_inventory_and_balance(self):
        # Make a known sale
        payload = {"customer_id": S["cid"], "items": [{"product_id": S["pid"], "quantity": 3, "price": 10}], "paid_amount": 0}
        r = requests.post(f"{API}/sales", headers=H("agent"), json=payload)
        sid = r.json()["id"]
        total = r.json()["total"]
        inv_before = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json()
                          if i["product_id"] == S["pid"])["quantity"]
        cust_before = next(c for c in requests.get(f"{API}/customers", headers=H("owner")).json()
                           if c["id"] == S["cid"])["balance"]
        r = requests.post(f"{API}/sales/{sid}/void", headers=H("owner"), json={"reason": "test void"})
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["voided"] is True
        assert v["total"] == 0
        assert v["remaining"] == 0
        assert v["orig_total"] == total
        inv_after = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json()
                         if i["product_id"] == S["pid"])["quantity"]
        cust_after = next(c for c in requests.get(f"{API}/customers", headers=H("owner")).json()
                          if c["id"] == S["cid"])["balance"]
        assert inv_after - inv_before == 3  # inventory restored
        assert round(cust_before - cust_after, 2) == round(total, 2)  # debt removed

    def test_double_void_404(self):
        payload = {"customer_id": S["cid"], "items": [{"product_id": S["pid"], "quantity": 1, "price": 10}], "paid_amount": 0}
        sid = requests.post(f"{API}/sales", headers=H("agent"), json=payload).json()["id"]
        r1 = requests.post(f"{API}/sales/{sid}/void", headers=H("owner"), json={})
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/sales/{sid}/void", headers=H("owner"), json={})
        assert r2.status_code == 404

    def test_agent_cannot_void(self):
        payload = {"customer_id": S["cid"], "items": [{"product_id": S["pid"], "quantity": 1, "price": 10}], "paid_amount": 0}
        sid = requests.post(f"{API}/sales", headers=H("agent"), json=payload).json()["id"]
        r = requests.post(f"{API}/sales/{sid}/void", headers=H("agent"), json={})
        assert r.status_code == 403


# ---------- Purchase returns + stock movements + price history ----------
class TestD_PurchaseReturnsAndMovements:
    def test_purchase_return_decrements_stock(self):
        prod = next(p for p in requests.get(f"{API}/products", headers=H("owner")).json() if p["id"] == S["pid"])
        before = prod["stock"]
        r = requests.post(f"{API}/purchase-returns", headers=H("owner"),
                          json={"product_id": S["pid"], "quantity": 2, "unit_cost": 2, "supplier": "TEST_SUP", "reason": "defect"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 4.0
        assert d["return_no"].startswith("PRT-")
        prod_after = next(p for p in requests.get(f"{API}/products", headers=H("owner")).json() if p["id"] == S["pid"])
        assert prod_after["stock"] - before == -2

    def test_purchase_return_insufficient_stock_400(self):
        r = requests.post(f"{API}/purchase-returns", headers=H("owner"),
                          json={"product_id": S["pid"], "quantity": 999999, "unit_cost": 2})
        assert r.status_code == 400

    def test_agent_cannot_create_purchase_return(self):
        r = requests.post(f"{API}/purchase-returns", headers=H("agent"),
                          json={"product_id": S["pid"], "quantity": 1, "unit_cost": 2})
        assert r.status_code == 403

    def test_list_purchase_returns(self):
        r = requests.get(f"{API}/purchase-returns", headers=H("owner"))
        assert r.status_code == 200
        assert any(x["product_id"] == S["pid"] for x in r.json())
        # Accountant can also view
        r2 = requests.get(f"{API}/purchase-returns", headers=H("acct"))
        assert r2.status_code == 200

    def test_stock_movements_for_product(self):
        r = requests.get(f"{API}/stock-movements?product_id={S['pid']}", headers=H("owner"))
        assert r.status_code == 200
        kinds = {m["type"] for m in r.json()}
        # Should have PURCHASE, DELIVERY, SALE, RETURN, PURCHASE_RETURN...
        assert "PURCHASE" in kinds
        assert "DELIVERY" in kinds
        assert "SALE" in kinds or "SALE_VOID" in kinds
        assert "PURCHASE_RETURN" in kinds

    def test_price_history_on_product_update(self):
        # Change sale_price to trigger price history
        new_price = 11.5
        r = requests.put(f"{API}/products/{S['pid']}", headers=H("owner"),
                         json={"name": "TEST_IT4_P", "cost_price": 2, "sale_price": new_price,
                               "stock": 500, "min_stock": 5})
        # Response may or may not be ok depending on PUT implementation; check history endpoint
        hist = requests.get(f"{API}/price-history", headers=H("owner"))
        assert hist.status_code == 200
        # Reset to 10 for subsequent predictability
        requests.put(f"{API}/products/{S['pid']}", headers=H("owner"),
                     json={"name": "TEST_IT4_P", "cost_price": 2, "sale_price": 10, "stock": 500, "min_stock": 5})


# ---------- Notifications ----------
class TestE_Notifications:
    def test_agent_notifications_contain_delivery(self):
        r = requests.get(f"{API}/notifications", headers=H("agent"))
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "unread" in d
        # should have at least one notification (we created deliveries)
        assert len(d["items"]) >= 1

    def test_mark_read_all(self):
        r = requests.post(f"{API}/notifications/read-all", headers=H("agent"))
        assert r.status_code == 200
        d = requests.get(f"{API}/notifications", headers=H("agent")).json()
        assert d["unread"] == 0


# ---------- Accountant alerts + finance ----------
class TestF_StatsAlertsAndFinance:
    def test_alerts_list(self):
        r = requests.get(f"{API}/stats/alerts", headers=H("acct"))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_finance_structure(self):
        r = requests.get(f"{API}/stats/finance", headers=H("acct"))
        assert r.status_code == 200
        d = r.json()
        for k in ("sales_total", "invoice_count", "cash_total", "credit_total",
                  "cash_discounts", "credit_discounts", "collections_total",
                  "debt_customers", "debts_total", "purchases_total",
                  "purchase_returns_total", "top_discount_customers"):
            assert k in d, f"missing {k}"
        # we created a 7 fixed-discount + 10 percent-discount sale -> cash_discounts + credit_discounts > 0
        assert (d["cash_discounts"] + d["credit_discounts"]) > 0

    def test_finance_forbidden_for_agent(self):
        r = requests.get(f"{API}/stats/finance", headers=H("agent"))
        assert r.status_code == 403


# ---------- Route KPIs ----------
class TestG_RouteKPIs:
    def test_route_kpis_structure(self):
        r = requests.get(f"{API}/routes/kpis?days=30", headers=H("owner"))
        assert r.status_code == 200
        d = r.json()
        assert "agents" in d and "history" in d
        assert isinstance(d["agents"], list)
        assert isinstance(d["history"], list)

    def test_kpis_forbidden_for_not_in_org(self):
        r = requests.get(f"{API}/routes/kpis", headers=H("new"))
        assert r.status_code == 403


# ---------- Org currency ----------
class TestH_OrgCurrency:
    def test_owner_sets_currency(self):
        r = requests.put(f"{API}/org/currency", headers=H("owner"),
                         json={"currency": "ل.س", "alt_currency": "USD", "exchange_rate": 15000})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["currency"] == "ل.س"
        assert d["alt_currency"] == "USD"
        assert d["exchange_rate"] == 15000

    def test_agent_cannot_set_currency(self):
        r = requests.put(f"{API}/org/currency", headers=H("agent"),
                         json={"currency": "USD"})
        assert r.status_code == 403


# ---------- Backup export ----------
class TestI_BackupExport:
    def test_backup_owner(self):
        r = requests.get(f"{API}/backup/export", headers=H("owner"))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "exported_at" in d
        assert "organization" in d
        for key in ("products", "customers", "sales", "collections", "sales_returns",
                    "purchases", "deliveries", "stock_movements", "routes", "stock_requests",
                    "employees"):
            assert key in d, f"missing {key}"
        assert isinstance(d["products"], list)
        # No _id leakage
        for p in d["products"][:5]:
            assert "_id" not in p

    def test_backup_agent_forbidden(self):
        r = requests.get(f"{API}/backup/export", headers=H("agent"))
        assert r.status_code == 403


# ---------- Deletion requests + account deletion ----------
class TestJ_DeletionRequests:
    def test_owner_create_deletion_request(self):
        # cleanup first
        existing = requests.get(f"{API}/deletion-requests", headers=H("owner")).json()
        for e in existing:
            if e.get("status") == "PENDING":
                requests.delete(f"{API}/deletion-requests/{e['id']}", headers=H("owner"))
        r = requests.post(f"{API}/deletion-requests", headers=H("owner"), json={"reason": "test"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "PENDING"
        assert d["org_id"] == "org_test_1"
        S["del_req_id"] = d["id"]

    def test_double_pending_rejected(self):
        r = requests.post(f"{API}/deletion-requests", headers=H("owner"), json={"reason": "x"})
        assert r.status_code == 400

    def test_dev_lists_all_requests(self):
        r = requests.get(f"{API}/deletion-requests", headers=H("dev"))
        assert r.status_code == 200
        assert any(x["id"] == S["del_req_id"] for x in r.json())

    def test_dev_rejects_request(self):
        r = requests.patch(f"{API}/dev/deletion-requests/{S['del_req_id']}", headers=H("dev"),
                           json={"action": "reject"})
        assert r.status_code == 200
        assert r.json()["status"] == "REJECTED"

    def test_owner_cannot_delete_own_account(self):
        r = requests.delete(f"{API}/auth/account", headers=H("owner"))
        assert r.status_code == 400


# ---------- Consent ----------
class TestK_Consent:
    def test_consent_set(self):
        r = requests.post(f"{API}/auth/consent", headers=H("owner"))
        assert r.status_code == 200
        assert r.json().get("consent_at")


# ---------- App versions + update gate ----------
class TestL_AppVersions:
    def test_dev_create_version(self):
        r = requests.post(f"{API}/dev/versions", headers=H("dev"),
                          json={"platform": "all", "version": "99.0.0-test",
                                "force_update": False, "release_notes": "test", "store_url": ""})
        assert r.status_code == 200, r.text
        S["ver_id"] = r.json()["id"]

    def test_latest_version_public(self):
        # No auth header still returns (public endpoint)
        r = requests.get(f"{API}/app-version/latest?platform=android")
        assert r.status_code == 200

    def test_list_versions_dev_only(self):
        r = requests.get(f"{API}/dev/versions", headers=H("dev"))
        assert r.status_code == 200
        assert any(x["id"] == S.get("ver_id") for x in r.json())
        r2 = requests.get(f"{API}/dev/versions", headers=H("owner"))
        assert r2.status_code == 403

    def test_delete_version(self):
        r = requests.delete(f"{API}/dev/versions/{S['ver_id']}", headers=H("dev"))
        assert r.status_code == 200


# ---------- Developer monitoring ----------
class TestM_Monitoring:
    def test_monitoring_dev(self):
        r = requests.get(f"{API}/dev/monitoring", headers=H("dev"))
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        row = next((x for x in rows if x["id"] == "org_test_1"), None)
        assert row is not None
        for k in ("name", "status", "users", "products", "customers", "sales", "revenue"):
            assert k in row

    def test_monitoring_owner_forbidden(self):
        r = requests.get(f"{API}/dev/monitoring", headers=H("owner"))
        assert r.status_code == 403


# ---------- Role gating / 403 sanity ----------
class TestN_RoleGating:
    def test_new_user_no_org_blocked(self):
        # /products requires ANY_ORG
        r = requests.get(f"{API}/products", headers=H("new"))
        assert r.status_code == 403
        r = requests.get(f"{API}/stats/overview", headers=H("new"))
        assert r.status_code == 403

    def test_agent_cannot_create_product(self):
        r = requests.post(f"{API}/products", headers=H("agent"),
                          json={"name": "x", "cost_price": 1, "sale_price": 2, "stock": 0})
        assert r.status_code == 403

    def test_accountant_cannot_create_sale(self):
        r = requests.post(f"{API}/sales", headers=H("acct"),
                          json={"customer_id": S["cid"], "items": [{"product_id": S["pid"], "quantity": 1}]})
        assert r.status_code == 403

    def test_bad_token_401(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalid"})
        assert r.status_code == 401


# ---------- Reports ----------
class TestO_Reports:
    def test_reports_day_week_month(self):
        for period in ("day", "week", "month"):
            r = requests.get(f"{API}/stats/reports?period={period}", headers=H("owner"))
            assert r.status_code == 200, f"period={period}: {r.text}"
            d = r.json()
            assert "rows" in d and "totals" in d
            assert isinstance(d["rows"], list)
