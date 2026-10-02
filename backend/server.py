from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import secrets
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
DEVELOPER_EMAILS = [e.strip().lower() for e in os.environ.get('DEVELOPER_EMAILS', '').split(',') if e.strip()]
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

NO_ID = {"_id": 0}


def now():
    return datetime.now(timezone.utc)


def iso():
    return now().isoformat()


def new_id():
    return uuid.uuid4().hex


def gen_code(prefix=""):
    return prefix + "-".join(secrets.token_hex(2).upper() for _ in range(3))


# ---------------- Models ----------------
class SessionIn(BaseModel):
    session_id: str


class ActivateIn(BaseModel):
    code: str


class TrialIn(BaseModel):
    org_name: str


class LicenseIn(BaseModel):
    org_name: str
    days: int = 365
    max_employees: int = 10


class OrgPatch(BaseModel):
    status: Optional[str] = None
    extend_days: Optional[int] = None


class ProductIn(BaseModel):
    name: str
    category: str = ""
    unit: str = "قطعة"
    cost_price: float = 0
    sale_price: float = 0
    stock: float = 0
    min_stock: float = 0


class CustomerIn(BaseModel):
    id: Optional[str] = None
    name: str
    phone: str = ""
    address: str = ""
    location: str = ""


class InviteIn(BaseModel):
    name: str
    employee_type: str  # FIELD_AGENT | ACCOUNTANT


class PurchaseIn(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)
    unit_cost: float = Field(ge=0)
    supplier: str = ""


class LineIn(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)


class DeliveryLine(BaseModel):
    product_id: str
    quantity: float = Field(gt=0)


class DeliveryIn(BaseModel):
    distributor_id: str
    items: List[DeliveryLine]
    notes: str = ""


class GeoMixin(BaseModel):
    id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    client_created_at: Optional[str] = None


class SaleIn(GeoMixin):
    customer_id: str
    items: List[LineIn]
    paid_amount: float = Field(ge=0, default=0)
    notes: str = ""


class CollectionIn(GeoMixin):
    customer_id: str
    amount: float = Field(gt=0)
    notes: str = ""


class ReturnIn(GeoMixin):
    customer_id: str
    items: List[LineIn]
    reason: str = ""


# ---------------- Auth ----------------
async def get_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "غير مصرح")
    token = auth[7:]
    sess = await db.user_sessions.find_one({"session_token": token}, NO_ID)
    if not sess:
        raise HTTPException(401, "الجلسة غير صالحة")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now():
        raise HTTPException(401, "انتهت الجلسة")
    user = await db.users.find_one({"user_id": sess["user_id"]}, NO_ID)
    if not user:
        raise HTTPException(401, "المستخدم غير موجود")
    return user


async def enrich(user: dict) -> dict:
    out = dict(user)
    out["org"] = None
    if user.get("org_id"):
        org = await db.organizations.find_one({"id": user["org_id"]}, NO_ID)
        out["org"] = org
    return out


def require(*roles):
    async def dep(user=Depends(get_user)):
        key = user.get("role")
        if key == "EMPLOYEE":
            key = user.get("employee_type")
        if key not in roles:
            raise HTTPException(403, "ليس لديك صلاحية")
        if key != "DEVELOPER":
            org = await db.organizations.find_one({"id": user.get("org_id")}, NO_ID)
            if not org or org["status"] != "ACTIVE":
                raise HTTPException(403, "اشتراك المؤسسة غير فعال")
            exp = datetime.fromisoformat(org["expires_at"])
            if exp < now():
                raise HTTPException(403, "انتهى اشتراك المؤسسة")
        return user
    return dep


OWNER = require("OWNER")
STAFF = require("OWNER", "ACCOUNTANT")
AGENT = require("FIELD_AGENT")
ANY_ORG = require("OWNER", "ACCOUNTANT", "FIELD_AGENT")
DEV = require("DEVELOPER")


@api.post("/auth/session")
async def auth_session(body: SessionIn):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "فشل تسجيل الدخول")
    data = r.json()
    email = data["email"].lower()
    existing = await db.users.find_one({"email": email}, NO_ID)
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        role = None
        # First real user (ignoring seeded test accounts) bootstraps as developer.
        has_dev = await db.users.find_one({"role": "DEVELOPER", "user_id": {"$not": {"$regex": "^user_test_"}}})
        if email in DEVELOPER_EMAILS or not has_dev:
            role = "DEVELOPER"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": data.get("name"), "picture": data.get("picture"),
            "role": role, "employee_type": None, "org_id": None, "created_at": iso(),
        })
    if email in DEVELOPER_EMAILS:
        await db.users.update_one({"user_id": user_id}, {"$set": {"role": "DEVELOPER"}})
    token = data["session_token"]
    await db.user_sessions.insert_one({
        "session_token": token, "user_id": user_id,
        "expires_at": now() + timedelta(days=7), "created_at": now(),
    })
    user = await db.users.find_one({"user_id": user_id}, NO_ID)
    return {"session_token": token, "user": await enrich(user)}


