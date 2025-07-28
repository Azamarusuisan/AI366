# MEO-Sync デプロイガイド

## Vercelでのデプロイ手順

### 1. 事前準備
- Vercelアカウントを作成（https://vercel.com/signup）
- GitHubリポジトリにプロジェクトをプッシュ

### 2. Vercelでプロジェクトをインポート
1. Vercelダッシュボードで「New Project」をクリック
2. GitHubリポジトリを選択
3. 「Import」をクリック

### 3. 環境変数の設定
Vercelダッシュボードの「Settings」→「Environment Variables」で以下を設定：

```
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_ACCESS_TOKEN=your_long_lived_access_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_business_account_id
GBP_CLIENT_ID=your_gbp_client_id
GBP_CLIENT_SECRET=your_gbp_client_secret
GBP_REFRESH_TOKEN=your_gbp_refresh_token
GBP_ACCOUNT_ID=your_gbp_account_id
GBP_LOCATION_ID=your_gbp_location_id
```

### 4. デプロイ
「Deploy」をクリックして自動デプロイを実行

### 5. URLの共有
デプロイ完了後、以下のようなURLが生成されます：
- `https://your-project-name.vercel.app`

このURLをクライアントに共有してください。

## 代替方法：Renderでのデプロイ

### 1. Renderアカウント作成
https://render.com でアカウントを作成

### 2. 新しいWebサービスを作成
1. 「New」→「Web Service」を選択
2. GitHubリポジトリを連携
3. 以下の設定を入力：
   - Name: meo-sync
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

### 3. 環境変数を設定
Environment Variablesセクションで.env.exampleの内容を参考に設定

### 4. デプロイ
「Create Web Service」をクリック

## セキュリティ注意事項
- 環境変数には機密情報が含まれるため、絶対に公開しないでください
- アクセストークンは定期的に更新してください
- HTTPSを必ず使用してください（Vercel/Renderは自動でHTTPS化されます）