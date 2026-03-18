#!/bin/bash
set -e

echo ""
echo "🚀 GlobalMatch 本地启动脚本"
echo "================================"

# ── 1. 检查依赖 ──────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ 未检测到 Node.js，请先安装：https://nodejs.org（推荐 v18+）"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "❌ 未检测到 Docker，请先安装：https://docs.docker.com/get-docker/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 版本需要 ≥ 18，当前：$(node -v)"
  exit 1
fi

echo "✅ Node.js $(node -v)"
echo "✅ Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# ── 2. 初始化 .env ───────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "📋 已创建 .env 文件（从 .env.example 复制）"
  echo "   API Key 使用占位符，AI功能需填入真实 Key 才能使用"
  echo "   DATABASE_URL 已配置好，无需修改"
  echo ""
fi

# ── 3. 安装 npm 依赖 ─────────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  echo "📦 安装依赖（首次需要 1-2 分钟）..."
  npm install --silent
  echo "✅ 依赖安装完成"
else
  echo "✅ 依赖已存在，跳过安装"
fi

# ── 4. 启动 PostgreSQL（Docker） ─────────────────────────────────────────────────
echo ""
echo "🐘 启动 PostgreSQL 数据库..."
docker compose up -d db 2>/dev/null || docker-compose up -d db

echo -n "   等待数据库就绪"
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres -q 2>/dev/null || \
     docker-compose exec -T db pg_isready -U postgres -q 2>/dev/null; then
    echo " ✅"
    break
  fi
  echo -n "."
  sleep 1
done

# ── 5. 同步数据库 Schema ─────────────────────────────────────────────────────────
echo "🗄  同步数据库 Schema..."
npx prisma db push --skip-generate 2>&1 | grep -E "✓|✗|Error|error" || true
npx prisma generate --silent 2>/dev/null || true
echo "✅ 数据库就绪"

# ── 6. 启动 Next.js ──────────────────────────────────────────────────────────────
echo ""
echo "================================"
echo "✅ 启动成功！"
echo ""
echo "   🌐 打开浏览器访问："
echo "   http://localhost:3001"
echo ""
echo "   💡 提示：部分 AI 功能需要在 .env 中填入真实 API Key"
echo "   Kimi Key：https://platform.moonshot.cn/"
echo "   SerpAPI：https://serpapi.com/"
echo "================================"
echo ""

PORT=3001 npx next dev
