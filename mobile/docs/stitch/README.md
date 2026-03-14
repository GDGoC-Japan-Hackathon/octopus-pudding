# Google Stitch 参照素材

このディレクトリは、Google Stitch から取得した画面情報（ID/HTML）を保管する場所です。

- `screens.json`: 画面IDと画面名の管理ファイル
- `html/`: Stitch のHTMLエクスポートを置く場所（推奨）

## 推奨配置
- ファイル名は画面IDで管理
  - 例: `html/8213a95e5f4c476bb64d6c45f151f1dd.html`
- `screens.json` の `id` と一致させる

## 使い方
1. `html/<screen-id>.html` にコピー
2. 画面実装時に `mobile/app/(tabs)/...tsx` を開いて対応
3. 表示や文言だけ先に揃えてから API 連携を追加
