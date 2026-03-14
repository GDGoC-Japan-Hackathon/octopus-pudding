# Windows用の環境構築説明ファイル
WSL + React-Native + Expo

## Android Studioのインストール

デフォルトの設定でインストールを行えばよい．

## adbのパスを通す

1. .bashrcファイルの修正を行う

```jsx
nano ~/.bashrc
```

1. 以下の内容を下に追加する

ファイルのパス名は，自分のディレクトリを参照して，変更する必要があります．

```jsx
# --- Android SDK (Windows) for WSL ---
export ANDROID_HOME="/mnt/c/Users/takos/AppData/Local/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

adb() { "$ANDROID_HOME/platform-tools/adb.exe" "$@"; }
```

もし，以下の内容が書かれていたら，コメントアウトを行う

```jsx
alias adb="$ANDROID_HOME/platform-tools/adb.exe"
```

1. 動作確認

```jsx
adb version

# 出力
Android Debug Bridge version 1.0.41
Version 36.0.2-14143358
Installed as C:\Users\takos\AppData\Local\Android\Sdk\platform-tools\adb.exe
Running on Windows 10.0.26200
```

## Andoroid stadioでのエミュレータの設定

1. 通常時は，以下のコマンドでも端末が表示されない．

```jsx
adb devices

# 出力
* daemon not running; starting now at tcp:5037
* daemon started successfully
List of devices attached
```

1. Andoroid Studioのエミュレータとの接続

.bashrcに以下の内容を入力

```jsx
alias android="/mnt/c/Users/takos/AppData/Local/Android/Sdk/emulator/emulator.exe"
```

エミュレーターの起動

```jsx
android -avd Pixel_5
```

1. Andoroid Studioのエミュレータとの接続

```jsx
adb start-server

adb devices
List of devices attached
```

1. 動作を確認したら，ネットワークの切断

```jsx
adb kill-server
```

## 環境構築完了の合図

以下のコマンドを打つ

```jsx
android -avd Pixel_9_Pro

# エミュレーターが開かれるまで待機
npx expo start
a
```

## 実機での環境構築（拳太がやりやすそう）
1. 実機携帯側にExpo Goをインストール

2. ターミナル上でサーバーを開設
```jsx
npm install
npx expo start --tunnel
```
3. 出てきたQRコードを読み込む