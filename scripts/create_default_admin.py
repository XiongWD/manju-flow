#!/usr/bin/env python3
"""Create a default admin user for local development.

Usage:
  MANJU_ADMIN_EMAIL=admin@manju.local MANJU_ADMIN_PASSWORD=ChangeMe123! python backend/scripts/create_default_admin.py
  or
  python backend/scripts/create_default_admin.py --email admin@manju.local --password ChangeMe123!
"""
import asyncio
import os
import sys
import argparse

# Ensure backend package dir is on sys.path so imports like `database` work
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))       # project root
BACKEND_DIR = os.path.join(ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database.connection import async_session_factory, async_engine, Base
from database.models import User
from services.auth import hash_password


async def create_admin(email: str, password: str):
    # Ensure tables exist
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        # check any existing user
        from sqlalchemy import select, func

        count = await session.execute(select(func.count()).select_from(User))
        existing = int(count.scalar() or 0)
        if existing > 0:
            print("Database already has users; aborting creation of default admin.")
            return

        admin = User(
            email=email,
            password_hash=hash_password(password),
            display_name="Admin",
            role="admin",
        )
        session.add(admin)
        await session.commit()
        print(f"Created admin user: {email}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", help="admin email")
    parser.add_argument("--password", help="admin password")
    args = parser.parse_args()

    email = args.email or os.getenv("MANJU_ADMIN_EMAIL") or "admin@manju.local"
    password = args.password or os.getenv("MANJU_ADMIN_PASSWORD") or "ChangeMe123!"

    asyncio.run(create_admin(email, password))


if __name__ == "__main__":
    main()
