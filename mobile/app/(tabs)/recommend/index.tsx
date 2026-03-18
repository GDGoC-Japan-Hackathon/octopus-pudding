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
    return recommendPlans.filter((plan) => plan.category === activeCategory);
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
              <View style={styles.imageWrap}>
                <Image source={{ uri: plan.image }} style={styles.cardImage} />
                <View style={styles.locationTag}>
                  <Text style={styles.locationTagText}>{plan.location}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{plan.title}</Text>
                  <MaterialIcons name="more-vert" size={20} color="#94A3B8" />
                </View>

                <View style={styles.authorRow}>
                  <View style={styles.avatar}>
                    <MaterialIcons name="person" size={16} color="#EC5B13" />
                  </View>
                  <Text style={styles.authorText}>{plan.author}</Text>
                  <View style={styles.likesWrap}>
                    <MaterialIcons name="bookmark" size={18} color="#EC5B13" />
                    <Text style={styles.likesText}>保存 {plan.saveCount.toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.detailButton}>
                  <Text style={styles.detailButtonText}>詳細を見る</Text>
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
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageWrap: {
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#E2E8F0',
  },
  locationTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  locationTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EC5B13',
  },
  cardBody: {
    padding: 16,
    gap: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: '#0F172A',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  likesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  detailButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EC5B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
