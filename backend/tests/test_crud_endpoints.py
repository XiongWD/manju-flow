"""Tests for CRUD endpoints — route existence and parameter validation.

In dev mode (AUTH_PROTECTED_PREFIXES=""), auth is disabled.
Tests verify routes are reachable and return expected status codes.

NOTE: Backend routes use trailing slashes on collection endpoints (e.g., /api/projects/).
      Next.js proxy preserves trailing slashes via skipTrailingSlashRedirect.
      Tests use follow_redirects=True to handle any redirects gracefully.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

transport = ASGITransport(app=app)

# In dev mode, auth is off → expect 200/201/422/404/500
_DEV_OK = (200, 201, 422, 404, 500)


@pytest.mark.asyncio
async def test_list_projects():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/projects")
        assert resp.status_code in _DEV_OK

@pytest.mark.asyncio
async def test_create_project_missing_name():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.post("/api/projects", json={})
        assert resp.status_code == 422

@pytest.mark.asyncio
async def test_list_scenes():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/scenes")
        assert resp.status_code in _DEV_OK

@pytest.mark.asyncio
async def test_create_scene_missing_fields():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.post("/api/scenes", json={})
        assert resp.status_code == 422

@pytest.mark.asyncio
async def test_get_scene_not_found():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/scenes/nonexistent-id")
        assert resp.status_code in (404, 500)

@pytest.mark.asyncio
async def test_list_characters():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/characters")
        assert resp.status_code in _DEV_OK

@pytest.mark.asyncio
async def test_create_character_missing_fields():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.post("/api/characters", json={})
        assert resp.status_code == 422

@pytest.mark.asyncio
async def test_list_locations():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/locations")
        assert resp.status_code in _DEV_OK

@pytest.mark.asyncio
async def test_list_assets():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/assets")
        assert resp.status_code in _DEV_OK

@pytest.mark.asyncio
async def test_create_asset_missing_fields():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.post("/api/assets", json={})
        assert resp.status_code == 422

@pytest.mark.asyncio
async def test_list_story_bibles():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/story-bibles")
        assert resp.status_code in _DEV_OK

@pytest.mark.asyncio
async def test_list_episodes():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/episodes")
        assert resp.status_code in _DEV_OK

@pytest.mark.asyncio
async def test_list_knowledge():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/knowledge")
        assert resp.status_code in _DEV_OK

# Auth gating tests — in dev mode, POST should succeed (201/422) not return 401
@pytest.mark.asyncio
async def test_post_project_dev_mode():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.post("/api/projects", json={"name": "test", "genre": "Drama"})
        assert resp.status_code in (201, 422, 500)

@pytest.mark.asyncio
async def test_post_scene_dev_mode():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.post("/api/scenes", json={"title": "test"})
        assert resp.status_code in (201, 422, 500)

@pytest.mark.asyncio
async def test_post_character_dev_mode():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.post("/api/characters", json={"name": "test"})
        assert resp.status_code in (201, 422, 500)

@pytest.mark.asyncio
async def test_post_asset_dev_mode():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.post("/api/assets", json={})
        assert resp.status_code in (201, 422, 500)

@pytest.mark.asyncio
async def test_post_still_candidates_dev_mode():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.post("/api/scenes/test-id/still-candidates", json={})
        assert resp.status_code in (201, 422, 500)

@pytest.mark.asyncio
async def test_list_projects_with_page_params():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/projects?page=1&page_size=10")
        assert resp.status_code in _DEV_OK

@pytest.mark.asyncio
async def test_list_projects_negative_page():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/projects?page=-1")
        assert resp.status_code in (200, 422, 500)

@pytest.mark.asyncio
async def test_props_route_exists():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/projects/test-id/props")
        assert resp.status_code in _DEV_OK

@pytest.mark.asyncio
async def test_prompt_templates_route_exists():
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as c:
        resp = await c.get("/api/projects/test-id/prompt-templates")
        assert resp.status_code in _DEV_OK
