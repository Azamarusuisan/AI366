# 🔑 MEO-Sync APIキー取得ガイド

## 必要なAPIキー一覧

### 1. Instagram API（Meta）
- **INSTAGRAM_APP_ID**: Metaアプリケーション ID
- **INSTAGRAM_APP_SECRET**: Metaアプリケーション シークレット
- **INSTAGRAM_ACCESS_TOKEN**: 長期アクセストークン
- **INSTAGRAM_BUSINESS_ACCOUNT_ID**: ビジネスアカウント ID
- **INSTAGRAM_WEBHOOK_VERIFY_TOKEN**: Webhook検証用トークン（任意の文字列）

### 2. Google Business Profile API
- **GBP_CLIENT_ID**: OAuth2 クライアント ID
- **GBP_CLIENT_SECRET**: OAuth2 クライアント シークレット
- **GBP_REFRESH_TOKEN**: リフレッシュトークン
- **GBP_ACCOUNT_ID**: GBPアカウント ID
- **GBP_LOCATION_ID**: ロケーション ID

## 取得手順

### Instagram API

1. **Metaアプリ作成**
   - https://developers.facebook.com
   - My Apps → Create App → Business

2. **Instagram Basic Display追加**
   - Add Product → Instagram Basic Display
   - App ID と App Secret をメモ

3. **アクセストークン生成**
   - Basic Display → User Token Generator
   - Generate Token → Instagramでログイン
   - 生成されたトークンをメモ

4. **ビジネスアカウントID取得**
   ```bash
   curl -X GET "https://graph.instagram.com/me?fields=id,username&access_token=YOUR_ACCESS_TOKEN"
   ```

### Google Business Profile API

1. **Google Cloud Console**
   - https://console.cloud.google.com
   - 新規プロジェクト作成

2. **API有効化**
   - APIライブラリで以下を有効化:
     - My Business Business Information API
     - My Business Business Management API

3. **OAuth認証情報作成**
   - 認証情報 → OAuth クライアント ID作成
   - タイプ: ウェブアプリケーション
   - リダイレクトURI: http://localhost:8080/callback

4. **トークン取得**
   ```bash
   # get-google-token.js を編集してCLIENT_IDとSECRETを設定
   node get-google-token.js
   # ブラウザで認証 → コードを入力 → リフレッシュトークン取得
   ```

5. **アカウントID取得**
   ```bash
   # .envファイルに上記で取得した値を設定後
   source .env
   bash get-gbp-ids.sh
   ```

## .envファイル設定例

```env
# Instagram
INSTAGRAM_APP_ID=123456789012345
INSTAGRAM_APP_SECRET=abcdef123456789abcdef
INSTAGRAM_ACCESS_TOKEN=IGQVJYabc123...
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841401234567890
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=my_secure_webhook_token

# Google Business Profile
GBP_CLIENT_ID=123456-abc.apps.googleusercontent.com
GBP_CLIENT_SECRET=GOCSPX-abc123
GBP_REFRESH_TOKEN=1//0abc123...
GBP_ACCOUNT_ID=accounts/123456789
GBP_LOCATION_ID=locations/987654321

# Security
JWT_SECRET=your_secure_jwt_secret_at_least_32_chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
```

## トラブルシューティング

- **Instagram**: ビジネスアカウントとFacebookページの連携が必要
- **Google**: ビジネスオーナー確認が完了している必要あり
- **共通**: APIの利用規約に同意が必要

## サポート

わからないことがあれば、エラーメッセージと一緒に質問してください！