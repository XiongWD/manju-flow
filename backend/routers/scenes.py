"""Scenes router — re-exported from sub-modules."""
from routers.scenes_crud import router as crud_router
from routers.scenes_versions import router as versions_router

from fastapi import APIRouter

router = APIRouter(tags=["scenes"])

# Sub-modules have their own prefix="/api/scenes", include without additional prefix
router.include_router(crud_router)
router.include_router(versions_router)