@api.get("/auth/me")
async def me(user=Depends(get_user)):
    return await enrich(user)


@api.post("/auth/logout")
async def logout(request: Request, user=Depends(get_user)):
    await db.user_sessions.delete_one({"session_token": request.headers["Authorization"][7:]})
    return {"ok": True}


# ---------------- Activation ----------------
@api.post("/activate")
async def activate(body: ActivateIn, user=Depends(get_user)):
    if user.get("role"):
        raise HTTPException(400, "الحساب مفعل مسبقاً")
    code = body.code.strip().upper()
    if code.startswith("EMP-"):
        inv = await db.invitations.find_one({"code": code, "used": False}, NO_ID)
        if not inv:
            raise HTTPException(400, "رمز الموظف غير صالح أو مستخدم")
        org = await db.organizations.find_one({"id": inv["org_id"]}, NO_ID)
        if not org or org["status"] != "ACTIVE":
            raise HTTPException(400, "اشتراك المؤسسة غير فعال")
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
            "role": "EMPLOYEE", "employee_type": inv["employee_type"], "org_id": inv["org_id"], "name": inv["name"] or user.get("name")}})
        await db.invitations.update_one({"code": code}, {"$set": {"used": True, "user_id": user["user_id"], "used_at": iso()}})
    else:
        lic = await db.licenses.find_one({"code": code, "status": "READY"}, NO_ID)
        if not lic:
            raise HTTPException(400, "رمز الترخيص غير صالح أو مستخدم")
        org_id = new_id()
        await db.organizations.insert_one({
            "id": org_id, "name": lic["org_name"], "owner_id": user["user_id"], "owner_email": user["email"],
            "status": "ACTIVE", "plan": "LICENSE", "max_employees": lic["max_employees"],
            "expires_at": (now() + timedelta(days=lic["days"])).isoformat(), "created_at": iso()})
        await db.licenses.update_one({"code": code}, {"$set": {"status": "ACTIVE", "org_id": org_id, "used_by": user["email"], "activated_at": iso()}})
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": "OWNER", "org_id": org_id}})
    return await enrich(await db.users.find_one({"user_id": user["user_id"]}, NO_ID))


@api.post("/trial")
async def start_trial(body: TrialIn, user=Depends(get_user)):
    if user.get("role"):
        raise HTTPException(400, "الحساب مفعل مسبقاً")
    if not body.org_name.strip():
        raise HTTPException(400, "اسم المؤسسة مطلوب")
    org_id = new_id()
    await db.organizations.insert_one({
        "id": org_id, "name": body.org_name.strip(), "owner_id": user["user_id"], "owner_email": user["email"],
        "status": "ACTIVE", "plan": "TRIAL", "max_employees": 3,
        "expires_at": (now() + timedelta(days=14)).isoformat(), "created_at": iso()})
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": "OWNER", "org_id": org_id}})
    return await enrich(await db.users.find_one({"user_id": user["user_id"]}, NO_ID))


# ---------------- Developer ----------------
@api.get("/dev/stats")
async def dev_stats(user=Depends(DEV)):
    return {
        "orgs": await db.organizations.count_documents({}),
        "active_orgs": await db.organizations.count_documents({"status": "ACTIVE"}),
        "trials": await db.organizations.count_documents({"plan": "TRIAL"}),
        "licenses_ready": await db.licenses.count_documents({"status": "READY"}),
        "users": await db.users.count_documents({}),
        "sales": await db.sales.count_documents({}),
    }


@api.get("/dev/licenses")
async def dev_licenses(user=Depends(DEV)):
    return await db.licenses.find({}, NO_ID).sort("created_at", -1).to_list(500)


@api.post("/dev/licenses")
async def dev_create_license(body: LicenseIn, user=Depends(DEV)):
    doc = {"id": new_id(), "code": gen_code("LIC-"), "org_name": body.org_name, "days": body.days,
           "max_employees": body.max_employees, "status": "READY", "created_at": iso()}
    await db.licenses.insert_one(dict(doc))
    return doc


@api.delete("/dev/licenses/{lid}")
async def dev_delete_license(lid: str, user=Depends(DEV)):
    await db.licenses.delete_one({"id": lid, "status": "READY"})
    return {"ok": True}


@api.get("/dev/orgs")
async def dev_orgs(user=Depends(DEV)):
    orgs = await db.organizations.find({}, NO_ID).sort("created_at", -1).to_list(500)
    for o in orgs:
        o["employees"] = await db.users.count_documents({"org_id": o["id"], "role": "EMPLOYEE"})
    return orgs


@api.patch("/dev/orgs/{oid}")
async def dev_patch_org(oid: str, body: OrgPatch, user=Depends(DEV)):
    org = await db.organizations.find_one({"id": oid}, NO_ID)
    if not org:
        raise HTTPException(404, "غير موجود")
    upd = {}
    if body.status in ("ACTIVE", "SUSPENDED"):
        upd["status"] = body.status
    if body.extend_days:
        base = max(datetime.fromisoformat(org["expires_at"]), now())
        upd["expires_at"] = (base + timedelta(days=body.extend_days)).isoformat()
        upd["plan"] = "LICENSE"
    await db.organizations.update_one({"id": oid}, {"$set": upd})
    return await db.organizations.find_one({"id": oid}, NO_ID)


