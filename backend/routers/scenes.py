"""Scenes router — re-exported from sub-modules."""
from routers.scenes_crud import router as crud_router
from routers.scenes_versions import router as versions_router

from fastapi import APIRouter

router = APIRouter(prefix="/api/scenes", tags=["scenes"])

# Merge all routes from sub-modules
router.routes.extend(crud_router.routes)
router.routes.extend(versions_router.routes)
