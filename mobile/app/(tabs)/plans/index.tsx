import { MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { savedPlans } from '@/data/travel';

type SortOrder = 'newest' | 'oldest';
type PickerTarget = 'people' | 'start' | 'end' | null;

export default function PlansListScreen() {
  const searchInputRef = useRef<TextInput>(null);
  const [keyword, setKeyword] = useState('');
  const [peopleFilter, setPeopleFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [activePicker, setActivePicker] = useState<PickerTarget>(null);
  const [selectedPeople, setSelectedPeople] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  const peopleOptions = useMemo(() => {
    const values = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    savedPlans.forEach((plan) => {
      const matched = plan.people.match(/(\d+)/);
      if (matched) {
        values.add(Number(matched[1]));
      }
    });
    return Array.from(values).sort((a, b) => a - b);
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const now = new Date().getFullYear();
    savedPlans.forEach((plan) => {
      const matched = plan.period.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (matched) {
        years.add(Number(matched[1]));
      }
    });
    for (let year = now - 5; year <= now + 5; year += 1) {
      years.add(year);
    }
    return Array.from(years).sort((a, b) => a - b);
  }, []);

  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const dayOptions = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => index + 1);
  }, [daysInMonth]);

  const parseDate = (value: string): number | null => {
    const matched = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (!matched) {
      return null;
    }
    const parsed = new Date(`${matched[1]}/${matched[2]}/${matched[3]}`).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };

  const parsePlanRange = (period: string) => {
    const matches = [...period.matchAll(/(\d{4}[/-]\d{1,2}[/-]\d{1,2})/g)].map((item) => item[1].replace(/-/g, '/'));
    const start = matches[0] ? parseDate(matches[0]) : null;
    const end = matches[1] ? parseDate(matches[1]) : start;
    return { start, end };
  };

  const parsePeople = (value: string) => {
    const matched = value.match(/(\d+)/);
    return matched ? Number(matched[1]) : null;
  };

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
  };

  const openPeoplePicker = () => {
    setSelectedPeople(parsePeople(peopleFilter) ?? 0);
    setActivePicker('people');
  };

  const openDatePicker = (target: 'start' | 'end') => {
    const current = target === 'start' ? startDateFilter : endDateFilter;
    const parsed = parseDate(current);
    const base = parsed ? new Date(parsed) : new Date();
    setSelectedYear(base.getFullYear());
    setSelectedMonth(base.getMonth() + 1);
    setSelectedDay(base.getDate());
    setActivePicker(target);
  };

  const closePicker = () => {
    setActivePicker(null);
  };

  const commitPicker = () => {
    if (activePicker === 'people') {
      setPeopleFilter(selectedPeople > 0 ? String(selectedPeople) : '');
      closePicker();
      return;
    }

    if (activePicker === 'start' || activePicker === 'end') {
      const safeDay = Math.min(selectedDay, new Date(selectedYear, selectedMonth, 0).getDate());
      const value = formatDate(selectedYear, selectedMonth, safeDay);
      if (activePicker === 'start') {
        setStartDateFilter(value);
      } else {
        setEndDateFilter(value);
      }
    }
    closePicker();
  };

  const filteredPlans = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const targetPeople = parsePeople(peopleFilter);
    const targetStart = parseDate(startDateFilter);
    const targetEnd = parseDate(endDateFilter);

    const filtered = savedPlans.filter((plan) => {
      const people = parsePeople(plan.people);
      const range = parsePlanRange(plan.period);
      const matchesKeyword =
        query === '' ||
        plan.title.toLowerCase().includes(query) ||
        plan.route.toLowerCase().includes(query) ||
        plan.period.toLowerCase().includes(query) ||
        plan.highlights.some((item) => item.toLowerCase().includes(query));
      const matchesPeople = targetPeople === null || people === targetPeople;
      const matchesStart = targetStart === null || (range.start !== null && range.start >= targetStart);
      const matchesEnd = targetEnd === null || (range.end !== null && range.end <= targetEnd);
      return matchesKeyword && matchesPeople && matchesStart && matchesEnd;
    });

    return filtered.sort((a, b) => {
      const aDate = parsePlanRange(a.period).start ?? 0;
      const bDate = parsePlanRange(b.period).start ?? 0;
      return sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
    });
  }, [endDateFilter, keyword, peopleFilter, sortOrder, startDateFilter]);

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
            ref={searchInputRef}
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
          <Pressable style={[styles.chip, peopleFilter ? styles.chipActive : null]} onPress={openPeoplePicker}>
            <Text style={[styles.chipText, peopleFilter ? styles.chipTextActive : null]}>
              {peopleFilter ? `${peopleFilter}名` : '人数'}
            </Text>
            <MaterialIcons name="expand-more" size={18} color={peopleFilter ? '#EC5B13' : '#64748B'} />
          </Pressable>

          <Pressable style={[styles.chip, startDateFilter ? styles.chipActive : null]} onPress={() => openDatePicker('start')}>
            <Text style={[styles.chipText, startDateFilter ? styles.chipTextActive : null]}>
              {startDateFilter || '開始日'}
            </Text>
            <MaterialIcons name="calendar-today" size={16} color={startDateFilter ? '#EC5B13' : '#64748B'} />
          </Pressable>

          <Pressable style={[styles.chip, endDateFilter ? styles.chipActive : null]} onPress={() => openDatePicker('end')}>
            <Text style={[styles.chipText, endDateFilter ? styles.chipTextActive : null]}>
              {endDateFilter || '終了日'}
            </Text>
            <MaterialIcons name="calendar-month" size={18} color={endDateFilter ? '#EC5B13' : '#64748B'} />
          </Pressable>

          <Pressable style={[styles.chip, keyword ? styles.chipActive : null]} onPress={() => searchInputRef.current?.focus()}>
            <Text style={[styles.chipText, keyword ? styles.chipTextActive : null]}>
              {keyword ? 'キーワードあり' : 'キーワード'}
            </Text>
            <MaterialIcons name="sell" size={18} color={keyword ? '#EC5B13' : '#64748B'} />
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.resultRow}>
          <Text style={styles.resultText}>{filteredPlans.length}件のプランが見つかりました</Text>
          <Pressable style={styles.sortButton} onPress={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}>
            <MaterialIcons name="sort" size={18} color="#EC5B13" />
            <Text style={styles.sortButtonText}>{sortLabel}</Text>
          </Pressable>
        </View>

        {filteredPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>条件に合うプランがありません</Text>
            <Text style={styles.emptyBody}>検索ワードや日付条件を変えてください。</Text>
          </View>
        ) : null}

        <View style={styles.cardList}>
          {filteredPlans.map((plan) => (
            <Link key={plan.id} href={{ pathname: '/plans/detail', params: { id: plan.id } }} asChild>
              <Pressable style={styles.card}>
                <Image source={{ uri: plan.image }} style={styles.cardImage} />
                <View style={styles.favoriteBubble}>
                  <MaterialIcons
                    name={plan.status === 'completed' ? 'favorite-border' : 'favorite'}
                    size={20}
                    color={plan.status === 'completed' ? '#94A3B8' : '#EC5B13'}
                  />
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {plan.title}
                    </Text>
                    <View style={[styles.statusTag, plan.status === 'completed' ? styles.statusDraft : styles.statusSaved]}>
                      <Text style={[styles.statusTagText, plan.status === 'completed' ? styles.statusDraftText : styles.statusSavedText]}>
                        {plan.status === 'completed' ? '下書き' : '保存済み'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaStack}>
                    <View style={styles.metaRow}>
                      <MaterialIcons name="calendar-today" size={18} color="#64748B" />
                      <Text style={styles.metaText}>{plan.period}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <MaterialIcons name="group" size={18} color="#64748B" />
                      <Text style={styles.metaText}>{plan.people}</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.avatarStack}>
                      <View style={[styles.avatar, styles.avatarPrimary]}>
                        <Text style={styles.avatarText}>FT</Text>
                      </View>
                      <View style={[styles.avatar, styles.avatarSecondary]}>
                        <Text style={[styles.avatarText, styles.avatarTextSecondary]}>{plan.id.slice(-1).toUpperCase()}</Text>
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
        </View>
      </ScrollView>

      <Modal visible={activePicker !== null} transparent animationType="slide" onRequestClose={closePicker}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={closePicker} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {activePicker === 'people' ? '人数を選択' : activePicker === 'start' ? '開始日を選択' : '終了日を選択'}
            </Text>

            {activePicker === 'people' ? (
              <ScrollView style={styles.singlePicker} showsVerticalScrollIndicator={false} contentContainerStyle={styles.singlePickerContent}>
                <Pressable style={[styles.pickerPill, selectedPeople === 0 ? styles.pickerPillActive : null]} onPress={() => setSelectedPeople(0)}>
                  <Text style={[styles.pickerPillText, selectedPeople === 0 ? styles.pickerPillTextActive : null]}>指定なし</Text>
                </Pressable>
                {peopleOptions.map((value) => (
                  <Pressable
                    key={`people-${value}`}
                    style={[styles.pickerPill, selectedPeople === value ? styles.pickerPillActive : null]}
                    onPress={() => setSelectedPeople(value)}
                  >
                    <Text style={[styles.pickerPillText, selectedPeople === value ? styles.pickerPillTextActive : null]}>{value}名</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.pickerColumns}>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>年</Text>
                  <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnContent}>
                    {availableYears.map((year) => (
                      <Pressable
                        key={`year-${year}`}
                        style={[styles.pickerPill, selectedYear === year ? styles.pickerPillActive : null]}
                        onPress={() => {
                          setSelectedYear(year);
                          setSelectedDay((prev) => Math.min(prev, new Date(year, selectedMonth, 0).getDate()));
                        }}
                      >
                        <Text style={[styles.pickerPillText, selectedYear === year ? styles.pickerPillTextActive : null]}>{year}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>月</Text>
                  <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnContent}>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <Pressable
                        key={`month-${month}`}
                        style={[styles.pickerPill, selectedMonth === month ? styles.pickerPillActive : null]}
                        onPress={() => {
                          setSelectedMonth(month);
                          setSelectedDay((prev) => Math.min(prev, new Date(selectedYear, month, 0).getDate()));
                        }}
                      >
                        <Text style={[styles.pickerPillText, selectedMonth === month ? styles.pickerPillTextActive : null]}>
                          {String(month).padStart(2, '0')}月
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>日</Text>
                  <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnContent}>
                    {dayOptions.map((day) => (
                      <Pressable
                        key={`day-${day}`}
                        style={[styles.pickerPill, selectedDay === day ? styles.pickerPillActive : null]}
                        onPress={() => setSelectedDay(day)}
                      >
                        <Text style={[styles.pickerPillText, selectedDay === day ? styles.pickerPillTextActive : null]}>
                          {String(day).padStart(2, '0')}日
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryButton} onPress={closePicker}>
                <Text style={styles.modalSecondaryText}>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.modalPrimaryButton} onPress={commitPicker}>
                <Text style={styles.modalPrimaryText}>決定</Text>
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
  header: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(248, 246, 246, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
    marginBottom: 14,
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
    paddingRight: 8,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#FFF1E8',
    borderColor: '#F4B18A',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#EC5B13',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
    gap: 18,
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
  favoriteBubble: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
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
  },
  statusSaved: {
    backgroundColor: '#FFF1E8',
  },
  statusDraft: {
    backgroundColor: '#F1F5F9',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusSavedText: {
    color: '#EC5B13',
  },
  statusDraftText: {
    color: '#64748B',
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
    justifyContent: 'space-between',
  },
  avatarStack: {
    flexDirection: 'row',
    marginLeft: 2,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginLeft: -6,
  },
  avatarPrimary: {
    backgroundColor: '#FDE7D8',
  },
  avatarSecondary: {
    backgroundColor: '#CBD5E1',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C2D12',
  },
  avatarTextSecondary: {
    color: '#475569',
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  modalDismiss: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    gap: 14,
    maxHeight: '78%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  singlePicker: {
    maxHeight: 280,
  },
  singlePickerContent: {
    gap: 8,
    paddingBottom: 8,
  },
  pickerColumns: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerColumn: {
    flex: 1,
    gap: 8,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  columnScroll: {
    maxHeight: 260,
  },
  columnContent: {
    gap: 8,
    paddingBottom: 8,
  },
  pickerPill: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pickerPillActive: {
    backgroundColor: '#FFF1E8',
    borderColor: '#F4B18A',
  },
  pickerPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  pickerPillTextActive: {
    color: '#EC5B13',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#EC5B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
