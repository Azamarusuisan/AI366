#!/bin/bash

echo "🚀 MEO Sync を起動しています..."
echo ""

# 現在のディレクトリに移動
cd "$(dirname "$0")"

# Node.js がインストールされているかチェック
if ! command -v node &> /dev/null; then
    echo "❌ Node.js がインストールされていません"
    echo "https://nodejs.org/ からダウンロードしてインストールしてください"
    exit 1
fi

echo "✅ Node.js が見つかりました"

# 依存関係がインストールされているかチェック
if [ ! -d "node_modules" ]; then
    echo "📦 依存関係をインストール中..."
    npm install
fi

# .env ファイルがあるかチェック
if [ ! -f ".env" ]; then
    echo "⚠️  .env ファイルが見つかりません"
    echo "ブラウザでセットアップ画面を開いて設定してください"
    echo ""
fi

echo "🌐 サーバーを起動中..."
echo "ブラウザで http://localhost:3044 にアクセスしてください"
echo ""
echo "停止するには Ctrl+C を押してください"
echo ""

# サーバー起動
npm run dev server