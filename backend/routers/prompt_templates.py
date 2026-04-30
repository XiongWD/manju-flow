
"""PromptTemplate 路由 — Prompt 模板 CRUD + Build"""
import logging
logger = logging.getLogger(__name__)


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.models import PromptTemplate, Project, User
from services.auth import get_current_user
from schemas.prompt_template import (

    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptTemplateRead,
    PromptBuildRequest,
)
from services.prompt_builder import PromptBuilder

router = APIRouter(prefix="/api", tags=["prompt-templates"])

_builder = PromptBuilder()


# ─── PromptTemplate CRUD ────────────────────────────────────────────────────

@router.get("/projects/{project_id}/prompt-templates")
async def list_prompt_templates(
    project_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取项目下的模板列表"""
    skip = (page - 1) * page_size
    limit = min(page_size, 200)
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    q = select(PromptTemplate).where(PromptTemplate.project_id == project_id)
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0
    q = q.order_by(PromptTemplate.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return {"items": result.scalars().all(), "total": total, "skip": skip, "limit": limit}


@router.post("/projects/{project_id}/prompt-templates", response_model=PromptTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_prompt_template(
    project_id: str,
    body: PromptTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建模板"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # 如果设为默认，取消其他默认模板
    if body.is_default:
        await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.project_id == project_id,
                PromptTemplate.is_default.is_(True),
            )
        )
        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.project_id == project_id,
                PromptTemplate.is_default.is_(True),
            )
        )
        for t in result.scalars().all():
            t.is_default = False

    template = PromptTemplate(project_id=project_id, **body.model_dump())
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template


@router.get("/prompt-templates/{template_id}", response_model=PromptTemplateRead)
async def get_prompt_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取模板详情"""
    template = await db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="PromptTemplate not found")
    return template


@router.put("/prompt-templates/{template_id}", response_model=PromptTemplateRead)
async def update_prompt_template(
    template_id: str,
    body: PromptTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新模板（修改 template_text 时 version 自增）"""
    template = await db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="PromptTemplate not found")

    updates = body.model_dump(exclude_unset=True)

    # 如果设为默认，取消其他默认模板
    if updates.get("is_default"):
        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.project_id == template.project_id,
                PromptTemplate.is_default.is_(True),
                PromptTemplate.id != template_id,
            )
        )
        for t in result.scalars().all():
            t.is_default = False

    # 修改模板文本时 version 自增
    if "template_text" in updates and updates["template_text"] != template.template_text:
        updates["version"] = template.version + 1

    for key, value in updates.items():
        setattr(template, key, value)
    await db.flush()
    await db.refresh(template)
    return template


@router.delete("/prompt-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除模板"""
    template = await db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="PromptTemplate not found")
    await db.delete(template)
    await db.flush()


# ─── Prompt Build ───────────────────────────────────────────────────────────

@router.post("/prompt-templates/build")
async def build_prompt(
    body: PromptBuildRequest,
    db: AsyncSession = Depends(get_db),
):
    """调用 PromptBuilder 构建完整 prompt"""
    result = await _builder.build_prompt(
        db=db,
        project_id=body.project_id,
        scene_id=body.scene_id,
        template_id=body.template_id,
        character_ids=body.character_ids,
        location_id=body.location_id,
        prop_state_ids=body.prop_state_ids,
        action_description=body.action_description,
        style_override=body.style_override,
    )
    return result
