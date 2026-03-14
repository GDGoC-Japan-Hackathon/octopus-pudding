# Mobile App (Expo)

モバイルアプリの起動は、**2ターミナル運用**が分かりやすいです。

- WSL/Windows: `docs/windows.md`
- macOS: `docs/mac.md`

## 事前準備

`mobile/` ディレクトリで実行してください。

```bash
cd /path/to/GDGoC-Hackason/mobile
```

依存パッケージを入れます。

```bash
make setup
```

Android SDK の場所を設定します。
例（WSL）:

```bash
export ANDROID_HOME="/mnt/c/Users/<your>/AppData/Local/Android/Sdk"
```

例（native Linux/mac）:

```bash
export ANDROID_HOME="/home/<user>/Android/Sdk"
```

## 1回目の起動手順（基本フロー）

### ターミナルA: エミュレーターを起動

```bash
cd /path/to/GDGoC-Hackason/mobile
source ~/.bashrc
export ANDROID_HOME="(上で設定したパス)"  # 必要なら再設定
make emu AVD="<your_avd_name>"
```

### ターミナルB: Expo（トンネル）を起動

```bash
cd /path/to/GDGoC-Hackason/mobile
source ~/.bashrc
export ANDROID_HOME="(上で設定したパス)"  # 必要なら再設定
make start-tunnel
```

起動後、`Tunnel ready.` が出たら Expo が待機状態です。

ターミナルBで `a` を押すと接続端末にアプリを開きます。

## 2回目以降の運用

- **再起動しないなら**: エミュレーターが起動済みなら、ターミナルBで `make start-tunnel` してから開発を再開してください。
- **エミュレーターを再起動したいとき**: ターミナルAで `make emu "<あなたのAVD名>"` を再実行し、ターミナルBで `make start-tunnel` してください。
- **Metro の再読み込み**: ターミナルBで `r` を押してください。
- **変更が反映されない場合**: `Ctrl + C` で `make start-tunnel` を停止し、再実行してください。

## Makefile コマンド一覧

### `make setup`
- `npm install`

### `make emu`
- Android エミュレーターを起動します。
- `AVD` でAVD名を指定します（未指定なら `Makefile` の既定値を使用）。

```bash
make emu AVD="<your_avd_name>"
```

### `make android`
- `make emu` と同じです（同義）。

### `make start`
- `adb start-server`
- Android デバイス接続周りの `adb` サーバーを起動します。
  **Expo の起動ではありません**。

### `make kill`
- `adb kill-server`
- `start` で起動した `adb` サーバーを停止します。
- エミュレーターや接続が不安定になったとき、まず `kill` してから `start` し直す、という「接続のリセット」に使います。

### `make start-tunnel`
- `npx expo start --tunnel`
- WSL から接続が不安定な場合にも使いやすい起動方法。

### `make devices`
- `adb devices`
- 接続中のデバイスを確認

### `make` での注意
- `make start-tunnel` 自体は `ANDROID_HOME` を参照しないため、`ANDROID_HOME` が未設定でもこのコマンドはエラーになりません。
- ただし、`make emu` など Android SDK を利用するターゲットを使う場合には、事前に `ANDROID_HOME` を正しく設定しておく必要があります。
- `make` の動作は、シェルの環境変数を引き継ぐため、毎回のターミナルで `source ~/.bashrc` と `export ANDROID_HOME=...` が必要な場合があります。
