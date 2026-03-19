import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { weatherMock } from '@/data/travel';
import { getRecommendPlans, type RecommendPlanListItem } from '@/features/recommend/api/get-recommend-plans';
import { AppHeader } from '@/features/travel/components/AppHeader';

type PickerType = 'category' | 'people' | 'duration' | null;
type RecommendSortOrder = 'newest' | 'oldest' | 'popular';

const CATEGORY_OPTIONS = ['カフェ', '夜景', 'グルメ', '温泉'] as const;
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 5;
const PEOPLE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);
const DURATION_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

type RecommendPlanItem = Awaited<ReturnType<typeof getRecommendPlans>>[number];

function parseDateInput(value: string) {
  if (!value) return null;
  const normalized = value.replace(/\./g, '/').replace(/-/g, '/');
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const yearNum = Number(year);
  const monthNum = Number(month);
  const dayNum = Number(day);
  const parsed = new Date(yearNum, monthNum - 1, dayNum);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== yearNum ||
    parsed.getMonth() + 1 !== monthNum ||
    parsed.getDate() !== dayNum
  ) {
    return null;
  }
  return parsed;
}

function parseTimestampValue(value?: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function getTripDurationDays(startDate: string, endDate: string) {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end) return null;
  const startTime = start.getTime();
  const endTime = end.getTime();
  if (endTime < startTime) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((endTime - startTime) / msPerDay) + 1;
}

type WheelPickerProps<T extends string | number> = {
  values: T[];
  selectedValue: T;
  onChange: (value: T) => void;
  renderLabel?: (value: T) => string;
};

