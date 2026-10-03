"""Wipe ALL business data, keeping only the real developer account(s) (DEVELOPER_EMAILS in .env),
their sessions and platform configuration (plans, payment settings, app versions).
A JSON backup is written first. Run: python /app/backend/wipe_data.py
"""
import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / '.env')
KEEP_COLLECTIONS = {"plans", "app_settings", "app_versions"}
DEV_EMAILS = [e.strip().lower() for e in os.environ.get('DEVELOPER_EMAILS', '').split(',') if e.strip()]


async def main():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    names = await db.list_collection_names()
    backup = {n: await db[n].find({}, {"_id": 0}).to_list(None) for n in names}
    out = Path(__file__).with_name(f"backup_before_wipe_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    out.write_text(json.dumps(backup, default=str, ensure_ascii=False))
    devs = await db.users.find({"email": {"$in": DEV_EMAILS}, "role": "DEVELOPER"}, {"_id": 0, "user_id": 1}).to_list(50)
    dev_ids = [d["user_id"] for d in devs]
    for n in names:
        if n in KEEP_COLLECTIONS:
            continue
        if n == "users":
            r = await db.users.delete_many({"user_id": {"$nin": dev_ids}})
        elif n == "user_sessions":
            r = await db.user_sessions.delete_many({"user_id": {"$nin": dev_ids}})
        elif n == "notifications":
            r = await db.notifications.delete_many({"user_id": {"$nin": dev_ids}})
        else:
            r = await db[n].delete_many({})
        print(f"{n}: deleted {r.deleted_count}")
    print("kept developer accounts:", dev_ids, "| backup:", out.name)


asyncio.run(main())
