"""Seed test users + sessions for testing (Google auth can't be automated).
Run: python /app/backend/seed_test.py
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / '.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

ORG = "org_test_1"
USERS = [
    ("user_test_dev", "dev@test.com", "مطور تجريبي", "DEVELOPER", None, None, "test_token_dev"),
    ("user_test_owner", "owner@test.com", "أحمد المالك", "OWNER", None, ORG, "test_token_owner"),
    ("user_test_agent", "agent@test.com", "سامر الموزع", "EMPLOYEE", "FIELD_AGENT", ORG, "test_token_agent"),
    ("user_test_agent2", "agent2@test.com", "كريم الموزع", "EMPLOYEE", "FIELD_AGENT", ORG, "test_token_agent2"),
    ("user_test_acct", "acct@test.com", "ليلى المحاسبة", "EMPLOYEE", "ACCOUNTANT", ORG, "test_token_acct"),
    ("user_test_new", "new@test.com", "مستخدم جديد", None, None, None, "test_token_new"),
]


async def main():
    now = datetime.now(timezone.utc)
    await db.organizations.update_one({"id": ORG}, {"$set": {
        "id": ORG, "name": "شركة النور للتوزيع", "owner_id": "user_test_owner", "owner_email": "owner@test.com",
        "status": "ACTIVE", "plan": "LICENSE", "max_employees": 10,
        "expires_at": (now + timedelta(days=365)).isoformat(), "created_at": now.isoformat()}}, upsert=True)
    for uid, email, name, role, et, org, tok in USERS:
        await db.users.update_one({"email": email}, {"$set": {
            "user_id": uid, "email": email, "name": name, "picture": None, "role": role,
            "employee_type": et, "org_id": org, "created_at": now.isoformat(),
            "consent_at": None if uid == "user_test_new" else now.isoformat()}}, upsert=True)
        await db.user_sessions.update_one({"session_token": tok}, {"$set": {
            "session_token": tok, "user_id": uid, "expires_at": now + timedelta(days=30), "created_at": now}}, upsert=True)
    client.close()
    print("seeded")


asyncio.run(main())
