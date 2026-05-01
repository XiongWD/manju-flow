"use client";

import { GlassChip } from "@/components/ui/primitives";
import { getStatusTone, getJobStatusText } from "./utils";

// ─── Scene/Version Status Badges ─────────────────────────────

export function SceneStatusBadge({ status }: { status: string | null | undefined }) {
  const tone = getStatusTone(status);
  return (
    <GlassChip tone={tone} className="text-xs">
      {status || '未知'}
    </GlassChip>
  );
}

export function VersionStatusBadge({ status }: { status: string | null | undefined }) {
  const tone = getStatusTone(status);
  return (
    <GlassChip tone={tone} className="text-xs">
      {status || '未知'}
    </GlassChip>
  );
}

// ─── Job Status Mini ──────────────────────────────────────────

interface LatestProgress {
  step: string;
  status: string;
  message: string;
  timestamp: string;
}

export function TaskStatusMini({
  status,
  latestProgress,
}: {
  status: string | null | undefined;
  latestProgress?: LatestProgress | null;
}) {
  const tone = getStatusTone(status);
  const displayStatus = getJobStatusText(status);
  const isRunning = status === 'RUNNING' || status === 'running';

  return (
    <div className="flex items-center gap-2">
      <GlassChip tone={tone} className="text-xs">
        {displayStatus}
      </GlassChip>
      {isRunning && latestProgress && (
        <span
          className="text-xs text-zinc-500 max-w-[200px] truncate"
          title={latestProgress.message}
        >
          {latestProgress.step}: {latestProgress.message}
        </span>
      )}
    </div>
  );
}

// ─── Lock Status Badge ────────────────────────────────────────

export function LockStatusBadge({
  isLocked,
  isCurrentVersionLocked,
  lockedVersionNo,
}: {
  isLocked: boolean;
  isCurrentVersionLocked: boolean;
  lockedVersionNo?: number;
}) {
  if (!isLocked) return null;

  return (
    <GlassChip tone={isCurrentVersionLocked ? 'info' : 'warning'} className="text-xs">
      {isCurrentVersionLocked && lockedVersionNo
        ? `🔒 锁定 v${lockedVersionNo}`
        : '🔒 已锁定其他版本'}
    </GlassChip>
  );
}
