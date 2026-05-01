"""验证多租户测试账号登录正常"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import httpx

ACCOUNTS = [
    ("superadmin@manju.ai",  "SuperAdmin123!"),
    ("manager001@manju.ai",  "Manager123!"),
    ("manager002@manju.ai",  "Manager123!"),
    ("employer001@manju.ai", "Emp123!"),
]

async def main():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as c:
        for email, pw in ACCOUNTS:
            r = await c.post("/api/auth/login", json={"email": email, "password": pw}, timeout=8)
            if r.status_code == 200:
                data = r.json()
                print(f"  KEYS: {list(data.keys())}")
                role = data.get("role", "?")
                wid  = (data.get("workspace_id") or "NULL")[:10]
                perms = data.get("page_permissions", [])
                print(f"OK   {email:<35s} role={role:<12} workspace={wid:<12} perms={perms}")
            else:
                print(f"ERR  {email:<35s} {r.status_code} {r.text[:120]}")

asyncio.run(main())