function WheelPicker<T extends string | number>({
  values,
  selectedValue,
  onChange,
  renderLabel = (value) => String(value),
}: WheelPickerProps<T>) {
  const scrollRef = useRef<ScrollView | null>(null);
  const paddingRows = Math.floor(WHEEL_VISIBLE_ROWS / 2);
  const paddedValues = [
    ...Array.from({ length: paddingRows }, () => null),
    ...values,
    ...Array.from({ length: paddingRows }, () => null),
  ];

  const snapToValue = useCallback(
    (offsetY: number) => {
      const rawIndex = Math.round(offsetY / WHEEL_ITEM_HEIGHT);
      const index = Math.min(Math.max(rawIndex, 0), values.length - 1);
      const nextValue = values[index];
      if (nextValue !== undefined && nextValue !== selectedValue) {
        onChange(nextValue);
      }
      scrollRef.current?.scrollTo({
        y: index * WHEEL_ITEM_HEIGHT,
        animated: true,
      });
    },
    [onChange, selectedValue, values]
  );

  return (
    <View style={styles.wheelWrap}>
      <View pointerEvents="none" style={styles.wheelHighlight} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: Math.max(values.indexOf(selectedValue), 0) * WHEEL_ITEM_HEIGHT }}
        onMomentumScrollEnd={(event) => snapToValue(event.nativeEvent.contentOffset.y)}
      >
        {paddedValues.map((value, index) => (
          <View key={`${String(value)}-${index}`} style={styles.wheelItem}>
            <Text style={[styles.wheelItemText, value === null && styles.wheelItemGhost]}>
              {value === null ? '' : renderLabel(value)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function RecommendationListScreen() {
  const [recommendPlans, setRecommendPlans] = useState<RecommendPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [peopleFilter, setPeopleFilter] = useState<number | null>(null);
  const [durationFilter, setDurationFilter] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<RecommendSortOrder>('newest');
  const [activePicker, setActivePicker] = useState<PickerType>(null);

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

  const openPeoplePicker = useCallback(() => {
    setActivePicker('people');
  }, []);

  const closePicker = useCallback(() => {
    setActivePicker(null);
  }, []);

  const toggleCategoryFilter = useCallback((category: string) => {
    setCategoryFilter((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category]
    );
  }, []);

  const resetPicker = useCallback(() => {
    if (activePicker === 'category') {
      setCategoryFilter([]);
    }
    if (activePicker === 'people') {
      setPeopleFilter(null);
    }
    if (activePicker === 'duration') {
      setDurationFilter(null);
    }
    setActivePicker(null);
  }, [activePicker]);

  const filteredPlans = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    const filtered = recommendPlans.filter((plan) => {
      const searchableText = [plan.title, plan.peopleLabel, ...plan.categories].join(' ').toLowerCase();
      const matchesKeyword = query.length === 0 || searchableText.includes(query);
      const matchesPeople = !peopleFilter || plan.participantCount === peopleFilter;
      const matchesCategories =
        categoryFilter.length === 0 || categoryFilter.every((category) => plan.categories.includes(category));
      const durationDays = getTripDurationDays(plan.startDate, plan.endDate);
      const matchesDuration = durationFilter === null || durationDays === durationFilter;

      return matchesKeyword && matchesPeople && matchesCategories && matchesDuration;
    });

    return filtered.sort((a, b) => {
      if (sortOrder === 'popular') {
        return b.saveCount - a.saveCount;
      }
      const aDate = parseTimestampValue(a.createdAt) ?? 0;
      const bDate = parseTimestampValue(b.createdAt) ?? 0;
      return sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
    });
  }, [categoryFilter, durationFilter, keyword, peopleFilter, recommendPlans, sortOrder]);

  const sortLabel = sortOrder === 'newest' ? '新しい順' : sortOrder === 'oldest' ? '古い順' : '人気順';
  const categoryLabel = categoryFilter.length ? `カテゴリ(${categoryFilter.length})` : 'カテゴリ';
  const peopleLabel = peopleFilter ? `${peopleFilter}名` : '人数';
  const durationLabel = durationFilter ? `${durationFilter}日` : '日数';

  return (
    <View style={styles.screen}>
      <AppHeader title="おすすめ" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={styles.searchSection}>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={setKeyword}
            placeholder="キーワードを入力"
            placeholderTextColor="#94A3B8"
          />
          {keyword ? (
            <Pressable style={styles.clearButton} onPress={() => setKeyword('')}>
              <MaterialIcons name="cancel" size={20} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          <Pressable
            style={[styles.filterChip, categoryFilter.length > 0 && styles.filterChipActive]}
            onPress={() => setActivePicker('category')}
          >
            <Text style={[styles.filterChipText, categoryFilter.length > 0 && styles.filterChipTextActive]}>
              {categoryLabel}
            </Text>
            <MaterialIcons name="expand-more" size={18} color={categoryFilter.length > 0 ? '#EC5B13' : '#64748B'} />
          </Pressable>
          <Pressable style={[styles.filterChip, !!peopleFilter && styles.filterChipActive]} onPress={openPeoplePicker}>
            <Text style={[styles.filterChipText, !!peopleFilter && styles.filterChipTextActive]}>{peopleLabel}</Text>
            <MaterialIcons name="expand-more" size={18} color={peopleFilter ? '#EC5B13' : '#64748B'} />
          </Pressable>
          <Pressable
            style={[styles.filterChip, !!durationFilter && styles.filterChipActive]}
            onPress={() => setActivePicker('duration')}
          >
            <Text style={[styles.filterChipText, !!durationFilter && styles.filterChipTextActive]}>{durationLabel}</Text>
            <MaterialIcons name="expand-more" size={18} color={durationFilter ? '#EC5B13' : '#64748B'} />
          </Pressable>
        </ScrollView>

        <View style={styles.resultRow}>
          <Text style={styles.resultText}>{filteredPlans.length}件のおすすめ旅が見つかりました</Text>
          <Pressable
            style={styles.sortButton}
            onPress={() =>
              setSortOrder((prev) => (prev === 'newest' ? 'oldest' : prev === 'oldest' ? 'popular' : 'newest'))
            }
          >
            <MaterialIcons name="sort" size={18} color="#EC5B13" />
            <Text style={styles.sortButtonText}>{sortLabel}</Text>
          </Pressable>
        </View>
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
                  <View style={styles.detailButton}>
                    <Text style={styles.detailButtonText}>詳細を表示</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </Link>
        ))}
      </ScrollView>

      <Modal visible={activePicker !== null} transparent animationType="slide" onRequestClose={closePicker}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {activePicker === 'category' ? (
              <>
                <View style={styles.modalTopSection}>
                  <Text style={styles.modalTitle}>カテゴリを選択</Text>
                </View>
                <View style={styles.categoryPickerSection}>
                  <View style={styles.categoryPickerList}>
                    {CATEGORY_OPTIONS.map((category) => {
                      const active = categoryFilter.includes(category);
                      return (
                        <Pressable
                          key={category}
                          style={[styles.categoryPickerChip, active && styles.categoryPickerChipActive]}
                          onPress={() => toggleCategoryFilter(category)}
                        >
                          <Text style={[styles.categoryPickerChipText, active && styles.categoryPickerChipTextActive]}>
                            {category}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : activePicker === 'people' ? (
              <>
                <View style={styles.modalTopSection}>
                  <Text style={styles.modalTitle}>人数を選択</Text>
                </View>
                <View style={styles.modalWheelSection}>
                  <WheelPicker
                    values={PEOPLE_OPTIONS}
                    selectedValue={peopleFilter ?? 1}
                    onChange={setPeopleFilter}
                    renderLabel={(value) => `${value}名`}
                  />
                </View>
              </>
            ) : activePicker === 'duration' ? (
              <>
                <View style={styles.modalTopSection}>
                  <Text style={styles.modalTitle}>日数を選択</Text>
                </View>
                <View style={styles.modalWheelSection}>
                  <WheelPicker
                    values={DURATION_OPTIONS}
                    selectedValue={durationFilter ?? 1}
                    onChange={setDurationFilter}
                    renderLabel={(value) => `${value}日`}
                  />
                </View>
              </>
            ) : (
              <View />
            )}

            <View style={styles.modalBottomSection}>
              <Pressable style={styles.modalSecondaryButton} onPress={resetPicker}>
                <Text style={styles.modalSecondaryText}>リセット</Text>
              </Pressable>
              <Pressable style={styles.modalCloseBottomButton} onPress={closePicker}>
                <Text style={styles.modalCloseBottomText}>閉じる</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6F6',
  },
  searchSection: {
    gap: 12,
    padding: 16,
    paddingBottom: 8,
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
  filterChips: {
    gap: 8,
    paddingRight: 12,
  },
  filterChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChipActive: {
    borderColor: '#F7B28B',
    backgroundColor: '#FFF1E8',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#EC5B13',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    height: '64%',
  },
  modalTopSection: {
    gap: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    paddingTop: 4,
  },
  modalWheelSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  categoryPickerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryPickerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  categoryPickerChip: {
    minWidth: 112,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPickerChipActive: {
    borderColor: '#F7B28B',
    backgroundColor: '#FFF1E8',
  },
  categoryPickerChipText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#0F172A',
  },
  categoryPickerChipTextActive: {
    color: '#EC5B13',
  },
  wheelWrap: {
    width: '100%',
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS,
    position: 'relative',
    justifyContent: 'center',
  },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_ITEM_HEIGHT * 2,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: 14,
    backgroundColor: '#FFF1E8',
    borderWidth: 1,
    borderColor: '#F7B28B',
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#0F172A',
  },
  wheelItemGhost: {
    color: 'transparent',
  },
  modalBottomSection: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  modalSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  modalCloseBottomButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EC5B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBottomText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