# ---------------- Products ----------------
@api.get("/products")
async def list_products(user=Depends(ANY_ORG)):
    return await db.products.find({"org_id": user["org_id"]}, NO_ID).sort("name", 1).to_list(1000)


@api.post("/products")
async def create_product(body: ProductIn, user=Depends(OWNER)):
    doc = {"id": new_id(), "org_id": user["org_id"], **body.model_dump(), "created_at": iso()}
    await db.products.insert_one(dict(doc))
    return doc


@api.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, user=Depends(OWNER)):
    await db.products.update_one({"id": pid, "org_id": user["org_id"]}, {"$set": body.model_dump()})
    return await db.products.find_one({"id": pid}, NO_ID)


@api.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(OWNER)):
    await db.products.delete_one({"id": pid, "org_id": user["org_id"]})
    return {"ok": True}


# ---------------- Customers ----------------
@api.get("/customers")
async def list_customers(user=Depends(ANY_ORG)):
    return await db.customers.find({"org_id": user["org_id"]}, NO_ID).sort("name", 1).to_list(2000)


@api.post("/customers")
async def create_customer(body: CustomerIn, user=Depends(ANY_ORG)):
    if body.id:
        ex = await db.customers.find_one({"id": body.id, "org_id": user["org_id"]}, NO_ID)
        if ex:
            return ex
    doc = {"id": body.id or new_id(), "org_id": user["org_id"], **body.model_dump(exclude={"id"}), "balance": 0.0,
           "created_by": user["user_id"], "created_at": iso()}
    await db.customers.insert_one(dict(doc))
    return doc


@api.put("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, user=Depends(STAFF)):
    await db.customers.update_one({"id": cid, "org_id": user["org_id"]}, {"$set": body.model_dump(exclude={"id"})})
    return await db.customers.find_one({"id": cid}, NO_ID)


@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user=Depends(OWNER)):
    await db.customers.delete_one({"id": cid, "org_id": user["org_id"]})
    return {"ok": True}


@api.get("/customers/{cid}/statement")
async def customer_statement(cid: str, user=Depends(ANY_ORG)):
    q = {"org_id": user["org_id"], "customer_id": cid}
    cust = await db.customers.find_one({"id": cid, "org_id": user["org_id"]}, NO_ID)
    if not cust:
        raise HTTPException(404, "غير موجود")
    rows = []
    for s in await db.sales.find(q, NO_ID).to_list(1000):
        rows.append({"type": "SALE", "ref": s["invoice_no"], "debit": s["total"], "credit": s["paid_amount"], "date": s["created_at"]})
    for c in await db.collections.find(q, NO_ID).to_list(1000):
        rows.append({"type": "COLLECTION", "ref": c["receipt_no"], "debit": 0, "credit": c["amount"], "date": c["created_at"]})
    for r in await db.sales_returns.find(q, NO_ID).to_list(1000):
        rows.append({"type": "RETURN", "ref": r["return_no"], "debit": 0, "credit": r["total"], "date": r["created_at"]})
    rows.sort(key=lambda x: x["date"])
    return {"customer": cust, "rows": rows}


# ---------------- Employees ----------------
@api.get("/employees")
async def list_employees(user=Depends(STAFF)):
    emps = await db.users.find({"org_id": user["org_id"], "role": "EMPLOYEE"}, NO_ID).to_list(200)
    invites = await db.invitations.find({"org_id": user["org_id"], "used": False}, NO_ID).to_list(200)
    return {"employees": emps, "invitations": invites}


@api.post("/employees/invite")
async def invite_employee(body: InviteIn, user=Depends(OWNER)):
    if body.employee_type not in ("FIELD_AGENT", "ACCOUNTANT"):
        raise HTTPException(400, "نوع غير صالح")
    org = await db.organizations.find_one({"id": user["org_id"]}, NO_ID)
    count = await db.users.count_documents({"org_id": user["org_id"], "role": "EMPLOYEE"}) + \
        await db.invitations.count_documents({"org_id": user["org_id"], "used": False})
    if count >= org["max_employees"]:
        raise HTTPException(400, "تم الوصول للحد الأقصى من الموظفين")
    doc = {"id": new_id(), "org_id": user["org_id"], "code": gen_code("EMP-"), "name": body.name,
           "employee_type": body.employee_type, "used": False, "created_at": iso()}
    await db.invitations.insert_one(dict(doc))
    return doc


@api.delete("/employees/invite/{iid}")
async def delete_invite(iid: str, user=Depends(OWNER)):
    await db.invitations.delete_one({"id": iid, "org_id": user["org_id"]})
    return {"ok": True}


