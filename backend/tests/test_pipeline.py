"""Tests for pipeline modules — import and structure verification."""
import pytest


# ── Import verification ──
def test_import_steps():
    from services.pipeline import steps
    assert steps is not None


def test_import_orchestrator():
    from services.pipeline import orchestrator
    assert orchestrator is not None


def test_import_state():
    from services.pipeline import state
    assert hasattr(state, 'register_progress_callback')


def test_import_version_lock():
    from services.pipeline import version_lock
    assert hasattr(version_lock, 'VersionLockService')


def test_import_runner():
    from services.pipeline import runner
    assert hasattr(runner, 'check_still_locked')


def test_import_analytics():
    from services.pipeline import analytics
    assert hasattr(analytics, 'AnalyticsService')


def test_import_c2pa():
    from services.pipeline import c2pa
    assert hasattr(c2pa, 'C2PASigner')


def test_import_export_recheck():
    from services.pipeline import export_recheck
    assert hasattr(export_recheck, 'ExportRechecker')


def test_import_publish():
    from services.pipeline import publish
    assert hasattr(publish, 'PublishJobService')


def test_import_compliance_assets():
    from services.pipeline import compliance_assets
    assert hasattr(compliance_assets, 'ComplianceAssetifier')


# ── Datetime usage check ──
def test_no_utcnow_in_pipeline():
    """Verify no deprecated datetime.utcnow() in pipeline code."""
    import subprocess
    result = subprocess.run(
        ["grep", "-r", "datetime.utcnow()", "services/pipeline/", "--include=*.py"],
        capture_output=True, text=True, cwd="/home/hand/work/manju/backend"
    )
    assert result.returncode != 0, f"Found datetime.utcnow(): {result.stdout}"


# ── Print usage check ──
def test_no_print_in_pipeline():
    """Verify no print() calls in pipeline code."""
    import subprocess
    result = subprocess.run(
        ["grep", "-r", "print(", "services/pipeline/", "--include=*.py"],
        capture_output=True, text=True, cwd="/home/hand/work/manju/backend"
    )
    assert result.returncode != 0, f"Found print(): {result.stdout}"
