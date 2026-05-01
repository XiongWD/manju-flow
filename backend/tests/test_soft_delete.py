"""软删除行为测试 — Project, Episode, Scene, Character, Job"""
import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import not_deleted, get_or_none
from database.models import Project, Episode, Scene, Character, Job


# ─── helpers ────────────────────────────────────────────────────────────────

def _make_project(name="TestProject", **kw):
    p = Project(name=name, **kw)
    p.id = name.lower() + "_id"
    return p


def _make_episode(project_id, episode_no=1):
    e = Episode(project_id=project_id, episode_no=episode_no)
    e.id = f"ep_{episode_no}_id"
    return e


def _make_scene(episode_id, scene_no=1):
    s = Scene(episode_id=episode_id, scene_no=scene_no)
    s.id = f"sc_{scene_no}_id"
    return s


def _make_character(project_id):
    c = Character(project_id=project_id, name="TestChar")
    c.id = "char_id"
    return c


def _make_job(project_id=None):
    j = Job(project_id=project_id, job_type="test")
    j.id = "job_id"
    return j


# ─── SoftDeleteMixin 基本行为 ─────────────────────────────────────────────

class TestSoftDeleteMixin:
    @pytest.fixture
    async def project(self, db_session: AsyncSession):
        p = _make_project()
        db_session.add(p)
        await db_session.flush()
        return p

    @pytest.mark.asyncio
    async def test_initial_not_deleted(self, project: Project):
        assert project.deleted_at is None
        assert project.is_deleted is False

    @pytest.mark.asyncio
    async def test_soft_delete_sets_timestamp(self, project: Project, db_session: AsyncSession):
        before = datetime.now(timezone.utc)
        project.soft_delete()
        await db_session.flush()
        assert project.deleted_at is not None
        assert project.deleted_at >= before
        assert project.is_deleted is True

    @pytest.mark.asyncio
    async def test_restore_clears_timestamp(self, project: Project, db_session: AsyncSession):
        project.soft_delete()
        await db_session.flush()
        project.restore()
        await db_session.flush()
        assert project.deleted_at is None
        assert project.is_deleted is False

    @pytest.mark.asyncio
    async def test_not_deleted_filter_excludes(self, project: Project, db_session: AsyncSession):
        project.soft_delete()
        await db_session.flush()
        result = await db_session.execute(
            select(Project).where(not_deleted(Project))
        )
        items = result.scalars().all()
        assert project.id not in [p.id for p in items]

    @pytest.mark.asyncio
    async def test_not_deleted_filter_includes_active(self, project: Project, db_session: AsyncSession):
        result = await db_session.execute(
            select(Project).where(not_deleted(Project))
        )
        items = result.scalars().all()
        assert project.id in [p.id for p in items]

    @pytest.mark.asyncio
    async def test_get_or_none_filters_deleted(self, project: Project, db_session: AsyncSession):
        project.soft_delete()
        await db_session.flush()
        found = await get_or_none(db_session, Project, project.id)
        assert found is None

    @pytest.mark.asyncio
    async def test_get_or_none_include_deleted(self, project: Project, db_session: AsyncSession):
        project.soft_delete()
        await db_session.flush()
        found = await get_or_none(db_session, Project, project.id, include_deleted=True)
        assert found is not None
        assert found.id == project.id

    @pytest.mark.asyncio
    async def test_get_or_none_returns_active(self, project: Project, db_session: AsyncSession):
        found = await get_or_none(db_session, Project, project.id)
        assert found is not None
        assert found.id == project.id


# ─── 全部 5 个模型都支持软删除 ───────────────────────────────────────────

class TestAllModelsSupportSoftDelete:
    """验证每个核心模型都有 deleted_at 列且 soft_delete() 正常工作"""

    @pytest.mark.asyncio
    async def test_episode_soft_delete(self, db_session: AsyncSession):
        p = _make_project()
        db_session.add(p)
        await db_session.flush()
        e = _make_episode(p.id)
        db_session.add(e)
        await db_session.flush()

        e.soft_delete()
        await db_session.flush()

        found = await get_or_none(db_session, Episode, e.id)
        assert found is None

        # 包含已删除
        found_all = await get_or_none(db_session, Episode, e.id, include_deleted=True)
        assert found_all is not None and found_all.deleted_at is not None

    @pytest.mark.asyncio
    async def test_scene_soft_delete(self, db_session: AsyncSession):
        p = _make_project()
        db_session.add(p)
        await db_session.flush()
        e = _make_episode(p.id)
        db_session.add(e)
        await db_session.flush()
        s = _make_scene(e.id)
        db_session.add(s)
        await db_session.flush()

        s.soft_delete()
        await db_session.flush()

        found = await get_or_none(db_session, Scene, s.id)
        assert found is None

    @pytest.mark.asyncio
    async def test_character_soft_delete(self, db_session: AsyncSession):
        p = _make_project()
        db_session.add(p)
        await db_session.flush()
        c = _make_character(p.id)
        db_session.add(c)
        await db_session.flush()

        c.soft_delete()
        await db_session.flush()

        found = await get_or_none(db_session, Character, c.id)
        assert found is None

    @pytest.mark.asyncio
    async def test_job_soft_delete(self, db_session: AsyncSession):
        j = _make_job()
        db_session.add(j)
        await db_session.flush()

        j.soft_delete()
        await db_session.flush()

        found = await get_or_none(db_session, Job, j.id)
        assert found is None

    @pytest.mark.asyncio
    async def test_list_query_filters_deleted(self, db_session: AsyncSession):
        """列表查询默认不返回已删除记录"""
        p1 = _make_project("Keep")
        p2 = _make_project("Remove")
        db_session.add_all([p1, p2])
        await db_session.flush()

        p2.soft_delete()
        await db_session.flush()

        result = await db_session.execute(
            select(Project).where(not_deleted(Project))
        )
        items = result.scalars().all()
        ids = {p.id for p in items}
        assert p1.id in ids
        assert p2.id not in ids

    @pytest.mark.asyncio
    async def test_restore_reappears_in_query(self, db_session: AsyncSession):
        """恢复后重新出现在默认查询中"""
        p = _make_project("Zombie")
        db_session.add(p)
        await db_session.flush()

        p.soft_delete()
        await db_session.flush()
        assert await get_or_none(db_session, Project, p.id) is None

        p.restore()
        await db_session.flush()
        assert await get_or_none(db_session, Project, p.id) is not None