@api.delete("/employees/{uid}")
async def remove_employee(uid: str, user=Depends(OWNER)):
    await db.users.update_one({"user_id": uid, "org_id": user["org_id"], "role": "EMPLOYEE"},
                              {"$set": {"role": None, "employee_type": None, "org_id": None}})
    await db.distributor_inventory.delete_many({"distributor_id": uid})
    return {"ok": True}


# ---------------- Purchases (warehouse stock in) ----------------
@api.get("/purchases")
async def list_purchases(user=Depends(STAFF)):
    return await db.purchases.find({"org_id": user["org_id"]}, NO_ID).sort("created_at", -1).to_list(500)


@api.post("/purchases")
async def create_purchase(body: PurchaseIn, user=Depends(OWNER)):
    prod = await db.products.find_one({"id": body.product_id, "org_id": user["org_id"]}, NO_ID)
    if not prod:
        raise HTTPException(404, "المنتج غير موجود")
    doc = {"id": new_id(), "org_id": user["org_id"], "product_id": prod["id"], "product_name": prod["name"],
           "quantity": body.quantity, "unit_cost": body.unit_cost, "total": round(body.quantity * body.unit_cost, 2),
           "supplier": body.supplier, "created_at": iso()}
    await db.purchases.insert_one(dict(doc))
    await db.products.update_one({"id": prod["id"]}, {"$inc": {"stock": body.quantity}, "$set": {"cost_price": body.unit_cost}})
    return doc


# ---------------- Deliveries (warehouse -> distributor) ----------------
@api.get("/deliveries")
async def list_deliveries(user=Depends(ANY_ORG)):
    q = {"org_id": user["org_id"]}
    if user.get("employee_type") == "FIELD_AGENT":
        q["distributor_id"] = user["user_id"]
    return await db.deliveries.find(q, NO_ID).sort("created_at", -1).to_list(500)


@api.post("/deliveries")
async def create_delivery(body: DeliveryIn, user=Depends(OWNER)):
    dist = await db.users.find_one({"user_id": body.distributor_id, "org_id": user["org_id"], "employee_type": "FIELD_AGENT"}, NO_ID)
    if not dist:
        raise HTTPException(404, "الموزع غير موجود")
    items = []
    for it in body.items:
        prod = await db.products.find_one({"id": it.product_id, "org_id": user["org_id"]}, NO_ID)
        if not prod or prod["stock"] < it.quantity:
            raise HTTPException(400, f"الكمية غير متوفرة في المستودع: {prod['name'] if prod else ''}")
        items.append({"product_id": prod["id"], "product_name": prod["name"], "quantity": it.quantity})
    for it in items:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": -it["quantity"]}})
        await db.distributor_inventory.update_one(
            {"distributor_id": dist["user_id"], "product_id": it["product_id"]},
            {"$inc": {"quantity": it["quantity"]}, "$set": {"org_id": user["org_id"], "product_name": it["product_name"]}},
            upsert=True)
    doc = {"id": new_id(), "org_id": user["org_id"], "distributor_id": dist["user_id"], "distributor_name": dist.get("name"),
           "items": items, "notes": body.notes, "created_at": iso()}
    await db.deliveries.insert_one(dict(doc))
    return doc


@api.get("/my/inventory")
async def my_inventory(user=Depends(AGENT)):
    inv = await db.distributor_inventory.find({"distributor_id": user["user_id"], "quantity": {"$gt": 0}}, NO_ID).to_list(1000)
    prices = {p["id"]: p["sale_price"] for p in await db.products.find({"org_id": user["org_id"]}, NO_ID).to_list(1000)}
    for i in inv:
        i["sale_price"] = prices.get(i["product_id"], 0)
    return inv


@api.get("/inventory/distributors")
async def distributors_inventory(user=Depends(STAFF)):
    return await db.distributor_inventory.find({"org_id": user["org_id"], "quantity": {"$gt": 0}}, NO_ID).to_list(2000)


def geo(body) -> dict:
    return {"lat": body.lat, "lng": body.lng, "client_created_at": body.client_created_at}


# ---------------- Sales ----------------
async def next_no(org_id: str, kind: str, prefix: str) -> str:
    r = await db.counters.find_one_and_update({"org_id": org_id, "kind": kind}, {"$inc": {"n": 1}}, upsert=True, return_document=True)
    return f"{prefix}-{r['n']:05d}"


@api.get("/sales")
async def list_sales(user=Depends(ANY_ORG)):
    q = {"org_id": user["org_id"]}
    if user.get("employee_type") == "FIELD_AGENT":
        q["distributor_id"] = user["user_id"]
    return await db.sales.find(q, NO_ID).sort("created_at", -1).to_list(1000)


