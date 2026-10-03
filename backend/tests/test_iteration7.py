"""Iteration 7 backend tests.

Covers the new distributor-isolation + ops rules:
- Customers: only FIELD_AGENT may create; all fields required (incl. GPS);
  OWNER/ACCOUNTANT get 403; distributor isolation (agent2 cannot access agent1
  customer); DELETE removed (405); PUT only by owning agent.
- Routes: POST /routes with foreign customer_ids is silently filtered.
- Payment vouchers (refunds): FIELD_AGENT only; only when balance < 0; capped at credit;
  balance increases by amount; idempotent; included in /customers/{id}/statement as PAYMENT.
- Warehouse returns: FIELD_AGENT creates (deducts agent inventory, status PENDING,
  WRT-xxxxx no.); OWNER accept (stock += qty, status ACCEPTED); OWNER reject
  (agent inventory restored, status REJECTED w/ reason); second accept/reject -> 404;
  agent/acct accept -> 403.
- Org profile: phone_country_code accepted, non-digits stripped, max 4.
- Trail: GET /tracking/agents/{uid}/trail works for STAFF; bad date 400; unknown uid 404;
  agent -> 403.
- Debts: stale debtors + digest + reminded drop-out.
"""
import os
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                          "https://mobile-rebuild-22.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TOK = {"dev": "test_token_dev", "owner": "test_token_owner",
       "agent": "test_token_agent", "agent2": "test_token_agent2",
       "acct": "test_token_acct", "new": "test_token_new"}


def H(r):
    return {"Authorization": f"Bearer {TOK[r]}", "Content-Type": "application/json"}


S = {}


# ---------- Customers rule changes ----------
class TestA_Customers:
    def test_owner_cannot_create(self):
        r = requests.post(f"{API}/customers", headers=H("owner"),
                          json={"name": "TEST_IT7_X", "phone": "9647700000111",
                                "address": "بغداد", "lat": 33.3, "lng": 44.3})
        assert r.status_code == 403

    def test_acct_cannot_create(self):
        r = requests.post(f"{API}/customers", headers=H("acct"),
                          json={"name": "TEST_IT7_X", "phone": "9647700000111",
                                "address": "بغداد", "lat": 33.3, "lng": 44.3})
        assert r.status_code == 403

    def test_agent_missing_fields_400(self):
        r = requests.post(f"{API}/customers", headers=H("agent"),
                          json={"name": "", "phone": "", "address": ""})
        assert r.status_code == 400
        d = r.json()["detail"]
        for part in ("اسم العميل", "الهاتف", "العنوان", "GPS"):
            assert part in d, f"missing field label {part} not in {d}"

    def test_agent_phone_too_short_400(self):
        r = requests.post(f"{API}/customers", headers=H("agent"),
                          json={"name": "TEST_IT7_SHORT", "phone": "12345",
                                "address": "بغداد", "lat": 33.3, "lng": 44.3})
        assert r.status_code == 400
        assert "الهاتف" in r.json()["detail"]

    def test_agent_invalid_type_400(self):
        r = requests.post(f"{API}/customers", headers=H("agent"),
                          json={"name": "TEST_IT7_T", "phone": "9647700000111",
                                "address": "بغداد", "lat": 33.3, "lng": 44.3,
                                "type_id": "nonexistent-type"})
        assert r.status_code == 400

    def test_agent_valid_creates_200(self):
        r = requests.post(f"{API}/customers", headers=H("agent"),
                          json={"name": "TEST_IT7_C1", "phone": "9647700000112",
                                "address": "بغداد-ك", "lat": 33.3, "lng": 44.3})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["distributor_id"] == "user_test_agent"
        S["c1"] = d["id"]

    def test_agent2_isolation_create_and_access(self):
        r = requests.post(f"{API}/customers", headers=H("agent2"),
                          json={"name": "TEST_IT7_C2", "phone": "9647700000113",
                                "address": "بغداد-أ2", "lat": 33.33, "lng": 44.33})
        assert r.status_code == 200, r.text
        S["c2"] = r.json()["id"]
        # agent1 cannot see c2
        agent1_list = requests.get(f"{API}/customers", headers=H("agent")).json()
        assert all(c["id"] != S["c2"] for c in agent1_list)
        # agent2 cannot see c1
        agent2_list = requests.get(f"{API}/customers", headers=H("agent2")).json()
        assert all(c["id"] != S["c1"] for c in agent2_list)

    def test_agent2_statement_on_agent1_customer_404(self):
        r = requests.get(f"{API}/customers/{S['c1']}/statement", headers=H("agent2"))
        assert r.status_code == 404

    def test_agent2_reminded_on_agent1_customer_404(self):
        r = requests.post(f"{API}/customers/{S['c1']}/reminded", headers=H("agent2"))
        assert r.status_code == 404

    def test_owner_sees_all_with_distributor_name(self):
        all_c = requests.get(f"{API}/customers", headers=H("owner")).json()
        c1 = next(c for c in all_c if c["id"] == S["c1"])
        c2 = next(c for c in all_c if c["id"] == S["c2"])
        assert c1.get("distributor_name")
        assert c2.get("distributor_name")

    def test_put_by_other_agent_404(self):
        r = requests.put(f"{API}/customers/{S['c1']}", headers=H("agent2"),
                         json={"name": "hack", "phone": "9647700000112",
                               "address": "x", "lat": 33.3, "lng": 44.3})
        assert r.status_code == 404

    def test_put_by_owner_403(self):
        r = requests.put(f"{API}/customers/{S['c1']}", headers=H("owner"),
                         json={"name": "hack", "phone": "9647700000112",
                               "address": "x", "lat": 33.3, "lng": 44.3})
        assert r.status_code == 403

    def test_put_by_owning_agent_ok(self):
        r = requests.put(f"{API}/customers/{S['c1']}", headers=H("agent"),
                         json={"name": "TEST_IT7_C1b", "phone": "9647700000112",
                               "address": "بغداد-ك2", "lat": 33.3, "lng": 44.3})
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "TEST_IT7_C1b"

    def test_delete_removed_405(self):
        r = requests.delete(f"{API}/customers/{S['c1']}", headers=H("agent"))
        assert r.status_code == 405


