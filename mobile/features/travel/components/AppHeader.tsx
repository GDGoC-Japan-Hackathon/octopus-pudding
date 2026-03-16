import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export type AppHeaderProps = {
  title: string;
  weatherLabel?: string;
  weatherIcon?: keyof typeof MaterialIcons.glyphMap;
  showWeather?: boolean;
};

export function AppHeader({
  title,
  weatherLabel = '26°C',
  weatherIcon = 'wb-sunny',
  showWeather = true,
}: AppHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.sideSpacer} />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {showWeather ? (
        <View style={styles.weatherWrap}>
          <Text style={styles.weatherText}>{weatherLabel}</Text>
          <MaterialIcons name={weatherIcon} size={20} color="#3B82F6" />
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
  weatherText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
});