@api.post("/sales")
async def create_sale(body: SaleIn, user=Depends(AGENT)):
    if body.id:
        ex = await db.sales.find_one({"id": body.id, "org_id": user["org_id"]}, NO_ID)
        if ex:
            return ex
    cust = await db.customers.find_one({"id": body.customer_id, "org_id": user["org_id"]}, NO_ID)
    if not cust:
        raise HTTPException(404, "العميل غير موجود")
    if not body.items:
        raise HTTPException(400, "أضف منتجاً واحداً على الأقل")
    items, total = [], 0.0
    for it in body.items:
        inv = await db.distributor_inventory.find_one({"distributor_id": user["user_id"], "product_id": it.product_id}, NO_ID)
        if not inv or inv["quantity"] < it.quantity:
            raise HTTPException(400, f"الكمية غير متوفرة لديك: {inv['product_name'] if inv else ''}")
        line = round(it.quantity * it.price, 2)
        total += line
        items.append({"product_id": it.product_id, "product_name": inv["product_name"], "quantity": it.quantity, "price": it.price, "total": line})
    total = round(total, 2)
    paid = min(body.paid_amount, total)
    for it in items:
        await db.distributor_inventory.update_one({"distributor_id": user["user_id"], "product_id": it["product_id"]}, {"$inc": {"quantity": -it["quantity"]}})
    await db.customers.update_one({"id": cust["id"]}, {"$inc": {"balance": round(total - paid, 2)}})
    doc = {"id": body.id or new_id(), **geo(body), "org_id": user["org_id"], "invoice_no": await next_no(user["org_id"], "sale", "INV"),
           "customer_id": cust["id"], "customer_name": cust["name"], "distributor_id": user["user_id"],
           "distributor_name": user.get("name"), "items": items, "total": total, "paid_amount": paid,
           "remaining": round(total - paid, 2), "payment_type": "CASH" if paid >= total else "CREDIT",
           "notes": body.notes, "created_at": iso()}
    await db.sales.insert_one(dict(doc))
    return doc


# ---------------- Collections ----------------
@api.get("/collections")
async def list_collections(user=Depends(ANY_ORG)):
    q = {"org_id": user["org_id"]}
    if user.get("employee_type") == "FIELD_AGENT":
        q["collector_id"] = user["user_id"]
    return await db.collections.find(q, NO_ID).sort("created_at", -1).to_list(1000)


@api.post("/collections")
async def create_collection(body: CollectionIn, user=Depends(ANY_ORG)):
    cust = await db.customers.find_one({"id": body.customer_id, "org_id": user["org_id"]}, NO_ID)
    if not cust:
        raise HTTPException(404, "العميل غير موجود")
    if body.id:
        ex = await db.collections.find_one({"id": body.id, "org_id": user["org_id"]}, NO_ID)
        if ex:
            return ex
    if body.amount > cust["balance"] + 0.001:
        raise HTTPException(400, "المبلغ أكبر من دين العميل")
    await db.customers.update_one({"id": cust["id"]}, {"$inc": {"balance": -body.amount}})
    doc = {"id": body.id or new_id(), **geo(body), "org_id": user["org_id"], "receipt_no": await next_no(user["org_id"], "col", "RCV"),
           "customer_id": cust["id"], "customer_name": cust["name"], "amount": body.amount, "notes": body.notes,
           "collector_id": user["user_id"], "collector_name": user.get("name"), "created_at": iso()}
    await db.collections.insert_one(dict(doc))
    return doc


# ---------------- Sales returns ----------------
@api.get("/sales-returns")
async def list_returns(user=Depends(ANY_ORG)):
    q = {"org_id": user["org_id"]}
    if user.get("employee_type") == "FIELD_AGENT":
        q["distributor_id"] = user["user_id"]
    return await db.sales_returns.find(q, NO_ID).sort("created_at", -1).to_list(1000)


@api.post("/sales-returns")
async def create_return(body: ReturnIn, user=Depends(AGENT)):
    cust = await db.customers.find_one({"id": body.customer_id, "org_id": user["org_id"]}, NO_ID)
    if not cust:
        raise HTTPException(404, "العميل غير موجود")
    if body.id:
        ex = await db.sales_returns.find_one({"id": body.id, "org_id": user["org_id"]}, NO_ID)
        if ex:
            return ex
    items, total = [], 0.0
    for it in body.items:
        prod = await db.products.find_one({"id": it.product_id, "org_id": user["org_id"]}, NO_ID)
        if not prod:
            raise HTTPException(404, "المنتج غير موجود")
        line = round(it.quantity * it.price, 2)
        total += line
        items.append({"product_id": prod["id"], "product_name": prod["name"], "quantity": it.quantity, "price": it.price, "total": line})
        await db.distributor_inventory.update_one(
            {"distributor_id": user["user_id"], "product_id": prod["id"]},
            {"$inc": {"quantity": it.quantity}, "$set": {"org_id": user["org_id"], "product_name": prod["name"]}}, upsert=True)
    total = round(total, 2)
    await db.customers.update_one({"id": cust["id"]}, {"$inc": {"balance": -total}})
    doc = {"id": body.id or new_id(), **geo(body), "org_id": user["org_id"], "return_no": await next_no(user["org_id"], "ret", "RET"),
           "customer_id": cust["id"], "customer_name": cust["name"], "distributor_id": user["user_id"],
           "distributor_name": user.get("name"), "items": items, "total": total, "reason": body.reason, "created_at": iso()}
    await db.sales_returns.insert_one(dict(doc))
    return doc


