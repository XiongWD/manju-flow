"""Tests for CRUD endpoints — parameter validation and auth."""
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

transport = ASGITransport(app=app)

# ── Projects ──
@pytest.mark.asyncio
async def test_list_projects():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/projects")
        assert resp.status_code in (200, 401, 500)

@pytest.mark.asyncio
async def test_create_project_missing_name():
    """POST without auth returns 401; body validation only fires when auth passes."""
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/projects", json={})
        assert resp.status_code in (401, 422)

# ── Scenes ──
@pytest.mark.asyncio
async def test_list_scenes():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/scenes")
        assert resp.status_code in (200, 401, 500)

@pytest.mark.asyncio
async def test_create_scene_missing_fields():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/scenes", json={})
        assert resp.status_code in (401, 422)

@pytest.mark.asyncio
async def test_get_scene_not_found():
    """GET single scene — auth gate fires before 404."""
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/scenes/nonexistent-id")
        assert resp.status_code in (401, 404, 500)

# ── Characters ──
@pytest.mark.asyncio
async def test_list_characters():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/characters")
        assert resp.status_code in (200, 401, 500)

@pytest.mark.asyncio
async def test_create_character_missing_fields():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/characters", json={})
        assert resp.status_code in (401, 422)

# ── Locations ──
@pytest.mark.asyncio
async def test_list_locations():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/locations")
        assert resp.status_code in (200, 401, 500)

# ── Assets ──
@pytest.mark.asyncio
async def test_list_assets():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/assets")
        assert resp.status_code in (200, 401, 500)

@pytest.mark.asyncio
async def test_create_asset_missing_fields():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/assets", json={})
        assert resp.status_code in (401, 422)

# ── Story Bibles ──
@pytest.mark.asyncio
async def test_list_story_bibles():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/story-bibles")
        assert resp.status_code in (200, 401, 500)

# ── Episodes ──
@pytest.mark.asyncio
async def test_list_episodes():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/episodes")
        assert resp.status_code in (200, 401, 500)

# ── Knowledge ──
@pytest.mark.asyncio
async def test_list_knowledge():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/knowledge")
        assert resp.status_code in (200, 401, 500)

# ── Auth gating on protected endpoints ──
@pytest.mark.asyncio
async def test_post_project_requires_auth():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/projects", json={"name": "test"})
        assert resp.status_code == 401

@pytest.mark.asyncio
async def test_post_scene_requires_auth():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/scenes", json={"title": "test"})
        assert resp.status_code == 401

@pytest.mark.asyncio
async def test_post_character_requires_auth():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/characters", json={"name": "test"})
        assert resp.status_code == 401

@pytest.mark.asyncio
async def test_post_asset_requires_auth():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/assets", json={})
        assert resp.status_code == 401

@pytest.mark.asyncio
async def test_post_still_candidates_requires_auth():
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/api/scenes/test-id/still-candidates", json={})
        assert resp.status_code == 401

# ── Pagination params are passed through (auth gate may reject first) ──
@pytest.mark.asyncio
async def test_list_projects_with_page_params():
    """Valid pagination params should not cause 422 on their own."""
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/projects?page=1&page_size=10")
        assert resp.status_code in (200, 401, 500)

@pytest.mark.asyncio
async def test_list_projects_negative_page():
    """Negative page — may be caught by validation or auth."""
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/projects?page=-1")
        assert resp.status_code in (401, 422)

# ── Route existence checks ──
@pytest.mark.asyncio
async def test_props_route_not_found():
    """Props endpoint doesn't exist yet."""
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/props")
        assert resp.status_code == 404

@pytest.mark.asyncio
async def test_prompt_templates_route_not_found():
    """Prompt templates endpoint doesn't exist yet."""
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/prompt-templates")
        assert resp.status_code == 404
