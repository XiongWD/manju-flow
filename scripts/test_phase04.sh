#!/bin/bash
# Phase 0.4 + 0.5 + 0.6 验收测试脚本
# 使用方法: bash scripts/test_phase04.sh

set -uo pipefail

PASS=0
FAIL=0
WARN=0
MANJU_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$MANJU_ROOT/frontend"
BACKEND="$MANJU_ROOT/backend"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() { ((PASS++)); echo -e "${GREEN}✓ $1${NC}"; }
fail() { ((FAIL++)); echo -e "${RED}✗ $1${NC}"; }
warn() { ((WARN++)); echo -e "${YELLOW}⚠ $1${NC}"; }

echo "========================================="
echo "  Manju Phase 0.4 + 0.5 + 0.6 验收测试"
echo "========================================="
echo ""

# ── 1. 文件结构检查 ──
echo "── 1. 文件结构检查 ──"

required_files=(
  "frontend/package.json"
  "frontend/tsconfig.json"
  "frontend/vite.config.ts"
  "frontend/tailwind.config.ts"
  "frontend/postcss.config.js"
  "frontend/components.json"
  "frontend/index.html"
  "frontend/src/main.tsx"
  "frontend/src/App.tsx"
  "frontend/src/index.css"
  "frontend/src/lib/utils.ts"
  "frontend/src/lib/api.ts"
  "frontend/src/stores/projectStore.ts"
  "frontend/src/types/index.ts"
  "frontend/src/components/layout/Sidebar.tsx"
  "frontend/src/components/layout/Header.tsx"
  "frontend/src/components/layout/AppLayout.tsx"
  "frontend/src/components/ui/button.tsx"
  "frontend/src/components/ui/input.tsx"
  "frontend/src/components/ui/dialog.tsx"
  "frontend/src/components/ui/table.tsx"
  "frontend/src/components/ui/badge.tsx"
  "frontend/src/components/ui/tabs.tsx"
  "frontend/src/components/ui/card.tsx"
  "frontend/src/components/ui/skeleton.tsx"
  "frontend/src/components/ui/dropdown-menu.tsx"
  "frontend/src/components/ui/label.tsx"
  "frontend/src/pages/Dashboard.tsx"
  "frontend/src/pages/Projects.tsx"
  "frontend/src/pages/ProjectDetail.tsx"
  "frontend/src/pages/StoryCharacters.tsx"
  "frontend/src/pages/ShotEditor.tsx"
  "frontend/src/pages/RenderQueue.tsx"
  "frontend/src/pages/QACenter.tsx"
  "frontend/src/pages/AssetBrowser.tsx"
  "frontend/src/pages/EditDelivery.tsx"
  "frontend/src/pages/Analytics.tsx"
  "frontend/src/pages/Settings.tsx"
  "frontend/.gitignore"
)

for f in "${required_files[@]}"; do
  if [ -f "$MANJU_ROOT/$f" ]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done

echo ""

# ── 2. TypeScript 编译检查 ──
echo "── 2. TypeScript 编译检查 ──"
if (cd "$FRONTEND" && npx tsc --noEmit 2>&1); then
  pass "TypeScript compiles without errors"
else
  fail "TypeScript compilation failed"
fi

echo ""

# ── 3. Vite 构建检查 ──
echo "── 3. Vite 构建检查 ──"
if (cd "$FRONTEND" && npx vite build 2>&1 | tail -5); then
  pass "Vite build succeeds"
else
  fail "Vite build failed"
fi

echo ""

# ── 4. 路由检查（App.tsx 中定义的路由） ──
echo "── 4. 路由定义检查 ──"
routes=(
  'path="/"'
  'path="/projects"'
  'path="/projects/:id"'
  'path="/projects/:id/story"'
  'path="/projects/:id/shots"'
  'path="/render"'
  'path="/qa"'
  'path="/assets"'
  'path="/delivery"'
  'path="/analytics"'
  'path="/settings"'
)

for route in "${routes[@]}"; do
  if grep -q "$route" "$FRONTEND/src/App.tsx"; then
    pass "Route $route defined"
  else
    fail "Route $route missing"
  fi
done

echo ""

