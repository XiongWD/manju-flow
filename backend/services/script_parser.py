"""剧本解析服务 — 基于规则的解析器"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Character, Episode, Location, ScriptIssue, ScriptParseReport, ShotImportReport


# ── 内部数据结构 ──

@dataclass
class _ParsedShot:
    """解析过程中的镜头中间表示"""
    shot_no: int
    title: str = ""
    location_name: Optional[str] = None
    character_names: list[str] = field(default_factory=list)
    dialogue_lines: list[str] = field(default_factory=list)
    action_lines: list[str] = field(default_factory=list)
    prop_hints: list[str] = field(default_factory=list)
    raw_lines: list[tuple[int, str]] = field(default_factory=list)  # (line_no, text)


@dataclass
class _ParseIssue:
    """解析过程中的问题"""
    issue_type: str
    severity: str
    line_number: int
    original_text: str
    message: str
    suggested_fix: str = ""


# ── 正则模式 ──

# 镜号: 镜头1, 镜头01, Shot 1, S01, 第1镜, 第01镜
_RE_SHOT_HEADER = re.compile(
    r"(?:^|\n)\s*(?:镜头|Shot|S|第)\s*(\d+)\s*(?:镜|号)?\s*[：:.\n]?",
    re.IGNORECASE,
)

# 地点: 【地点：xxx】, [地点:xxx], 场景：xxx
_RE_LOCATION = re.compile(
    r"[\[【](?:地点|场景|Location)[：:]\s*([^\]】]+)[\]】]|"
    r"(?:地点|场景)[：:]\s*(.+)",
    re.IGNORECASE,
)

# 动作描述 (括号内)
_RE_ACTION_IN_PAREN = re.compile(r"[（(](.+?)[）)]")

# 对白引号
_RE_DIALOGUE_QUOTED = re.compile(r"[""「『](.+?)[""」』]")

# 角色名：台词
_RE_CHAR_DIALOGUE = re.compile(r"^([^\s：:]+)[：:]\s*(.+)$")


class ScriptParser:
    """基于规则的剧本解析器"""

    def __init__(self, db: AsyncSession, project_id: str):
        self.db = db
        self.project_id = project_id
        self._character_names: list[str] = []

    async def _load_character_names(self) -> list[str]:
        """从数据库加载项目角色名列表"""
        if self._character_names:
            return self._character_names
        result = await self.db.execute(
            select(Character.name).where(Character.project_id == self.project_id)
        )
        self._character_names = [row[0] for row in result.all()]
        return self._character_names

    async def parse_episode_script(
        self,
        episode_id: str,
        script_text: str,
    ) -> tuple[ScriptParseReport, list[ShotImportReport], list[ScriptIssue]]:
        """
        解析剧本文本，返回 (parse_report, shot_reports, issues)。
        """
        await self._load_character_names()
        lines = script_text.split("\n")

        # 第一阶段：拆分为镜头块
        shots: list[_ParsedShot] = []
        issues: list[_ParseIssue] = []
        self._split_into_shots(lines, shots, issues)

        # 第二阶段：对每个镜头块提取结构化信息
        self._enrich_shots(shots, issues)

        # 第三阶段：生成 ORM 对象
        report, shot_reports, issue_models = self._build_orm(
            episode_id=episode_id,
            shots=shots,
            issues=issues,
        )

        return report, shot_reports, issue_models

    # ── 阶段一：拆分镜头 ──

    def _split_into_shots(
        self,
        lines: list[str],
        shots: list[_ParsedShot],
        issues: list[_ParseIssue],
    ) -> None:
        """按镜号标记将剧本文本拆分为镜头块"""
        current_shot: Optional[_ParsedShot] = None
        unmatched_lines: list[tuple[int, str]] = []

        for line_no_0, line in enumerate(lines):
            line_no = line_no_0 + 1  # 1-indexed
            stripped = line.strip()
            if not stripped:
                continue

            # 检查是否是镜头标题行
            m = _RE_SHOT_HEADER.match(line)
            if m:
                # 保存之前的 unmatched 行作为 issue
                if unmatched_lines:
                    for ln, txt in unmatched_lines:
                        issues.append(_ParseIssue(
                            issue_type="format_error",
                            severity="warning",
                            line_number=ln,
                            original_text=txt,
                            message="该行不属于任何镜头块",
                            suggested_fix="请确保文本以「镜头 N」格式开始每个镜头",
                        ))
                    unmatched_lines = []

                shot_no = int(m.group(1))
                current_shot = _ParsedShot(shot_no=shot_no, title=stripped)
                current_shot.raw_lines.append((line_no, stripped))
                shots.append(current_shot)
                continue

            if current_shot is not None:
                current_shot.raw_lines.append((line_no, stripped))
            else:
                unmatched_lines.append((line_no, stripped))

        # 处理末尾未匹配行
        if unmatched_lines:
            for ln, txt in unmatched_lines:
                issues.append(_ParseIssue(
                    issue_type="format_error",
                    severity="warning",
                    line_number=ln,
                    original_text=txt,
                    message="该行不属于任何镜头块（出现在第一个镜头标记之前或之后）",
                    suggested_fix="请确保所有内容都在镜头标记（如「镜头 1」）之后",
                ))

        if not shots and lines:
            # 完全没有找到镜头标记
            issues.append(_ParseIssue(
                issue_type="format_error",
                severity="error",
                line_number=1,
                original_text=lines[0][:100] if lines else "",
                message="未找到任何镜头标记（如「镜头 1」「Shot 1」「S01」「第1镜」）",
                suggested_fix="请使用「镜头 N」「Shot N」「S01」「第N镜」等格式标记镜头",
            ))

    # ── 阶段二：信息提取 ──

    def _enrich_shots(
        self,
        shots: list[_ParsedShot],
        issues: list[_ParseIssue],
    ) -> None:
        """对每个镜头块提取地点、角色、对白、动作"""
        for shot in shots:
            for line_no, text in shot.raw_lines:
                # 跳过镜头标题行（已在 title 中）
                if _RE_SHOT_HEADER.match(text):
                    continue

                # 地点
                loc_m = _RE_LOCATION.search(text)
                if loc_m:
                    shot.location_name = loc_m.group(1).strip() or loc_m.group(2).strip() if loc_m.group(2) else loc_m.group(1).strip()
                    continue

                # 括号内动作
                action_m = _RE_ACTION_IN_PAREN.search(text)
                if action_m:
                    shot.action_lines.append(action_m.group(1).strip())
                    continue

                # 引号对白
                dq_m = _RE_DIALOGUE_QUOTED.search(text)
                if dq_m:
                    shot.dialogue_lines.append(dq_m.group(1).strip())
                    # 同时尝试提取说话角色
                    prefix = text[:dq_m.start()].strip()
                    char_name = self._match_character(prefix)
                    if char_name and char_name not in shot.character_names:
                        shot.character_names.append(char_name)
                    continue

                # 角色名：台词
                cd_m = _RE_CHAR_DIALOGUE.match(text)
                if cd_m:
                    potential_name = cd_m.group(1).strip()
                    dialogue = cd_m.group(2).strip()
                    char_name = self._match_character(potential_name)
                    if char_name:
                        shot.dialogue_lines.append(dialogue)
                        if char_name not in shot.character_names:
                            shot.character_names.append(char_name)
                    else:
                        # 无法确认角色名
                        issues.append(_ParseIssue(
                            issue_type="ambiguous_character",
                            severity="warning",
                            line_number=line_no,
                            original_text=text,
                            message=f"未识别的角色名「{potential_name}」，当前项目角色列表中无此名称",
                            suggested_fix="请在项目中添加该角色，或检查角色名是否拼写正确",
                        ))
                        # 仍然记录对白
                        shot.dialogue_lines.append(dialogue)
                        if potential_name not in shot.character_names:
                            shot.character_names.append(potential_name)
                    continue

                # 未识别的文本行 → 作为动作描述或 issue
                char_name = self._match_character(text)
                if char_name:
                    # 可能是角色名单独出现（无对白）
                    if char_name not in shot.character_names:
                        shot.character_names.append(char_name)
                    issues.append(_ParseIssue(
                        issue_type="unclear_action",
                        severity="warning",
                        line_number=line_no,
                        original_text=text,
                        message=f"识别到角色「{char_name}」但该行无对白或动作描述",
                        suggested_fix="请补充对白或动作描述",
                    ))
                else:
                    # 完全无法识别 → 作为动作描述 + issue
                    shot.action_lines.append(text)
                    issues.append(_ParseIssue(
                        issue_type="unknown",
                        severity="warning",
                        line_number=line_no,
                        original_text=text,
                        message="该行无法归类为地点/角色/对白/动作，已作为动作描述处理",
                        suggested_fix="如为对白，请使用「角色名：台词」或引号格式",
                    ))

            # 如果没有地点，发出 warning
            if not shot.location_name:
                issues.append(_ParseIssue(
                    issue_type="missing_location",
                    severity="warning",
                    line_number=shot.raw_lines[0][0] if shot.raw_lines else 0,
                    original_text=shot.title,
                    message=f"镜头 {shot.shot_no} 未识别到地点信息",
                    suggested_fix="请使用【地点：xxx】或[地点:xxx]格式标注地点",
                ))

    def _match_character(self, text: str) -> Optional[str]:
        """尝试在文本中匹配已知角色名"""
        for name in self._character_names:
            if name in text:
                return name
        return None

    # ── 阶段三：构建 ORM ──

    def _build_orm(
        self,
        episode_id: str,
        shots: list[_ParsedShot],
        issues: list[_ParseIssue],
    ) -> tuple[ScriptParseReport, list[ShotImportReport], list[ScriptIssue]]:
        """将解析结果转换为 ORM 模型"""
        has_error = any(i.severity == "error" for i in issues)
        has_warning = any(i.severity == "warning" for i in issues)

        total = len(shots)
        failed = sum(1 for s in shots if not s.dialogue_lines and not s.action_lines)
        parsed = total - failed

        if total == 0:
            status = "failed"
        elif has_error:
            status = "partial"
        elif has_warning:
            status = "partial"
        else:
            status = "completed"

        report = ScriptParseReport(
            episode_id=episode_id,
            total_shots=total,
            parsed_shots=parsed,
            failed_shots=failed,
            parse_method="rule",
            status=status,
        )

        shot_reports: list[ShotImportReport] = []
        for shot in shots:
            is_empty = not shot.dialogue_lines and not shot.action_lines
            shot_r = ShotImportReport(
                parse_report_id=report.id,
                shot_no=shot.shot_no,
                title=shot.title or f"镜头 {shot.shot_no}",
                location_name=shot.location_name,
                character_names=shot.character_names if shot.character_names else None,
                dialogue="\n".join(shot.dialogue_lines) if shot.dialogue_lines else None,
                action="\n".join(shot.action_lines) if shot.action_lines else None,
                estimated_duration=self._estimate_duration(shot),
                prop_hints=shot.prop_hints if shot.prop_hints else None,
                import_status="error" if is_empty else "success",
                error_message="镜头内容为空" if is_empty else None,
            )
            shot_reports.append(shot_r)

        issue_models: list[ScriptIssue] = []
        for issue in issues:
            issue_models.append(ScriptIssue(
                parse_report_id=report.id,
                issue_type=issue.issue_type,
                severity=issue.severity,
                line_number=issue.line_number,
                original_text=issue.original_text,
                message=issue.message,
                suggested_fix=issue.suggested_fix,
            ))

        return report, shot_reports, issue_models

    @staticmethod
    def _estimate_duration(shot: _ParsedShot) -> Optional[float]:
        """简单规则估算镜头时长"""
        # 每行对白约 2-3 秒（取 2.5），每个动作描述约 1.5 秒
        dialogue_dur = len(shot.dialogue_lines) * 2.5
        action_dur = len(shot.action_lines) * 1.5
        total = dialogue_dur + action_dur
        return round(total, 1) if total > 0 else None
