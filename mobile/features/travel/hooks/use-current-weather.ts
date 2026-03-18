import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

type WeatherDisplay = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
};

type UseCurrentWeatherParams = {
  enabled?: boolean;
  fallbackIcon: keyof typeof MaterialIcons.glyphMap;
  fallbackLabel: string;
};

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;

let weatherCache: { expiresAt: number; value: WeatherDisplay } | null = null;
let weatherRequest: Promise<WeatherDisplay | null> | null = null;

function getWeatherCondition(code: number, isDay: boolean) {
  if (code === 0) {
    return {
      icon: isDay ? 'wb-sunny' : 'nights-stay',
      label: isDay ? '晴れ' : '晴天',
    } satisfies Pick<WeatherDisplay, 'icon' | 'label'>;
  }

  if ([1, 2, 3].includes(code)) {
    return {
      icon: isDay ? 'wb-cloudy' : 'cloud',
      label: 'くもり',
    } satisfies Pick<WeatherDisplay, 'icon' | 'label'>;
  }

  if ([45, 48].includes(code)) {
    return {
      icon: 'foggy',
      label: '霧',
    } satisfies Pick<WeatherDisplay, 'icon' | 'label'>;
  }

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return {
      icon: 'umbrella',
      label: '雨',
    } satisfies Pick<WeatherDisplay, 'icon' | 'label'>;
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return {
      icon: 'ac-unit',
      label: '雪',
    } satisfies Pick<WeatherDisplay, 'icon' | 'label'>;
  }

  if ([95, 96, 99].includes(code)) {
    return {
      icon: 'thunderstorm',
      label: '雷',
    } satisfies Pick<WeatherDisplay, 'icon' | 'label'>;
  }

  return {
    icon: 'wb-cloudy',
    label: '天気',
  } satisfies Pick<WeatherDisplay, 'icon' | 'label'>;
}

async function fetchCurrentWeather(): Promise<WeatherDisplay | null> {
  if (weatherCache && weatherCache.expiresAt > Date.now()) {
    return weatherCache.value;
  }

  if (weatherRequest) {
    return weatherRequest;
  }

  weatherRequest = (async () => {
    const permission = await Location.getForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      return null;
    }

    const lastKnownPosition = await Location.getLastKnownPositionAsync();
    const position =
      lastKnownPosition ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }));

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      current?: {
        is_day?: number;
        temperature_2m?: number;
        weather_code?: number;
      };
    };

    if (
      typeof payload.current?.temperature_2m !== 'number' ||
      typeof payload.current?.weather_code !== 'number' ||
      typeof payload.current?.is_day !== 'number'
    ) {
      return null;
    }

    const condition = getWeatherCondition(payload.current.weather_code, payload.current.is_day === 1);
    const weather = {
      icon: condition.icon,
      label: `${Math.round(payload.current.temperature_2m)}°C ${condition.label}`,
    } satisfies WeatherDisplay;

    weatherCache = {
      value: weather,
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    };

    return weather;
  })().finally(() => {
    weatherRequest = null;
  });

  return weatherRequest;
}

export function useCurrentWeather({
  enabled = true,
  fallbackIcon,
  fallbackLabel,
}: UseCurrentWeatherParams): WeatherDisplay {
  const [weather, setWeather] = useState<WeatherDisplay>({
    icon: fallbackIcon,
    label: fallbackLabel,
  });

  useEffect(() => {
    setWeather({
      icon: fallbackIcon,
      label: fallbackLabel,
    });
  }, [fallbackIcon, fallbackLabel]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isCancelled = false;

    void fetchCurrentWeather()
      .then((resolvedWeather) => {
        if (!isCancelled && resolvedWeather) {
          setWeather(resolvedWeather);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  return weather;
}