# ── 5. Sidebar 导航项检查 ──
echo "── 5. Sidebar 导航项检查 ──"
nav_items=("Dashboard" "Projects" "Shot Editor" "Render Queue" "QA Center" "Story & Characters" "Asset Browser" "Edit & Delivery" "Analytics" "Settings")

for item in "${nav_items[@]}"; do
  if grep -q "$item" "$FRONTEND/src/components/layout/Sidebar.tsx"; then
    pass "Sidebar item: $item"
  else
    fail "Sidebar item missing: $item"
  fi
done

echo ""

# ── 6. 暗色模式检查 ──
echo "── 6. 暗色模式检查 ──"
if grep -q "dark" "$FRONTEND/src/components/layout/Header.tsx"; then
  pass "Dark mode toggle in Header"
else
  fail "Dark mode toggle missing"
fi

if grep -q '\.dark' "$FRONTEND/src/index.css"; then
  pass "Dark mode CSS variables defined"
else
  fail "Dark mode CSS variables missing"
fi

echo ""

# ── 7. API 代理配置检查 ──
echo "── 7. API 代理配置检查 ──"
if grep -q "'/api'" "$FRONTEND/vite.config.ts"; then
  pass "API proxy configured"
else
  fail "API proxy not configured"
fi
if grep -q "'/ws'" "$FRONTEND/vite.config.ts"; then
  pass "WebSocket proxy configured"
else
  fail "WebSocket proxy not configured"
fi

echo ""

# ── 8. .gitignore 检查 ──
echo "── 8. .gitignore 检查 ──"
gitignore_patterns=("node_modules" "dist" ".env" "*.db" "__pycache__" ".venv")
for pattern in "${gitignore_patterns[@]}"; do
  if grep -q "$pattern" "$FRONTEND/.gitignore"; then
    pass ".gitignore covers $pattern"
  else
    fail ".gitignore missing $pattern"
  fi
done

echo ""

# ── 9. 后端健康检查（如果后端在运行） ──
echo "── 9. 后端健康检查（可选） ──"
if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
  pass "Backend /api/health OK"
  
  # 测试 API 端点
  if curl -sf http://127.0.0.1:8000/api/projects > /dev/null 2>&1; then
    pass "Backend /api/projects OK"
  else
    warn "Backend /api/projects not reachable"
  fi
  
  if curl -sf http://127.0.0.1:8000/api/apikeys > /dev/null 2>&1; then
    pass "Backend /api/apikeys OK"
  else
    warn "Backend /api/apikeys not reachable"
  fi

  if curl -sf http://127.0.0.1:8000/docs > /dev/null 2>&1; then
    pass "Backend /docs OK"
  else
    warn "Backend /docs not reachable"
  fi
else
  warn "Backend not running (start with: cd backend && .venv/bin/uvicorn main:app --port 8000)"
fi

echo ""

# ── 10. 关键页面内容检查 ──
echo "── 10. 页面内容检查 ──"

# Projects 页面：CRUD 相关关键词
if grep -q "createProject\|deleteProject\|updateProject" "$FRONTEND/src/pages/Projects.tsx"; then
  pass "Projects page has CRUD operations"
else
  fail "Projects page missing CRUD"
fi

# Settings 页面：API Keys Tab
if grep -q "apiKeyApi\|apikeyApi" "$FRONTEND/src/pages/Settings.tsx"; then
  pass "Settings page has API Keys integration"
else
  fail "Settings page missing API Keys"
fi

# Projects 搜索
if grep -q "search\|Search" "$FRONTEND/src/pages/Projects.tsx"; then
  pass "Projects page has search functionality"
else
  fail "Projects page missing search"
fi

echo ""

# ── 结果汇总 ──
echo "========================================="
echo "  测试结果汇总"
echo "========================================="
echo -e "  ${GREEN}通过: $PASS${NC}"
echo -e "  ${RED}失败: $FAIL${NC}"
echo -e "  ${YELLOW}警告: $WARN${NC}"
echo "========================================="

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 Phase 0.4 + 0.5 + 0.6 验收通过！${NC}"
  exit 0
else
  echo -e "${RED}❌ 存在 $FAIL 个失败项，请修复后重试${NC}"
  exit 1
fi