# ---------------- Stats ----------------
async def _sum(coll, q, field):
    r = await db[coll].aggregate([{"$match": q}, {"$group": {"_id": None, "s": {"$sum": f"${field}"}}}]).to_list(1)
    return round(r[0]["s"], 2) if r else 0


@api.get("/stats/overview")
async def overview(user=Depends(ANY_ORG)):
    org = user["org_id"]
    q = {"org_id": org}
    if user.get("employee_type") == "FIELD_AGENT":
        q = {"org_id": org, "distributor_id": user["user_id"]}
    today = now().date().isoformat()
    tq = {**q, "created_at": {"$gte": today}}
    cq = {"org_id": org} if user.get("employee_type") != "FIELD_AGENT" else {"org_id": org, "collector_id": user["user_id"]}
    products = await db.products.find({"org_id": org}, NO_ID).to_list(1000)
    sales_total = await _sum("sales", q, "total")
    cost = 0.0
    if user.get("role") == "OWNER":
        costs = {p["id"]: p["cost_price"] for p in products}
        async for s in db.sales.find(q, {"items": 1}):
            cost += sum(costs.get(i["product_id"], 0) * i["quantity"] for i in s["items"])
    return {
        "sales_total": sales_total,
        "sales_count": await db.sales.count_documents(q),
        "today_sales": await _sum("sales", tq, "total"),
        "today_count": await db.sales.count_documents(tq),
        "collections_total": await _sum("collections", cq, "amount"),
        "returns_total": await _sum("sales_returns", q, "total"),
        "purchases_total": await _sum("purchases", {"org_id": org}, "total"),
        "debts_total": await _sum("customers", {"org_id": org, "balance": {"$gt": 0}}, "balance"),
        "customers": await db.customers.count_documents({"org_id": org}),
        "products": len(products),
        "low_stock": [p for p in products if p["stock"] <= p["min_stock"]][:10],
        "stock_value": round(sum(p["stock"] * p["cost_price"] for p in products), 2),
        "gross_profit": round(sales_total - cost, 2) if user.get("role") == "OWNER" else None,
        "recent_sales": await db.sales.find(q, NO_ID).sort("created_at", -1).to_list(5),
    }


@api.get("/stats/agents")
async def agents_performance(user=Depends(STAFF)):
    agents = await db.users.find({"org_id": user["org_id"], "employee_type": "FIELD_AGENT"}, NO_ID).to_list(200)
    out = []
    for a in agents:
        q = {"org_id": user["org_id"], "distributor_id": a["user_id"]}
        out.append({"user_id": a["user_id"], "name": a.get("name"), "email": a["email"],
                    "sales_total": await _sum("sales", q, "total"), "sales_count": await db.sales.count_documents(q),
                    "collections_total": await _sum("collections", {"org_id": user["org_id"], "collector_id": a["user_id"]}, "amount")})
    return out


# ---------------- Extensions: org profile/logo, plans, upgrades, reports, GPS ----------------
import base64
import requests
from fastapi.concurrency import run_in_threadpool

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "smart-system"
_storage_key = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


