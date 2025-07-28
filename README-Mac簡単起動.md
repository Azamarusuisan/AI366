# MEO Sync 起動手順（Mac用）
> Instagram → Google ビジネスプロフィール 自動投稿ツール

## 🎯 超簡単起動（推奨）

### 1. Node.js をインストール（初回のみ）
1. **https://nodejs.org** にアクセス
2. **緑色の「推奨版をダウンロード」**ボタンをクリック
3. ダウンロードした **.pkg ファイル**をダブルクリック
4. 画面の指示に従ってインストール

### 2. アプリを起動
1. **Finder** で `meo-sync` フォルダを開く
2. **`start-mac.sh`** ファイルを**右クリック**
3. **「このアプリケーションで開く」→「ターミナル」**を選択
4. 自動的にサーバーが起動します！

### 3. ブラウザでアクセス
- **Safari** または **Chrome** で `http://localhost:3044` にアクセス

---

## 📱 使い方

### 初回設定
1. **「セットアップ」**ボタンをクリック
2. **APIキー**を入力（取得方法は画面に詳しく記載）
3. **「.envファイルを生成」→「ダウンロード」**
4. ダウンロードした `.env` ファイルを `meo-sync` フォルダに移動

### 動作確認
1. ダッシュボードで **「Instagram接続テスト」**
2. **「GBP接続テスト」**
3. 両方成功したら使用開始！

---

## 🆘 困ったときは

### サーバーを停止したい
- ターミナル画面で **`Ctrl + C`** を押す

### もう一度起動したい
- `start-mac.sh` ファイルをダブルクリック

### うまく動かない
1. ターミナルで `Ctrl + C` を押してサーバー停止
2. もう一度 `start-mac.sh` をダブルクリック
3. それでもダメなら以下を実行：

```bash
# ターミナルを開いて以下を入力
cd ~/Desktop/meo-sync
npm install
npm run dev server
```

---

## 📋 必要なAPIキー

### Instagram Graph API
- **App ID** (数字)
- **App Secret** (英数字)
- **Access Token** (長い英数字)
- **Business Account ID** (数字)

### Google Business Profile API
- **Client ID** (長い英数字.apps.googleusercontent.com)
- **Client Secret** (英数字)
- **Refresh Token** (長い英数字)
- **Account ID** (数字)
- **Location ID** (長い英数字)

取得方法は**セットアップ画面**に詳しく書いてあります！

---

## ✅ 動作確認済み
- macOS 11 Big Sur 以降
- Node.js 16 以降
- Safari, Chrome, Firefox

何か問題があれば連絡してください！ 🙋‍♂️