# ---------- Routes isolation ----------
class TestB_Routes:
    def test_save_route_filters_foreign_customers(self):
        r = requests.post(f"{API}/routes", headers=H("owner"),
                          json={"distributor_id": "user_test_agent", "date": "2026-01-25",
                                "customer_ids": [S["c1"], S["c2"]]})
        assert r.status_code == 200, r.text
        stops = r.json()["stops"]
        ids = [s["customer_id"] for s in stops]
        assert S["c1"] in ids
        assert S["c2"] not in ids, "agent2's customer must be filtered out"


# ---------- Payment vouchers ----------
class TestC_PaymentVouchers:
    def _ensure_credit_customer(self):
        # Build credit via: purchase -> delivery+confirm -> cash sale -> sales-return
        prods = requests.get(f"{API}/products", headers=H("owner")).json()
        p = next((x for x in prods if x["name"] == "TEST_IT7_P"), None)
        if not p:
            p = requests.post(f"{API}/products", headers=H("owner"),
                              json={"name": "TEST_IT7_P", "cost_price": 2, "sale_price": 10,
                                    "stock": 0, "min_stock": 0}).json()
        S["pid"] = p["id"]
        requests.post(f"{API}/purchases", headers=H("owner"),
                      json={"product_id": p["id"], "quantity": 100, "unit_cost": 2})
        d = requests.post(f"{API}/deliveries", headers=H("owner"),
                          json={"distributor_id": "user_test_agent",
                                "items": [{"product_id": p["id"], "quantity": 30}]}).json()
        requests.post(f"{API}/deliveries/{d['id']}/confirm", headers=H("agent"))
        # cash sale (paid_amount = total)
        r = requests.post(f"{API}/sales", headers=H("agent"),
                          json={"customer_id": S["c1"],
                                "items": [{"product_id": p["id"], "quantity": 2, "price": 10}],
                                "paid_amount": 20}).json()
        S["sale_id"] = r["id"]
        # return 1 unit -> customer balance becomes -10 (credit)
        rr = requests.post(f"{API}/sales-returns", headers=H("agent"),
                           json={"customer_id": S["c1"],
                                 "items": [{"product_id": p["id"], "quantity": 1, "price": 10}],
                                 "reason": "credit setup"})
        assert rr.status_code == 200, rr.text
        cust = next(c for c in requests.get(f"{API}/customers", headers=H("agent")).json() if c["id"] == S["c1"])
        assert cust["balance"] < 0, f"expected credit balance, got {cust['balance']}"
        S["credit"] = -cust["balance"]

    def test_01_setup_credit(self):
        self._ensure_credit_customer()

    def test_02_owner_cannot_create_pay(self):
        r = requests.post(f"{API}/payment-vouchers", headers=H("owner"),
                          json={"customer_id": S["c1"], "amount": 1})
        assert r.status_code == 403

    def test_03_agent_amount_over_credit_400(self):
        r = requests.post(f"{API}/payment-vouchers", headers=H("agent"),
                          json={"customer_id": S["c1"], "amount": S["credit"] + 10})
        assert r.status_code == 400

    def test_04_agent_valid_200(self):
        amt = round(S["credit"], 2)
        r = requests.post(f"{API}/payment-vouchers", headers=H("agent"),
                          json={"customer_id": S["c1"], "amount": amt, "notes": "refund"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["voucher_no"].startswith("PAY-")
        assert d["amount"] == amt
        S["pay_no"] = d["voucher_no"]
        S["pay_id"] = d["id"]
        # Balance now >= 0 (increased by amt)
        cust = next(c for c in requests.get(f"{API}/customers", headers=H("agent")).json() if c["id"] == S["c1"])
        assert abs(cust["balance"]) < 0.01, f"balance should be ~0, got {cust['balance']}"

    def test_05_agent_cannot_pay_when_not_credit(self):
        # Balance is 0 now
        r = requests.post(f"{API}/payment-vouchers", headers=H("agent"),
                          json={"customer_id": S["c1"], "amount": 1})
        assert r.status_code == 400

    def test_06_idempotent_by_id(self):
        # Create a fresh credit of 5 via another return (quantity .5)
        requests.post(f"{API}/sales-returns", headers=H("agent"),
                      json={"customer_id": S["c1"],
                            "items": [{"product_id": S["pid"], "quantity": 1, "price": 5}],
                            "reason": "x"})
        pid_v = "pay-idem-fixed-7"
        payload = {"id": pid_v, "customer_id": S["c1"], "amount": 1}
        r1 = requests.post(f"{API}/payment-vouchers", headers=H("agent"), json=payload)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/payment-vouchers", headers=H("agent"), json=payload)
        assert r2.status_code == 200
        assert r1.json()["voucher_no"] == r2.json()["voucher_no"]

    def test_07_list_scoping(self):
        agent_list = requests.get(f"{API}/payment-vouchers", headers=H("agent")).json()
        assert any(v["voucher_no"] == S["pay_no"] for v in agent_list)
        agent2_list = requests.get(f"{API}/payment-vouchers", headers=H("agent2")).json()
        assert all(v["voucher_no"] != S["pay_no"] for v in agent2_list)
        owner_list = requests.get(f"{API}/payment-vouchers", headers=H("owner")).json()
        assert any(v["voucher_no"] == S["pay_no"] for v in owner_list)

    def test_08_statement_includes_payment(self):
        st = requests.get(f"{API}/customers/{S['c1']}/statement", headers=H("agent")).json()
        pays = [r for r in st["rows"] if r["type"] == "PAYMENT"]
        assert pays, "statement must include at least one PAYMENT row"
        assert pays[0]["debit"] > 0 and pays[0]["credit"] == 0


# ---------- Warehouse returns ----------
class TestD_WarehouseReturns:
    def test_01_agent_creates_pending_and_deducts_inventory(self):
        inv = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json()
                   if i["product_id"] == S["pid"])
        S["inv_before_wrt"] = inv["quantity"]
        r = requests.post(f"{API}/warehouse-returns", headers=H("agent"),
                          json={"items": [{"product_id": S["pid"], "quantity": 2}], "notes": "spoiled"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "PENDING"
        assert d["return_no"].startswith("WRT-")
        S["wrt_id"] = d["id"]
        inv2 = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json()
                    if i["product_id"] == S["pid"])
        assert S["inv_before_wrt"] - inv2["quantity"] == 2

    def test_02_insufficient_inventory_400(self):
        r = requests.post(f"{API}/warehouse-returns", headers=H("agent"),
                          json={"items": [{"product_id": S["pid"], "quantity": 999999}]})
        assert r.status_code == 400

    def test_03_agent_cannot_accept(self):
        r = requests.post(f"{API}/warehouse-returns/{S['wrt_id']}/accept", headers=H("agent"))
        assert r.status_code == 403

    def test_04_acct_cannot_accept(self):
        r = requests.post(f"{API}/warehouse-returns/{S['wrt_id']}/accept", headers=H("acct"))
        assert r.status_code == 403

    def test_05_owner_accept_increments_stock(self):
        prod_before = next(p for p in requests.get(f"{API}/products", headers=H("owner")).json()
                           if p["id"] == S["pid"])
        r = requests.post(f"{API}/warehouse-returns/{S['wrt_id']}/accept", headers=H("owner"))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ACCEPTED"
        prod_after = next(p for p in requests.get(f"{API}/products", headers=H("owner")).json()
                          if p["id"] == S["pid"])
        assert prod_after["stock"] - prod_before["stock"] == 2

    def test_06_second_accept_404(self):
        r = requests.post(f"{API}/warehouse-returns/{S['wrt_id']}/accept", headers=H("owner"))
        assert r.status_code == 404

    def test_07_reject_restores_agent_inventory(self):
        # New pending return
        r = requests.post(f"{API}/warehouse-returns", headers=H("agent"),
                          json={"items": [{"product_id": S["pid"], "quantity": 1}]})
        wid = r.json()["id"]
        inv_after_wrt = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json()
                             if i["product_id"] == S["pid"])["quantity"]
        rej = requests.post(f"{API}/warehouse-returns/{wid}/reject", headers=H("owner"),
                            json={"reason": "wrong batch"})
        assert rej.status_code == 200, rej.text
        d = rej.json()
        assert d["status"] == "REJECTED"
        assert d.get("reject_reason") == "wrong batch"
        inv_restored = next(i for i in requests.get(f"{API}/my/inventory", headers=H("agent")).json()
                            if i["product_id"] == S["pid"])["quantity"]
        assert inv_restored - inv_after_wrt == 1
        # Second reject -> 404
        r2 = requests.post(f"{API}/warehouse-returns/{wid}/reject", headers=H("owner"),
                           json={"reason": "x"})
        assert r2.status_code == 404


# ---------- Org phone_country_code ----------
class TestE_OrgCountryCode:
    def test_set_and_get_country_code(self):
        payload = {"name": "TEST_شركة النور للتوزيع", "phone_country_code": " 00964 "}
        r = requests.put(f"{API}/org/profile", headers=H("owner"), json=payload)
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/org/profile", headers=H("owner")).json()
        # non-digits stripped, max 4
        assert g["phone_country_code"] == "0096"


# ---------- Trail ----------
class TestF_Trail:
    def test_01_agent_posts_location(self):
        r = requests.post(f"{API}/locations", headers=H("agent"),
                          json={"lat": 33.31, "lng": 44.36, "accuracy": 5})
        assert r.status_code == 200

    def test_02_staff_can_read_trail(self):
        today = datetime.now(timezone.utc).date().isoformat()
        r = requests.get(f"{API}/tracking/agents/user_test_agent/trail?date={today}", headers=H("owner"))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "date" in d and "points" in d and "visits" in d
        assert len(d["points"]) >= 1

    def test_03_acct_can_read_trail(self):
        today = datetime.now(timezone.utc).date().isoformat()
        r = requests.get(f"{API}/tracking/agents/user_test_agent/trail?date={today}", headers=H("acct"))
        assert r.status_code == 200

    def test_04_agent_cannot_read_trail(self):
        today = datetime.now(timezone.utc).date().isoformat()
        r = requests.get(f"{API}/tracking/agents/user_test_agent/trail?date={today}", headers=H("agent"))
        assert r.status_code == 403

    def test_05_bad_date_400(self):
        r = requests.get(f"{API}/tracking/agents/user_test_agent/trail?date=not-a-date", headers=H("owner"))
        assert r.status_code == 400

    def test_06_unknown_uid_404(self):
        today = datetime.now(timezone.utc).date().isoformat()
        r = requests.get(f"{API}/tracking/agents/user_does_not_exist/trail?date={today}", headers=H("owner"))
        assert r.status_code == 404


# ---------- Stale debtors ----------
class TestG_Stale:
    def test_01_make_debt_and_appears_in_stale(self):
        # Create a dedicated debtor so cross-run state can't hide it
        r = requests.post(f"{API}/customers", headers=H("agent"),
                          json={"name": "TEST_IT7_DEBTOR", "phone": "9647700000998",
                                "address": "بغداد-د", "lat": 33.31, "lng": 44.36})
        S["debtor_id"] = r.json()["id"]
        # Make an unpaid sale -> positive balance
        requests.post(f"{API}/sales", headers=H("agent"),
                      json={"customer_id": S["debtor_id"],
                            "items": [{"product_id": S["pid"], "quantity": 1, "price": 10}],
                            "paid_amount": 0})
        stale = requests.get(f"{API}/debts/stale", headers=H("owner")).json()
        assert any(c["id"] == S["debtor_id"] for c in stale), "debtor should be in /debts/stale"

    def test_02_digest_returns_count(self):
        r = requests.post(f"{API}/debts/digest", headers=H("owner"))
        assert r.status_code == 200
        d = r.json()
        assert "count" in d and d["count"] >= 1

    def test_03_digest_creates_notification_for_accountant(self):
        resp = requests.get(f"{API}/notifications", headers=H("acct")).json()
        notifs = resp.get("items", resp) if isinstance(resp, dict) else resp
        assert any(n.get("type") == "debt_digest" for n in notifs), f"no debt_digest in {len(notifs)} notifs"

    def test_04_reminded_drops_from_stale(self):
        requests.post(f"{API}/customers/{S['debtor_id']}/reminded", headers=H("agent"))
        stale = requests.get(f"{API}/debts/stale", headers=H("owner")).json()
        assert all(c["id"] != S["debtor_id"] for c in stale), "reminded customer should drop out of /debts/stale"

    def test_05_stale_requires_staff(self):
        r = requests.get(f"{API}/debts/stale", headers=H("agent"))
        assert r.status_code == 403