class OrgProfileIn(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    tax_no: str = ""
    cr_no: str = ""
    invoice_footer: str = ""


class LogoIn(BaseModel):
    data: str  # base64
    content_type: str = "image/jpeg"


class PlanIn(BaseModel):
    name: str
    price: float = Field(ge=0)
    currency: str = "USD"
    days: int = Field(gt=0, default=30)
    max_employees: int = Field(gt=0, default=5)
    features: List[str] = []
    active: bool = True


class PaymentSettingsIn(BaseModel):
    payment_address: str = ""
    whatsapp: str = ""
    instructions: str = ""


class UpgradeIn(BaseModel):
    plan_id: str
    payment_ref: str
    notes: str = ""


class ReviewIn(BaseModel):
    action: str  # approve | reject
    note: str = ""


class LocationIn(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None


PROFILE_FIELDS = ["name", "phone", "email", "address", "tax_no", "cr_no", "invoice_footer"]


@api.get("/org/profile")
async def org_profile(user=Depends(ANY_ORG)):
    org = await db.organizations.find_one({"id": user["org_id"]}, NO_ID)
    return {**{k: org.get(k, "") for k in PROFILE_FIELDS}, "has_logo": bool(org.get("logo_path"))}


@api.put("/org/profile")
async def update_org_profile(body: OrgProfileIn, user=Depends(OWNER)):
    if not body.name.strip():
        raise HTTPException(400, "اسم المؤسسة مطلوب")
    await db.organizations.update_one({"id": user["org_id"]}, {"$set": body.model_dump()})
    return await org_profile(user)


@api.post("/org/logo")
async def upload_logo(body: LogoIn, user=Depends(OWNER)):
    try:
        raw = base64.b64decode(body.data.split(",")[-1])
    except Exception:
        raise HTTPException(400, "صورة غير صالحة")
    if len(raw) > 1_500_000:
        raise HTTPException(400, "حجم الشعار كبير جداً (الحد 1.5MB)")
    ext = "png" if "png" in body.content_type else "jpg"
    path = f"{APP_NAME}/uploads/{user['org_id']}/{uuid.uuid4().hex}.{ext}"
    try:
        res = await run_in_threadpool(put_object, path, raw, body.content_type)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 402:
            raise HTTPException(402, "رصيد التخزين غير كافٍ")
        raise HTTPException(502, "فشل رفع الشعار")
    await db.organizations.update_one({"id": user["org_id"]}, {"$set": {"logo_path": res["path"], "logo_type": body.content_type}})
    return {"ok": True}


@api.get("/org/logo")
async def get_logo(user=Depends(ANY_ORG)):
    org = await db.organizations.find_one({"id": user["org_id"]}, NO_ID)
    if not org.get("logo_path"):
        return {"data_uri": None}
    try:
        data, ctype = await run_in_threadpool(get_object, org["logo_path"])
    except Exception:
        return {"data_uri": None}
    return {"data_uri": f"data:{ctype};base64,{base64.b64encode(data).decode()}"}


# ---- Plans (developer managed, visible to owners) ----
@api.get("/plans")
async def list_plans(user=Depends(get_user)):
    q = {} if user.get("role") == "DEVELOPER" else {"active": True}
    return await db.plans.find(q, NO_ID).sort("price", 1).to_list(100)


@api.post("/dev/plans")
async def create_plan(body: PlanIn, user=Depends(DEV)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": iso()}
    await db.plans.insert_one(dict(doc))
    return doc


@api.put("/dev/plans/{pid}")
async def update_plan(pid: str, body: PlanIn, user=Depends(DEV)):
    await db.plans.update_one({"id": pid}, {"$set": body.model_dump()})
    return await db.plans.find_one({"id": pid}, NO_ID)


@api.delete("/dev/plans/{pid}")
async def delete_plan(pid: str, user=Depends(DEV)):
    await db.plans.delete_one({"id": pid})
    return {"ok": True}


@api.get("/settings/payment")
async def payment_settings(user=Depends(get_user)):
    s = await db.app_settings.find_one({"key": "payment"}, NO_ID) or {}
    return {k: s.get(k, "") for k in ("payment_address", "whatsapp", "instructions")}


@api.put("/dev/settings/payment")
async def update_payment_settings(body: PaymentSettingsIn, user=Depends(DEV)):
    await db.app_settings.update_one({"key": "payment"}, {"$set": {"key": "payment", **body.model_dump()}}, upsert=True)
    return body.model_dump()


# ---- Upgrade requests (owner may submit even when expired) ----
async def owner_any(user=Depends(get_user)):
    if user.get("role") != "OWNER":
        raise HTTPException(403, "ليس لديك صلاحية")
    return user


@api.get("/upgrade-requests")
async def list_upgrades(user=Depends(get_user)):
    if user.get("role") == "DEVELOPER":
        q = {}
    elif user.get("role") == "OWNER":
        q = {"org_id": user["org_id"]}
    else:
        raise HTTPException(403, "ليس لديك صلاحية")
    return await db.upgrade_requests.find(q, NO_ID).sort("created_at", -1).to_list(500)


@api.post("/upgrade-requests")
async def create_upgrade(body: UpgradeIn, user=Depends(owner_any)):
    plan = await db.plans.find_one({"id": body.plan_id, "active": True}, NO_ID)
    if not plan:
        raise HTTPException(404, "الخطة غير متاحة")
    if not body.payment_ref.strip():
        raise HTTPException(400, "أدخل رقم/مرجع عملية الدفع")
    if await db.upgrade_requests.find_one({"org_id": user["org_id"], "status": "PENDING"}):
        raise HTTPException(400, "لديك طلب قيد المراجعة بالفعل")
    org = await db.organizations.find_one({"id": user["org_id"]}, NO_ID)
    doc = {"id": new_id(), "org_id": org["id"], "org_name": org["name"], "owner_email": user["email"],
           "plan_id": plan["id"], "plan_name": plan["name"], "price": plan["price"], "currency": plan["currency"],
           "days": plan["days"], "max_employees": plan["max_employees"], "payment_ref": body.payment_ref.strip(),
           "notes": body.notes, "status": "PENDING", "created_at": iso()}
    await db.upgrade_requests.insert_one(dict(doc))
    return doc


@api.patch("/dev/upgrade-requests/{rid}")
async def review_upgrade(rid: str, body: ReviewIn, user=Depends(DEV)):
    req = await db.upgrade_requests.find_one({"id": rid, "status": "PENDING"}, NO_ID)
    if not req:
        raise HTTPException(404, "الطلب غير موجود أو تمت مراجعته")
    if body.action == "approve":
        org = await db.organizations.find_one({"id": req["org_id"]}, NO_ID)
        base = max(datetime.fromisoformat(org["expires_at"]), now())
        await db.organizations.update_one({"id": org["id"]}, {"$set": {
            "plan": "LICENSE", "plan_name": req["plan_name"], "max_employees": req["max_employees"], "status": "ACTIVE",
            "expires_at": (base + timedelta(days=req["days"])).isoformat()}})
        status = "APPROVED"
    elif body.action == "reject":
        status = "REJECTED"
    else:
        raise HTTPException(400, "إجراء غير صالح")
    await db.upgrade_requests.update_one({"id": rid}, {"$set": {"status": status, "review_note": body.note, "reviewed_at": iso()}})
    return await db.upgrade_requests.find_one({"id": rid}, NO_ID)


# ---- Reports ----
def _bucket(dt: datetime, period: str) -> str:
    if period == "month":
        return dt.strftime("%Y-%m")
    if period == "week":
        return (dt - timedelta(days=dt.weekday())).date().isoformat()
    return dt.date().isoformat()


@api.get("/stats/reports")
async def reports(period: str = "day", user=Depends(STAFF)):
    if period not in ("day", "week", "month"):
        raise HTTPException(400, "فترة غير صالحة")
    n = {"day": 7, "week": 8, "month": 6}[period]
    today = now()
    keys = []
    for i in range(n - 1, -1, -1):
        if period == "day":
            d = today - timedelta(days=i)
        elif period == "week":
            d = today - timedelta(weeks=i)
        else:
            y, m = today.year, today.month - i
            while m <= 0:
                m += 12
                y -= 1
            d = today.replace(year=y, month=m, day=1)
        keys.append(_bucket(d, period))
    start = keys[0] if period != "month" else keys[0] + "-01"
    buckets = {k: {"key": k, "sales": 0.0, "collections": 0.0, "returns": 0.0, "profit": 0.0, "count": 0} for k in keys}
    org = user["org_id"]
    is_owner = user.get("role") == "OWNER"
    costs = {p["id"]: p["cost_price"] for p in await db.products.find({"org_id": org}, NO_ID).to_list(2000)}
    async for s in db.sales.find({"org_id": org, "created_at": {"$gte": start}}, NO_ID):
        k = _bucket(datetime.fromisoformat(s["created_at"]), period)
        if k in buckets:
            b = buckets[k]
            b["sales"] += s["total"]
            b["count"] += 1
            b["profit"] += s["total"] - sum(costs.get(i["product_id"], 0) * i["quantity"] for i in s["items"])
    async for c in db.collections.find({"org_id": org, "created_at": {"$gte": start}}, NO_ID):
        k = _bucket(datetime.fromisoformat(c["created_at"]), period)
        if k in buckets:
            buckets[k]["collections"] += c["amount"]
    async for r in db.sales_returns.find({"org_id": org, "created_at": {"$gte": start}}, NO_ID):
        k = _bucket(datetime.fromisoformat(r["created_at"]), period)
        if k in buckets:
            buckets[k]["returns"] += r["total"]
            buckets[k]["profit"] -= r["total"] - sum(costs.get(i["product_id"], 0) * i["quantity"] for i in r["items"])
    rows = []
    for k in keys:
        b = buckets[k]
        for f in ("sales", "collections", "returns", "profit"):
            b[f] = round(b[f], 2)
        if not is_owner:
            b["profit"] = None
        rows.append(b)
    totals = {f: round(sum((r[f] or 0) for r in rows), 2) for f in ("sales", "collections", "returns", "profit", "count")}
    if not is_owner:
        totals["profit"] = None
    return {"period": period, "rows": rows, "totals": totals}


# ---- GPS tracking ----
@api.post("/locations")
async def post_location(body: LocationIn, user=Depends(AGENT)):
    loc = {"lat": body.lat, "lng": body.lng, "accuracy": body.accuracy, "at": iso()}
    await db.agent_locations.insert_one({"org_id": user["org_id"], "user_id": user["user_id"], **loc})
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_location": loc}})
    return {"ok": True}


@api.get("/tracking/agents")
async def tracking_agents(user=Depends(STAFF)):
    agents = await db.users.find({"org_id": user["org_id"], "employee_type": "FIELD_AGENT"}, NO_ID).to_list(200)
    today = now().date().isoformat()
    out = []
    for a in agents:
        visits = await db.sales.find({"distributor_id": a["user_id"], "created_at": {"$gte": today}, "lat": {"$ne": None}},
                                     {"_id": 0, "invoice_no": 1, "customer_name": 1, "lat": 1, "lng": 1, "total": 1}).to_list(100)
        out.append({"user_id": a["user_id"], "name": a.get("name"), "email": a["email"],
                    "last_location": a.get("last_location"), "today_visits": visits})
    return out


@api.get("/")
async def root():
    return {"message": "Smart System API"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.licenses.create_index("code", unique=True)
    await db.invitations.create_index("code", unique=True)
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.error(f"storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
