#!/bin/bash
# Nole Code - Install Script
# One-command install for VPS

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🦞 Installing Nole Code..."

# Check for bun/npm
if command -v bun &> /dev/null; then
    BUN_OR_NPM="bun"
elif command -v npm &> /dev/null; then
    BUN_OR_NPM="npm"
else
    echo "❌ No package manager found"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
if [ "$BUN_OR_NPM" = "bun" ]; then
    bun install
else
    npm install
fi

# Build
echo "🔨 Building..."
if [ "$BUN_OR_NPM" = "bun" ]; then
    bun build src/index.ts --outdir dist --target node
else
    npm run build
fi

# Create .env with MiniMax token from openclaw (if available)
ENV_FILE="$SCRIPT_DIR/.env"
AUTH_FILE="$HOME/.openclaw/agents/main/agent/auth-profiles.json"

if [ -f "$AUTH_FILE" ]; then
    TOKEN=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d['profiles']['minimax-portal:default']['access'])" 2>/dev/null)
    if [ -n "$TOKEN" ]; then
        echo "MINIMAX_API_KEY=$TOKEN" > "$ENV_FILE"
        echo "✓ MiniMax token loaded from openclaw"
    fi
fi

# Create launcher
mkdir -p ~/.local/bin
cat > ~/.local/bin/nole << 'LAUNCHER'
#!/bin/bash
export HOME="/home/tim"
cd /home/tim/nole-code
if [ -f .env ]; then export $(grep -v '^#' .env | xargs); fi
exec /home/tim/.local/bin/bun /home/tim/nole-code/dist/index.js "$@"
LAUNCHER
chmod +x ~/.local/bin/nole

# Symlink nole-code to same launcher
ln -sf ~/.local/bin/nole ~/.local/bin/nole-code 2>/dev/null || true

# Add to PATH
if [ -f "$HOME/.bashrc" ]; then
    if ! grep -q '~/.local/bin' "$HOME/.bashrc"; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    fi
fi

echo ""
echo "✅ Nole Code installed!"
echo ""
echo "Start:  nole"
echo "Resume: nole --session <id>"
echo "List:   nole --list-sessions"
