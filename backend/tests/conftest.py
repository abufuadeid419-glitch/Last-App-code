import os

import pytest
from dotenv import load_dotenv
from pymongo import MongoClient

FIXED_IDS = ["test-idem-cust-fixed-id", "sale-idem-fixed-1", "col-idem-fixed-1", "ret-idem-fixed-1", "test-stockreq-fixed-1"]


@pytest.fixture(scope="session", autouse=True)
def purge_fixed_id_docs():
    """Idempotency tests use fixed client ids; remove leftovers so reruns start clean."""
    load_dotenv("/app/backend/.env")
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    for name in ("customers", "sales", "collections", "sales_returns", "stock_requests"):
        db[name].delete_many({"id": {"$in": FIXED_IDS}})
    yield
