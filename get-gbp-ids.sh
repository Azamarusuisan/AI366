#!/bin/bash

# アクセストークンを取得（リフレッシュトークンから）
ACCESS_TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=$GBP_CLIENT_ID" \
  -d "client_secret=$GBP_CLIENT_SECRET" \
  -d "refresh_token=$GBP_REFRESH_TOKEN" \
  -d "grant_type=refresh_token" | jq -r '.access_token')

echo "アクセストークン取得完了"

# アカウント一覧を取得
echo -e "\n=== Google Business Profile アカウント一覧 ==="
curl -s -X GET "https://mybusinessaccountmanagement.googleapis.com/v1/accounts" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# アカウントIDを指定してロケーション一覧を取得
echo -e "\nアカウントIDを入力してください (例: accounts/123456789): "
read ACCOUNT_ID

echo -e "\n=== ロケーション一覧 ==="
curl -s -X GET "https://mybusinessbusinessinformation.googleapis.com/v1/$ACCOUNT_ID/locations" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'