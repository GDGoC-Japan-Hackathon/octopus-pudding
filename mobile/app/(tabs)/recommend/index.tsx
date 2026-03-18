import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { weatherMock } from '@/data/travel';
import { getRecommendPlans } from '@/features/recommend/api/get-recommend-plans';
import { type RecommendCategory } from '@/features/recommend/types';
import { AppHeader } from '@/features/travel/components/AppHeader';

const categories: RecommendCategory[] = ['すべて', 'カフェ', '夜景', 'グルメ', '温泉'];

export default function RecommendationListScreen() {
  const [activeCategory, setActiveCategory] = useState<RecommendCategory>('すべて');
  const [recommendPlans, setRecommendPlans] = useState<Awaited<ReturnType<typeof getRecommendPlans>>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecommendations = useCallback(async () => {
    try {
      setIsLoading(true);
      const plans = await getRecommendPlans();
      setRecommendPlans(plans);
    } catch {
      Alert.alert('取得失敗', 'おすすめ旅の取得に失敗しました。時間をおいて再度お試しください。');
      setRecommendPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRecommendations();
    }, [loadRecommendations])
  );

  const filteredPlans = useMemo(() => {
    if (activeCategory === 'すべて') {
      return recommendPlans;
    }
    return recommendPlans.filter((plan) => plan.categories.includes(activeCategory));
  }, [activeCategory, recommendPlans]);

  return (
    <View style={styles.screen}>
      <AppHeader title="おすすめ" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={styles.categoryWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {categories.map((category) => {
            const active = category === activeCategory;
            return (
              <Pressable key={category} style={styles.categoryButton} onPress={() => setActiveCategory(category)}>
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category}</Text>
                <View style={[styles.categoryUnderline, active && styles.categoryUnderlineActive]} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#EC5B13" />
            <Text style={styles.loadingText}>おすすめ旅を読み込み中...</Text>
          </View>
        ) : null}

        {!isLoading && filteredPlans.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>おすすめ旅がありません</Text>
          </View>
        ) : null}

        {filteredPlans.map((plan) => (
          <Link key={plan.id} href={{ pathname: '/recommend/detail', params: { id: plan.id } }} asChild>
            <Pressable style={styles.card}>
              <Image source={{ uri: plan.image }} style={styles.cardImage} />

              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {plan.title}
                  </Text>
                </View>

                <View style={styles.metaStack}>
                  <View style={styles.metaRow}>
                    <MaterialIcons name="calendar-today" size={18} color="#64748B" />
                    <Text style={styles.metaText}>{plan.dateLabel}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <MaterialIcons name="group" size={18} color="#64748B" />
                    <Text style={styles.metaText}>{plan.peopleLabel}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.footerMeta}>
                    <View style={styles.footerMetaRow}>
                      <MaterialIcons name="bookmark" size={18} color="#EC5B13" />
                      <Text style={styles.footerMetaText}>保存 {plan.saveCount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.categoryList}>
                      {plan.categories.map((category) => (
                        <View key={`${plan.id}-${category}`} style={styles.categoryTag}>
                          <Text style={styles.categoryTagText}>{category}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.detailButton}>
                    <Text style={styles.detailButtonText}>詳細を表示</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6F6',
  },
  categoryWrap: {
    backgroundColor: '#F8F6F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 22,
  },
  categoryButton: {
    alignItems: 'center',
    paddingTop: 14,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  categoryTextActive: {
    color: '#EC5B13',
    fontWeight: '700',
  },
  categoryUnderline: {
    marginTop: 10,
    width: '100%',
    height: 2,
    backgroundColor: 'transparent',
  },
  categoryUnderlineActive: {
    backgroundColor: '#EC5B13',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
    gap: 22,
  },
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
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E2E8F0',
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  metaStack: {
    gap: 8,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#64748B',
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
  detailButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
});
