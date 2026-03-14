SHELL := /bin/bash

.PHONY: setup android emu start start-tunnel kill devices check-android-home

# Default AVD name. Override with: make android AVD=Pixel_5
AVD ?= Medium_Phone_API_36.1

EMULATOR_BIN := $(shell \
  if [ -x "$(ANDROID_HOME)/emulator/emulator.exe" ]; then \
    echo "$(ANDROID_HOME)/emulator/emulator.exe"; \
  elif [ -x "$(ANDROID_HOME)/emulator/emulator" ]; then \
    echo "$(ANDROID_HOME)/emulator/emulator"; \
  fi \
)

ADB_BIN := $(shell \
  if [ -x "$(ANDROID_HOME)/platform-tools/adb.exe" ]; then \
    echo "$(ANDROID_HOME)/platform-tools/adb.exe"; \
  elif [ -x "$(ANDROID_HOME)/platform-tools/adb" ]; then \
    echo "$(ANDROID_HOME)/platform-tools/adb"; \
  fi \
)

setup:
	npm install

check-android-home:
	@if [ -z "$(ANDROID_HOME)" ]; then \
		echo "ANDROID_HOME is not set."; \
		echo "Set it first, e.g.:"; \
		echo "  export ANDROID_HOME=\"/mnt/c/Users/<your>/AppData/Local/Android/Sdk\""; \
		exit 1; \
	fi
	@if [ ! -d "$(ANDROID_HOME)" ]; then \
		echo "ANDROID_HOME path not found: $(ANDROID_HOME)"; \
		exit 1; \
	fi
	@if [ -z "$(EMULATOR_BIN)" ] || [ -z "$(ADB_BIN)" ]; then \
		echo "ANDROID_HOME seems wrong (emulator/adb not found)."; \
		echo "Check these paths exist under $(ANDROID_HOME)."; \
		exit 1; \
	fi

# エミュレーターの起動
emu: check-android-home
	"$(EMULATOR_BIN)" -avd "$(AVD)"

android: emu

start: check-android-home
	"$(ADB_BIN)" start-server

kill: check-android-home
	"$(ADB_BIN)" kill-server

devices: check-android-home
	"$(ADB_BIN)" devices

start-tunnel:
	npx expo start --tunnel
