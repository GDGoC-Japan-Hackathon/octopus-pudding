import { MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getTrips } from '@/features/trips/api/get-trips';
import { type TripResponse } from '@/features/trips/types/trip-edit';

type SortOrder = 'newest' | 'oldest';

const PLAN_IMAGE_URL =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80';

function parseDateValue(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export default function PlansListScreen() {
  const [plans, setPlans] = useState<TripResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const loadTrips = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await getTrips();
      setPlans(list);
    } catch {
      Alert.alert('取得失敗', '作成済みプランの取得に失敗しました。時間をおいて再度お試しください。');
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips])
  );

  const filteredPlans = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const startFilter = startDateFilter.trim();
    const endFilter = endDateFilter.trim();

    const startFilterValue = startFilter ? parseDateValue(startFilter) : null;
    const endFilterValue = endFilter ? parseDateValue(endFilter) : null;

    const filtered = plans.filter((plan) => {
      const startValue = parseDateValue(plan.start_date);
      const endValue = parseDateValue(plan.end_date);

      const matchesKeyword =
        query.length === 0 ||
        plan.origin.toLowerCase().includes(query) ||
        plan.destination.toLowerCase().includes(query) ||
        plan.status.toLowerCase().includes(query);

      const matchesStart = startFilterValue === null || (startValue !== null && startValue >= startFilterValue);
      const matchesEnd = endFilterValue === null || (endValue !== null && endValue <= endFilterValue);

      return matchesKeyword && matchesStart && matchesEnd;
    });

    return filtered.sort((a, b) => {
      const aDate = parseDateValue(a.start_date) ?? 0;
      const bDate = parseDateValue(b.start_date) ?? 0;
      return sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
    });
  }, [endDateFilter, keyword, plans, sortOrder, startDateFilter]);

  const sortLabel = sortOrder === 'newest' ? '新しい順' : '古い順';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>作成済み</Text>
          <View style={styles.brand}>
            <MaterialIcons name="travel-explore" size={20} color="#EC5B13" />
            <Text style={styles.brandText}>ふた旅</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={setKeyword}
            placeholder="出発地・目的地・ステータスで検索"
            placeholderTextColor="#94A3B8"
          />
          {keyword ? (
            <Pressable style={styles.clearButton} onPress={() => setKeyword('')}>
              <MaterialIcons name="cancel" size={20} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          <TextInput
            style={styles.filterInput}
            value={startDateFilter}
            onChangeText={setStartDateFilter}
            placeholder="開始日 (YYYY-MM-DD)"
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={styles.filterInput}
            value={endDateFilter}
            onChangeText={setEndDateFilter}
            placeholder="終了日 (YYYY-MM-DD)"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.resultRow}>
          <Text style={styles.resultText}>{filteredPlans.length}件のプラン</Text>
          <Pressable
            style={styles.sortButton}
            onPress={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
          >
            <MaterialIcons name="sort" size={18} color="#EC5B13" />
            <Text style={styles.sortButtonText}>{sortLabel}</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#EC5B13" />
            <Text style={styles.resultText}>読み込み中...</Text>
          </View>
        ) : null}

        {!isLoading && filteredPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>表示できるプランがありません</Text>
            <Text style={styles.emptyBody}>新規作成または検索条件を見直してください。</Text>
          </View>
        ) : null}

        <View style={styles.cardList}>
          {filteredPlans.map((plan) => (
            <Link key={plan.id} href={{ pathname: '/plans/detail', params: { id: String(plan.id) } }} asChild>
              <Pressable style={styles.card}>
                <Image source={{ uri: PLAN_IMAGE_URL }} style={styles.cardImage} />

                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {plan.origin} → {plan.destination}
                    </Text>
                    <View style={styles.statusTag}>
                      <Text style={styles.statusTagText}>{plan.status}</Text>
                    </View>
                  </View>

                  <View style={styles.metaStack}>
                    <View style={styles.metaRow}>
                      <MaterialIcons name="calendar-today" size={18} color="#64748B" />
                      <Text style={styles.metaText}>
                        {plan.start_date} - {plan.end_date}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <MaterialIcons name="tag" size={18} color="#64748B" />
                      <Text style={styles.metaText}>ID: {plan.id}</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.detailButton}>
                      <Text style={styles.detailButtonText}>詳細を表示</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6F6',
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(248, 246, 246, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  brand: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EC5B13',
  },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EEF1F4',
    paddingLeft: 42,
    paddingRight: 44,
    fontSize: 15,
    color: '#0F172A',
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    padding: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
    gap: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultText: {
    fontSize: 13,
    color: '#64748B',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EC5B13',
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyState: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyBody: {
    fontSize: 13,
    color: '#64748B',
  },
  cardList: {
    gap: 18,
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
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFF1E8',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EC5B13',
  },
  metaStack: {
    gap: 8,
    marginBottom: 14,
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  detailButton: {
    borderRadius: 12,
    backgroundColor: '#EC5B13',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  detailButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
