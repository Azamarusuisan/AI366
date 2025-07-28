# MEO Sync

**Instagram to Google Business Profile Synchronization Tool**

MEO Sync は、Instagram Business アカウントの新規投稿を自動で Google Business Profile に同期する Node.js + TypeScript 製のCLI & Webhook ハイブリッドツールです。

## 🚀 特徴

- **自動同期**: Instagram の投稿を指定ハッシュタグで自動フィルタリングし、GBP へ投稿
- **ハイブリッド取得**: Webhook と定期ポーリングの両方に対応
- **豊富なフィルタリング**: メディアタイプ、投稿時間、コンテンツ品質による自動判定
- **包括的ログ**: すべての同期操作を JSON 形式で記録・管理
- **Web ダッシュボード**: 同期状況とログを視覚的に確認
- **CLI インターフェース**: コマンドライン操作による柔軟な運用

## 📋 要件

- **Node.js** 18.0.0 以上
- **Instagram Business Account** + Graph API アクセス
- **Google Business Profile** + API アクセス
- **OAuth2 認証トークン** (両API用)

## 🛠 インストール

```bash
# プロジェクトクローン
git clone <repository-url>
cd meo-sync

# 依存関係インストール
npm install

# 環境設定ファイル作成
cp .env.example .env

# ビルド
npm run build
```

## ⚙️ 設定

### 1. 環境変数設定

`.env` ファイルを編集して、必要な API 認証情報を設定してください：

```bash
# Instagram Graph API Configuration
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_ACCESS_TOKEN=your_long_lived_access_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_business_account_id
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Google Business Profile API Configuration
GBP_CLIENT_ID=your_gbp_client_id
GBP_CLIENT_SECRET=your_gbp_client_secret
GBP_REFRESH_TOKEN=your_gbp_refresh_token
GBP_ACCOUNT_ID=your_gbp_account_id
GBP_LOCATION_ID=your_gbp_location_id

# Synchronization Configuration
TARGET_HASHTAG=#MEO
POLL_INTERVAL_MINUTES=5
MAX_POSTS_PER_POLL=10

# Server Configuration  
PORT=3000
```

### 2. Instagram Business API セットアップ

#### 必要な API とスコープ
- **Instagram Graph API** (無料)
- 必要スコープ: `instagram_graph_user_profile`, `instagram_graph_user_media`

#### セットアップ手順

1. **Meta for Developers でアプリ作成**
   - https://developers.facebook.com/ にアクセス
   - 「アプリを作成」→「ビジネス」タイプを選択
   - アプリ名とメールアドレスを入力

2. **Instagram Graph API を追加**
   - 左メニュー「製品」→「Instagram Graph API」を追加
   - 「設定」で基本設定を確認

3. **Instagram Business アカウント接続**
   - Instagram アカウントが **Business アカウント** である必要
   - Facebook ページとリンク済みである必要
   - 「ツール」→「Graph API Explorer」でテスト

4. **アクセストークン取得**
   ```bash
   # Short-lived Token を取得 (Graph API Explorer)
   # Long-lived Token に変換
   curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token" \
     -d "grant_type=fb_exchange_token" \
     -d "client_id={APP_ID}" \
     -d "client_secret={APP_SECRET}" \
     -d "fb_exchange_token={SHORT_LIVED_TOKEN}"
   ```

5. **ビジネスアカウント ID 取得**
   ```bash
   curl -X GET "https://graph.facebook.com/v18.0/me/accounts" \
     -d "access_token={LONG_LIVED_TOKEN}"
   ```

6. **Webhook 設定（オプション）**
   - 「製品」→「Webhooks」を設定
   - コールバック URL: `https://yourdomain.com/webhook/instagram`
   - 検証トークン: 任意の文字列
   - サブスクリプション: `feed`

#### 取得が必要な値
- `INSTAGRAM_APP_ID`: Meta アプリの App ID
- `INSTAGRAM_APP_SECRET`: Meta アプリの App Secret  
- `INSTAGRAM_ACCESS_TOKEN`: Long-lived User Access Token
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`: Instagram Business Account ID
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`: Webhook 検証用トークン

### 3. Google Business Profile API セットアップ

