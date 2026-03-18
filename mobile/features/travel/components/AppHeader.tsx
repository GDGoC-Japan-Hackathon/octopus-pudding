import { MaterialIcons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCurrentWeather } from '@/features/travel/hooks/use-current-weather';

export type AppHeaderProps = {
  title: string;
  weatherLabel?: string;
  weatherIcon?: keyof typeof MaterialIcons.glyphMap;
  showWeather?: boolean;
  useLiveWeather?: boolean;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

export function AppHeader({
  title,
  weatherLabel = '26°C',
  weatherIcon = 'wb-sunny',
  showWeather = true,
  useLiveWeather = true,
  leftSlot,
  rightSlot,
}: AppHeaderProps) {
  const resolvedWeather = useCurrentWeather({
    enabled: showWeather && useLiveWeather && !rightSlot,
    fallbackIcon: weatherIcon,
    fallbackLabel: weatherLabel,
  });

  return (
    <View style={styles.root}>
      {leftSlot ? <View style={styles.leftSlot}>{leftSlot}</View> : <View style={styles.sideSpacer} />}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {rightSlot ? (
        <View style={styles.rightSlot}>{rightSlot}</View>
      ) : showWeather ? (
        <View style={styles.weatherWrap}>
          <Text style={styles.weatherText}>{resolvedWeather.label}</Text>
          <MaterialIcons name={resolvedWeather.icon} size={20} color="#3B82F6" />
        </View>
      ) : (
        <View style={styles.sideSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  sideSpacer: {
    width: 96,
  },
  leftSlot: {
    width: 96,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  weatherWrap: {
    width: 96,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  rightSlot: {
    width: 96,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  weatherText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
});
