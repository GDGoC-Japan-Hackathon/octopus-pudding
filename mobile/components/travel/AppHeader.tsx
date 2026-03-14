import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export type AppHeaderProps = {
  title: string;
  weatherLabel?: string;
  weatherIcon?: string;
};

export function AppHeader({
  title,
  weatherLabel = '26°C',
  weatherIcon = 'wb-sunny',
}: AppHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.sideSpacer} />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.weatherWrap}>
        <Text style={styles.weatherText}>{weatherLabel}</Text>
        <MaterialIcons name={weatherIcon as keyof typeof MaterialIcons.glyphMap} size={20} color="#3B82F6" />
      </View>
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