#### 必要な API とスコープ
- **My Business Business Information API** (無料)
- **My Business Posts API** (無料)
- 必要スコープ: `https://www.googleapis.com/auth/business.manage`

#### セットアップ手順

1. **Google Cloud Console でプロジェクト作成**
   - https://console.cloud.google.com/ にアクセス
   - 新しいプロジェクトを作成
   - プロジェクト ID をメモ

2. **必要な API を有効化**
   ```bash
   # APIs & Services → Library で検索・有効化
   - My Business Business Information API
   - My Business Posts API  
   ```

3. **OAuth2 認証情報を作成**
   - 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
   - Application type: 「ウェブアプリケーション」
   - Authorized redirect URIs: `http://localhost:8080/callback`

4. **初回認証とリフレッシュトークン取得**
   ```bash
   # 認証 URL にアクセス
   https://accounts.google.com/oauth2/auth?client_id={CLIENT_ID}&redirect_uri=http://localhost:8080/callback&scope=https://www.googleapis.com/auth/business.manage&response_type=code&access_type=offline&prompt=consent

   # 認証コードを取得後、リフレッシュトークンを取得
   curl -X POST "https://oauth2.googleapis.com/token" \
     -d "client_id={CLIENT_ID}" \
     -d "client_secret={CLIENT_SECRET}" \
     -d "redirect_uri=http://localhost:8080/callback" \
     -d "grant_type=authorization_code" \
     -d "code={AUTHORIZATION_CODE}"
   ```

5. **Account ID と Location ID を取得**
   ```bash
   # Account 一覧取得
   curl -X GET "https://mybusinessbusinessinformation.googleapis.com/v1/accounts" \
     -H "Authorization: Bearer {ACCESS_TOKEN}"

   # Location 一覧取得  
   curl -X GET "https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{ACCOUNT_ID}/locations" \
     -H "Authorization: Bearer {ACCESS_TOKEN}"
   ```

#### 取得が必要な値
- `GBP_CLIENT_ID`: Google OAuth2 クライアント ID
- `GBP_CLIENT_SECRET`: Google OAuth2 クライアントシークレット
- `GBP_REFRESH_TOKEN`: OAuth2 リフレッシュトークン
- `GBP_ACCOUNT_ID`: Google Business Profile アカウント ID  
- `GBP_LOCATION_ID`: Google Business Profile ロケーション ID

#### 重要な注意事項
- **Business Profile の管理者権限**が必要
- **ビジネス情報が Google で確認済み**である必要
- **API クォータ制限**に注意（1日あたり1000リクエスト）

## 🔧 使用方法

### CLI コマンド

```bash
# ヘルプ表示
npm start

# 接続テスト
npm start test-instagram
npm start test-gbp

# 1回のポーリング実行
npm start poll

# ドライラン（実際の同期なし）
npm start poll --dry-run

# 継続的ポーリング開始
npm start start-polling

# Webhook サーバー起動
npm start server

# 同期ログ表示
npm start logs --limit 20

# 現在のステータス確認
npm start status
```

### 開発用コマンド

```bash
# 開発サーバー起動（自動再起動）
npm run dev

# Webhook サーバー起動（開発用）
npm run server

# テスト実行
npm test

# Lint & フォーマット
npm run lint
npm run format

# ビルド
npm run build
```

## 🌐 Web インターフェース

サーバー起動後、以下のページが利用できます：

### ダッシュボード (`http://localhost:3000`)
- **同期統計**: 成功/失敗/スキップ数の表示
- **ログ閲覧**: 過去の同期履歴を時系列で表示
- **API テスト**: Instagram と GBP の接続テスト
- **リアルタイム更新**: 30秒間隔で自動更新

### セットアップガイド (`http://localhost:3000/setup`)
- **ステップバイステップ設定**: API キーの取得から設定まで
- **自動 .env 生成**: 入力した情報から環境設定ファイルを自動作成
- **AI チャットサポート**: 設定でわからないことをリアルタイムで質問可能
- **ダウンロード機能**: 設定完了後、.env ファイルを直接ダウンロード

## 🔄 同期フロー

1. **投稿取得**: Instagram Graph API から新規投稿を取得
2. **フィルタリング**: 以下の条件でフィルタリング
   - 指定ハッシュタグ（例: `#MEO`）が含まれている
   - 画像またはカルーセル投稿
   - 24時間以内の投稿
   - 適切な長さのキャプション
