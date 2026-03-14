import { MaterialIcons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

export type SummaryCardItem = {
  id: string;
  title: string;
  period: string;
  route: string;
  days: number;
  budget: number;
  image: string;
  status?: 'completed' | 'upcoming';
};

export function SummaryCard({ item }: { item: SummaryCardItem }) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.photo} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.meta}>日程: {item.period}</Text>
        <Text style={styles.meta}>移動: {item.route}</Text>
        <View style={styles.footer}>
          <MaterialIcons
            name={item.status === 'completed' ? 'check-circle' : 'schedule'}
            size={16}
            color={item.status === 'completed' ? '#22C55E' : '#3B82F6'}
          />
          <Text style={styles.footerText}>{item.status === 'completed' ? '完了' : '保存済み'} • {item.days}日</Text>
          <Text style={styles.budget}>¥{item.budget.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  photo: {
    width: 108,
    height: 108,
    backgroundColor: '#E2E8F0',
  },
  body: {
    flex: 1,
    padding: 10,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  meta: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  footerText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  budget: {
    marginLeft: 'auto',
    fontWeight: '700',
    color: '#EA580C',
  },
});
