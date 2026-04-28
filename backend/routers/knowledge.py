"""知识沉淀路由 — stub"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/")
async def list_knowledge_items():
    """获取知识条目列表（stub）"""
    return {"message": "knowledge items list — 待实现", "data": []}


@router.get("/{item_id}")
async def get_knowledge_item(item_id: str):
    """获取单个知识条目（stub）"""
    return {"message": f"knowledge item {item_id} — 待实现", "data": None}
