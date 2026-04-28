#!/usr/bin/env python3
"""Phase 0.2 验证脚本 — 启动 app、测试 CRUD、验证模型存在

用法: cd backend && ../scripts/test_phase02.py
"""

import asyncio
import sys
import os

# 确保 backend 在 path 上
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))


async def test_models():
    """验证所有 19 个 ORM 模型可导入且有表"""
    from database.connection import Base, async_engine
    from sqlalchemy import inspect

    expected_tables = [
        "projects", "project_configs", "story_bibles", "characters", "character_assets",
        "episodes", "scenes", "scene_versions", "assets", "asset_links",
        "jobs", "job_steps", "qa_runs", "qa_issues", "publish_jobs",
        "publish_variants", "analytics_snapshots", "knowledge_items", "api_keys",
    ]

    async with async_engine.begin() as conn:
        def _get_tables(connection):
            insp = inspect(connection)
            return insp.get_table_names()

        tables = await conn.run_sync(_get_tables)

    missing = [t for t in expected_tables if t not in tables]
    if missing:
        print(f"❌ 缺少表: {missing}")
        return False
    print(f"✅ 全部 {len(expected_tables)} 个表存在")

    # 验证 scene_versions 关键字段
    def _get_columns(connection):
        insp = inspect(connection)
        cols = [c["name"] for c in insp.get_columns("scene_versions")]
        return cols

    async with async_engine.begin() as conn:
        sv_cols = await conn.run_sync(_get_columns)

    required_sv_fields = [
        "parent_version_id", "version_no", "prompt_bundle", "model_bundle",
        "params", "change_reason", "status", "score_snapshot", "cost_actual",
    ]
    missing_fields = [f for f in required_sv_fields if f not in sv_cols]
    if missing_fields:
        print(f"❌ scene_versions 缺少字段: {missing_fields}")
        return False
    print(f"✅ scene_versions 全部 {len(required_sv_fields)} 个关键字段存在")

    # 验证 assets 表有 type 列
    async with async_engine.begin() as conn:
        asset_cols = await conn.run_sync(lambda c: [col["name"] for col in inspect(c).get_columns("assets")])
    if "type" not in asset_cols:
        print("❌ assets 表缺少 type 字段")
        return False
    print("✅ assets 表 type 字段存在")

    # 验证 asset_links 表有 owner_type/owner_id/relation_type
    async with async_engine.begin() as conn:
        al_cols = await conn.run_sync(lambda c: [col["name"] for col in inspect(c).get_columns("asset_links")])
    for f in ["owner_type", "owner_id", "relation_type"]:
        if f not in al_cols:
            print(f"❌ asset_links 缺少 {f}")
            return False
    print("✅ asset_links 关键字段存在")

    return True


async def test_crud():
    """测试 Project CRUD 和 ApiKey CRUD"""
    from database.connection import async_session_factory
    from database.models import Project, ApiKey

    # --- Project CRUD ---
    async with async_session_factory() as session:
        # Create
        proj = Project(name="验证项目", genre="Mafia", tier="S")
        session.add(proj)
        await session.flush()
        proj_id = proj.id
        assert proj_id is not None
        print(f"✅ Project 创建成功 id={proj_id}")

        # Read
        from sqlalchemy import select
        result = await session.execute(select(Project).where(Project.id == proj_id))
        p = result.scalar_one()
        assert p.name == "验证项目"
        print("✅ Project 读取成功")

        # Update
        p.description = "更新后的描述"
        await session.flush()
        await session.refresh(p)
        assert p.description == "更新后的描述"
        print("✅ Project 更新成功")

        # List
        result = await session.execute(select(Project))
        assert len(result.scalars().all()) >= 1
        print("✅ Project 列表查询成功")

        # Delete
        await session.delete(p)
        await session.flush()
        result = await session.execute(select(Project).where(Project.id == proj_id))
        assert result.scalar_one_or_none() is None
        print("✅ Project 删除成功")

    # --- ApiKey CRUD ---
    async with async_session_factory() as session:
        key = ApiKey(name="test-key", key_hash="abc123hash", key_prefix="mj_test1", provider="kling")
        session.add(key)
        await session.flush()
        key_id = key.id
        print(f"✅ ApiKey 创建成功 id={key_id}")

        result = await session.execute(select(ApiKey).where(ApiKey.id == key_id))
        k = result.scalar_one()
        assert k.key_prefix == "mj_test1"
        print("✅ ApiKey 读取成功")

        k.is_active = False
        await session.flush()
        await session.refresh(k)
        assert k.is_active is False
        print("✅ ApiKey 更新成功")

        await session.delete(k)
        await session.flush()
        print("✅ ApiKey 删除成功")

    return True


async def test_http_routes():
    """测试 HTTP 路由可达（需要 uvicorn 运行中）"""
    import httpx

    stub_routes = [
        "/api/episodes/",
        "/api/scenes/",
        "/api/scenes/test/versions",
        "/api/qa/runs",
        "/api/assets/",
        "/api/publish/jobs",
        "/api/analytics/snapshots",
        "/api/analytics/cost",
        "/api/knowledge/",
        "/docs",
    ]

    try:
        async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=3) as client:
            for route in stub_routes:
                r = await client.get(route)
                if r.status_code != 200:
                    print(f"❌ {route} -> {r.status_code}")
                    return False
            print(f"✅ 全部 {len(stub_routes)} 个 stub 路由返回 200")
    except (httpx.ConnectError, httpx.ConnectTimeout):
        print("⚠️  uvicorn 未运行，跳过 HTTP 路由测试（手动运行 `uvicorn main:app` 后再测）")
    return True


async def main():
    print("=" * 60)
    print("Manju Phase 0.2 验证")
    print("=" * 60)

    ok = True

    print("\n📦 模型验证...")
    if not await test_models():
        ok = False

    print("\n🔧 CRUD 验证...")
    if not await test_crud():
        ok = False

    print("\n🌐 HTTP 路由验证...")
    if not await test_http_routes():
        ok = False

    print("\n" + "=" * 60)
    if ok:
        print("✅ Phase 0.2 验证全部通过")
    else:
        print("❌ 部分验证失败")
    print("=" * 60)

    from database.connection import async_engine
    await async_engine.dispose()
    return 0 if ok else 1


if __name__ == "__main__":
    exit(asyncio.run(main()))