3. **変換**: Instagram 投稿を GBP Local Post 形式に変換
4. **投稿**: Google Business Profile API に投稿
5. **ログ記録**: 同期結果を JSON 形式で保存

## 📊 ログ形式

```json
{
  "id": "post-123-1640995200000",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "instagramPostId": "post-123",
  "instagramCaption": "新メニュー登場！ #MEO #restaurant",
  "instagramMediaUrl": "https://instagram.com/image.jpg",
  "gbpPostId": "accounts/123/locations/456/localPosts/789",
  "status": "success",
  "hashtags": ["#MEO", "#restaurant"],
  "syncDuration": 1500
}
```

## 🔧 カスタマイズ

### フィルタリング設定

`src/filters.ts` で以下のフィルタリング条件を調整できます：

- **対象ハッシュタグ**: 環境変数 `TARGET_HASHTAG` で変更
- **メディアタイプ**: 画像・カルーセルのみ（動画は除外）
- **投稿時間**: 24時間以内の投稿のみ
- **ハッシュタグ数**: 最大20個まで
- **キャプション長**: 最小10文字以上

### GBP 投稿フォーマット

`src/gbp.ts` の `convertInstagramToGBPPost` メソッドで、以下を調整できます：

- **言語設定**: デフォルト `en-US`
- **投稿タイプ**: `STANDARD`（標準投稿）
- **CTA 設定**: `LEARN_MORE` で Instagram リンク
- **ハッシュタグ除去**: GBP 投稿からは自動除去

## 🚨 トラブルシューティング

### よくある問題

1. **Instagram API エラー**
   ```bash
   npm start test-instagram
   ```
   - Access Token の有効期限を確認
   - Business Account の権限を確認

2. **GBP API エラー**
   ```bash
   npm start test-gbp
   ```
   - Refresh Token の有効性を確認
   - Account ID と Location ID を確認

3. **Webhook が受信されない**
   - Webhook URL が公開されているか確認
   - SSL 証明書が有効か確認
   - Verify Token が正しく設定されているか確認

### ログ確認

```bash
# アプリケーションログ
tail -f logs/meo-sync.log

# 同期履歴ログ
npm start logs --limit 50

# エラーログのみ表示
grep "ERROR" logs/meo-sync.log
```

## 🧪 テスト

```bash
# 全テスト実行
npm test

# 監視モードでテスト
npm run test:watch

# カバレッジレポート生成
npm test -- --coverage
```

## 📁 プロジェクト構成

```
meo-sync/
├── src/
│   ├── config.ts          # 設定管理
│   ├── instagram.ts       # Instagram API
│   ├── gbp.ts             # Google Business Profile API
│   ├── filters.ts         # フィルタリングロジック
│   ├── logger.ts          # ログ管理
│   ├── server.ts          # Express サーバー
│   ├── main.ts            # CLI エントリーポイント
│   └── types.ts           # 型定義
├── public/
│   └── dashboard.html     # Web ダッシュボード
├── tests/                 # テストファイル
├── logs/                  # ログファイル
├── .env.example          # 環境変数テンプレート
└── package.json
```

## 🔐 セキュリティ

- **API キー**: 環境変数で管理、リポジトリには含めない
- **Webhook 検証**: Instagram からの署名を検証
- **Token 管理**: GBP の Access Token は自動更新
- **ログ出力**: 機密情報は自動でマスク

## 📈 運用推奨事項

1. **モニタリング**: ダッシュボードで定期的に同期状況を確認
2. **ログローテーション**: 古いログファイルの定期削除
3. **バックアップ**: 設定ファイルと同期履歴の定期バックアップ
4. **アップデート**: Instagram・GBP API の変更に注意
5. **レート制限**: API の利用制限を超えないよう調整

## 🤝 貢献

1. Fork このリポジトリ
2. Feature ブランチを作成
3. 変更をコミット
4. Pull Request を作成

## 📝 ライセンス

MIT License

## 📞 サポート

技術的な問題やご質問は、GitHub Issues をご利用ください。

---

**MEO Sync** - Instagram から Google Business Profile への効率的な投稿同期を実現