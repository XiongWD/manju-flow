"""Tests that DELETE endpoints require authentication."""
import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def auth_headers():
    # We need a valid token to test that authenticated requests work
    # For now, test that unauthenticated requests get 401/403
    return {}


@pytest.mark.asyncio
async def test_delete_project_requires_auth(client):
    resp = await client.delete("/api/projects/nonexistent-id")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_scene_requires_auth(client):
    resp = await client.delete("/api/scenes/nonexistent-id")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_character_requires_auth(client):
    resp = await client.delete("/api/characters/nonexistent-id")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_location_requires_auth(client):
    resp = await client.delete("/api/locations/nonexistent-id")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_story_bible_requires_auth(client):
    resp = await client.delete("/api/story-bibles/nonexistent-id")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_prop_requires_auth(client):
    resp = await client.delete("/api/props/nonexistent-id")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_apikey_requires_auth(client):
    resp = await client.delete("/api/apikeys/nonexistent-id")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_asset_requires_auth(client):
    resp = await client.delete("/api/assets/nonexistent-id")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_delete_prompt_template_requires_auth(client):
    resp = await client.delete("/api/prompt-templates/nonexistent-id")
    assert resp.status_code in (401, 403)
