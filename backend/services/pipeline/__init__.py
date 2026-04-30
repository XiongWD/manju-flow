"""services.pipeline 包 — 公开 API

Phase 5 拆分后，所有原有公开符号通过此处 re-export，
确保 `from services.pipeline.orchestrator import ...` 不受影响。
"""

# orchestrator.py 的公开 API（直接 import orchestrator 的调用方无需改动）
from .orchestrator import (
    start_scene_job,
    start_mock_scene_job,
    retry_scene,
    cancel_job,
    get_job_with_steps,
)

# state.py 的公开 API
from .state import (
    register_progress_callback,
    get_job_progress,
    get_job_latest_progress,
)
