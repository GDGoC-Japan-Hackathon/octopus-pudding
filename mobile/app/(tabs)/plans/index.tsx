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
import { AppHeader } from '@/features/travel/components/AppHeader';
import { getTrips } from '@/features/trips/api/get-trips';
import { type TripResponse } from '@/features/trips/types/trip-edit';
import { type TripListItemViewModel, type TripSortOrder } from '@/features/trips/types/trip-list';
import { filterTripListItems, toTripListItemViewModel } from '@/features/trips/utils/trip-list';

type PickerType = 'people' | 'start' | 'end' | null;
type DatePart = 'year' | 'month' | 'day';

const PLAN_IMAGE_URL =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80';
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 5;
const PEOPLE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);
const YEAR_OPTIONS = Array.from({ length: 31 }, (_, index) => 2000 + index);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDateLabel(year: number, month: number, day: number) {
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
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

export default function PlansListScreen() {
  const [plans, setPlans] = useState<TripResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [peopleFilter, setPeopleFilter] = useState<number | null>(null);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<TripSortOrder>('newest');
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [activeDatePart, setActiveDatePart] = useState<DatePart>('year');
  const [draftPeople, setDraftPeople] = useState(1);
  const [draftYear, setDraftYear] = useState(2025);
  const [draftMonth, setDraftMonth] = useState(1);
  const [draftDay, setDraftDay] = useState(1);

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

  const dayOptions = useMemo(
    () => Array.from({ length: getDaysInMonth(draftYear, draftMonth) }, (_, index) => index + 1),
    [draftMonth, draftYear]
  );

  const planItems = useMemo<TripListItemViewModel[]>(() => plans.map(toTripListItemViewModel), [plans]);

  const filteredPlans = useMemo(
    () =>
      filterTripListItems(planItems, {
        keyword,
        startDate: startDateFilter,
        endDate: endDateFilter,
        sortOrder,
        participantCount: peopleFilter,
      }),
    [endDateFilter, keyword, peopleFilter, planItems, sortOrder, startDateFilter]
  );

  const openPeoplePicker = useCallback(() => {
    setDraftPeople(peopleFilter ?? 1);
    setActivePicker('people');
  }, [peopleFilter]);

  const openDatePicker = useCallback(
    (type: 'start' | 'end') => {
      const source = type === 'start' ? startDateFilter : endDateFilter;
      const parsed = source ? new Date(source.replace(/\./g, '/').replace(/-/g, '/')) : new Date();
      const year = parsed.getFullYear();
      const month = parsed.getMonth() + 1;
      const day = parsed.getDate();

      setDraftYear(Math.min(Math.max(year, YEAR_OPTIONS[0]), YEAR_OPTIONS[YEAR_OPTIONS.length - 1]));
      setDraftMonth(month);
      setDraftDay(day);
      setActiveDatePart('year');
      setActivePicker(type);
    },
    [endDateFilter, startDateFilter]
  );

  const closePicker = useCallback(() => {
    setActivePicker(null);
  }, []);

  const resetPicker = useCallback(() => {
    if (activePicker === 'people') {
      setPeopleFilter(null);
    }
    if (activePicker === 'start') {
      setStartDateFilter('');
    }
    if (activePicker === 'end') {
      setEndDateFilter('');
    }
    setActivePicker(null);
  }, [activePicker]);

  const confirmPicker = useCallback(() => {
    if (activePicker === 'people') {
      setPeopleFilter(draftPeople);
    }

    if (activePicker === 'start' || activePicker === 'end') {
      const nextDate = formatDateLabel(draftYear, draftMonth, draftDay);
      if (activePicker === 'start') {
        setStartDateFilter(nextDate);
      } else {
        setEndDateFilter(nextDate);
      }
    }

    setActivePicker(null);
  }, [activePicker, draftDay, draftMonth, draftPeople, draftYear]);

  const sortLabel = sortOrder === 'newest' ? '新しい順' : '古い順';
  const peopleLabel = peopleFilter ? `${peopleFilter}名` : '人数';
  const startLabel = startDateFilter || '開始日';
  const endLabel = endDateFilter || '終了日';

  return (
    <View style={styles.screen}>
      <AppHeader title="マイプラン" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
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
            <Pressable style={[styles.filterChip, !!peopleFilter && styles.filterChipActive]} onPress={openPeoplePicker}>
              <Text style={[styles.filterChipText, !!peopleFilter && styles.filterChipTextActive]}>{peopleLabel}</Text>
              <MaterialIcons name="expand-more" size={18} color={peopleFilter ? '#EC5B13' : '#64748B'} />
            </Pressable>
            <Pressable
              style={[styles.filterChip, !!startDateFilter && styles.filterChipActive]}
              onPress={() => openDatePicker('start')}
            >
              <Text style={[styles.filterChipText, !!startDateFilter && styles.filterChipTextActive]}>{startLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, !!endDateFilter && styles.filterChipActive]}
              onPress={() => openDatePicker('end')}
            >
              <Text style={[styles.filterChipText, !!endDateFilter && styles.filterChipTextActive]}>{endLabel}</Text>
            </Pressable>
          </ScrollView>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultText}>{filteredPlans.length}件のプランが見つかりました</Text>
          <Pressable style={styles.sortButton} onPress={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}>
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
            <Text style={styles.emptyTitle}>計画が見つかりませんでした</Text>
            <Text style={styles.emptyBody}>検索条件を見直すか、新しい計画を作成してください。</Text>
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
        </View>
      </ScrollView>

      <Modal visible={activePicker !== null} transparent animationType="slide" onRequestClose={closePicker}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTopSection}>
              <Text style={styles.modalTitle}>
                {activePicker === 'people'
                  ? '人数を選択'
                  : activePicker === 'start'
                    ? '開始日を選択'
                    : '終了日を選択'}
              </Text>

              <Pressable style={styles.modalCloseButton} onPress={closePicker}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </Pressable>

              {activePicker === 'people' ? null : (
                <View style={styles.datePartRow}>
                  <Pressable
                    style={[styles.datePartButton, activeDatePart === 'year' && styles.datePartButtonActive]}
                    onPress={() => setActiveDatePart('year')}
                  >
                    <Text style={[styles.datePartButtonText, activeDatePart === 'year' && styles.datePartButtonTextActive]}>
                      年
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.datePartButton, activeDatePart === 'month' && styles.datePartButtonActive]}
                    onPress={() => setActiveDatePart('month')}
                  >
                    <Text style={[styles.datePartButtonText, activeDatePart === 'month' && styles.datePartButtonTextActive]}>
                      月
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.datePartButton, activeDatePart === 'day' && styles.datePartButtonActive]}
                    onPress={() => setActiveDatePart('day')}
                  >
                    <Text style={[styles.datePartButtonText, activeDatePart === 'day' && styles.datePartButtonTextActive]}>
                      日
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.modalWheelSection}>
              {activePicker === 'people' ? (
                <WheelPicker
                  values={PEOPLE_OPTIONS}
                  selectedValue={draftPeople}
                  onChange={setDraftPeople}
                  renderLabel={(value) => `${value}名`}
                />
              ) : (
                <WheelPicker
                  values={
                    activeDatePart === 'year'
                      ? YEAR_OPTIONS
                      : activeDatePart === 'month'
                        ? MONTH_OPTIONS
                        : dayOptions
                  }
                  selectedValue={
                    activeDatePart === 'year'
                      ? draftYear
                      : activeDatePart === 'month'
                        ? draftMonth
                        : Math.min(draftDay, dayOptions.length)
                  }
                  onChange={(value) => {
                    if (activeDatePart === 'year') {
                      setDraftYear(value);
                      const maxDay = getDaysInMonth(value, draftMonth);
                      if (draftDay > maxDay) {
                        setDraftDay(maxDay);
                      }
                    } else if (activeDatePart === 'month') {
                      setDraftMonth(value);
                      const maxDay = getDaysInMonth(draftYear, value);
                      if (draftDay > maxDay) {
                        setDraftDay(maxDay);
                      }
                    } else {
                      setDraftDay(value);
                    }
                  }}
                  renderLabel={(value) =>
                    activeDatePart === 'year' ? `${value}年` : activeDatePart === 'month' ? `${value}月` : `${value}日`
                  }
                />
              )}
            </View>

            <View style={styles.modalBottomSection}>
              <Pressable style={styles.modalSecondaryButton} onPress={resetPicker}>
                <Text style={styles.modalSecondaryText}>リセット</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={confirmPicker}>
                <Text style={styles.modalPrimaryButtonText}>決定</Text>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
    gap: 18,
  },
  searchSection: {
    gap: 12,
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
    textAlign: 'center',
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
  favoriteBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
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
    backgroundColor: '#EC5B13',
    width: 108,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  detailButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
    position: 'relative',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    paddingTop: 4,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePartRow: {
    flexDirection: 'row',
    gap: 8,
  },
  datePartButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePartButtonActive: {
    borderColor: '#F7B28B',
    backgroundColor: '#FFF1E8',
  },
  datePartButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  datePartButtonTextActive: {
    color: '#EC5B13',
  },
  modalWheelSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
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
  modalPrimaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EC5B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
