import { MaterialIcons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { type RecommendPlanListItemViewModel } from '@/features/recommend/types';

type RecommendPlanCardProps = {
  plan: RecommendPlanListItemViewModel;
  variant?: 'list' | 'home';
};

export function RecommendPlanCard({ plan, variant = 'list' }: RecommendPlanCardProps) {
  const isHome = variant === 'home';

  return (
    <View style={[styles.card, isHome ? styles.cardHome : null]}>
      <Image source={{ uri: plan.image }} style={[styles.cardImage, isHome ? styles.cardImageHome : null]} />

      <View style={[styles.cardBody, isHome ? styles.cardBodyHome : null]}>
        <View style={[styles.cardHeader, isHome ? styles.cardHeaderHome : null]}>
          <Text style={[styles.cardTitle, isHome ? styles.cardTitleHome : null]} numberOfLines={2}>
            {plan.title}
          </Text>
        </View>

        <View style={[styles.metaStack, isHome ? styles.metaStackHome : null]}>
          <View style={styles.metaRow}>
            <MaterialIcons name="calendar-today" size={18} color="#64748B" />
            <Text style={[styles.metaText, isHome ? styles.metaTextHome : null]}>{plan.dateLabel}</Text>
          </View>
          {plan.createdLabel ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="schedule" size={18} color="#64748B" />
              <Text style={[styles.metaText, isHome ? styles.metaTextHome : null]}>{plan.createdLabel}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <MaterialIcons name="group" size={18} color="#64748B" />
            <Text style={[styles.metaText, isHome ? styles.metaTextHome : null]}>{plan.peopleLabel}</Text>
          </View>
        </View>

        <View style={[styles.cardFooter, isHome ? styles.cardFooterHome : null]}>
          <View style={styles.footerMeta}>
            <View style={styles.footerMetaRow}>
              <MaterialIcons name="bookmark" size={18} color="#EC5B13" />
              <Text style={styles.footerMetaText}>保存 {plan.saveCount.toLocaleString()}</Text>
            </View>
            {plan.categories.length ? (
              <View style={styles.categoryList}>
                {plan.categories.map((category) => (
                  <View key={`${plan.id}-${category}`} style={styles.categoryTag}>
                    <Text style={styles.categoryTagText}>{category}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View style={[styles.detailButton, isHome ? styles.detailButtonHome : null]}>
            <Text style={styles.detailButtonText}>詳細を表示</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHome: {
    width: 292,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E2E8F0',
  },
  cardImageHome: {
    aspectRatio: 1.65,
  },
  cardBody: {
    padding: 16,
  },
  cardBodyHome: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderHome: {
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardTitleHome: {
    fontSize: 18,
    lineHeight: 24,
  },
  metaStack: {
    gap: 8,
    marginBottom: 16,
  },
  metaStackHome: {
    marginBottom: 14,
    gap: 7,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  metaTextHome: {
    fontSize: 13,
  },
  cardFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardFooterHome: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  footerMeta: {
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerMetaText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  categoryList: {
    flexDirection: 'row',
    alignItems: 'center',
    alignContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF1E8',
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EC5B13',
  },
  detailButton: {
    width: 108,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#EC5B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonHome: {
    width: '100%',
  },
  detailButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
