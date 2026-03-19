import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { weatherMock } from '@/data/travel';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import {
  type CreateTripFormValues,
  validateAndBuildCreateTripPayload,
} from '@/features/trips/utils/create-trip';
import {
  clearCreateTripDraft,
  getCreateTripDraft,
  setCreateTripDraft,
} from '@/features/trips/utils/create-trip-draft';

const formItems = [
  {
    key: 'origin',
    label: '出発地',
    placeholder: '例: 東京',
  },
  {
    key: 'destination',
    label: '目的地（都市・エリア）',
    placeholder: '例: 京都 / 札幌 / 箱根 / 那覇',
  },
  {
    key: 'participantCount',
    label: '人数',
    placeholder: '例: 4',
  },
  {
    key: 'budget',
    label: '1人あたりの予算（全日程）',
    placeholder: '',
  },
] as const;

const destinationSuggestions = ['東京', '大阪', '京都', '札幌', '福岡', '那覇', '箱根', '軽井沢'] as const;
const ATMOSPHERE_OPTIONS = ['のんびり', 'アクティブ', '映え'] as const;
const RECOMMEND_CATEGORY_OPTIONS = ['カフェ', '夜景', 'グルメ', '温泉'] as const;
type DateFieldKey = 'startDate' | 'endDate';
const BUDGET_STEP = 10000;
const MAX_PARTICIPANT_COUNT = 10;
const MAX_TRIP_DAYS = 3;
const MAX_BUDGET_PER_PERSON = 100000;
const REQUIRED_FIELD_KEYS = new Set(['origin', 'destination', 'participantCount', 'budget'] as const);

function parseDateInput(value: string) {
  if (!value) return null;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return value;
  return `${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${String(parsed.getDate()).padStart(2, '0')}`;
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function subtractDays(base: Date, days: number) {
  return addDays(base, -days);
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={[travelStyles.sectionBody, styles.fieldLabel]}>{label}</Text>
      {required ? <Text style={styles.requiredMark}>※</Text> : null}
    </View>
  );
}

export default function PlanCreateScreen() {
  const router = useRouter();
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const isResolvingCurrentLocationRef = useRef(false);
  const [activeDateField, setActiveDateField] = useState<DateFieldKey>('startDate');
  const [isIosDateModalVisible, setIsIosDateModalVisible] = useState(false);
  const [fields, setFields] = useState<CreateTripFormValues>(() => getCreateTripDraft().formValues);
  const [selectedCompanionUserIds, setSelectedCompanionUserIds] = useState<number[]>(
    () => getCreateTripDraft().selectedCompanionUserIds
  );
  const headerBackSlot = (
    <Pressable
      style={styles.headerBackButton}
      onPress={() => {
        clearCreateTripDraft();
        router.replace('/create');
      }}
    >
      <MaterialIcons name="arrow-back" size={16} color="#EC5B13" />
      <Text style={styles.headerBackButtonText}>戻る</Text>
    </Pressable>
  );

  const updateField = (key: (typeof formItems)[number]['key'], value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  useFocusEffect(
    useCallback(() => {
      const draft = getCreateTripDraft();
      setFields(draft.formValues);
      setSelectedCompanionUserIds(draft.selectedCompanionUserIds);
    }, [])
  );

  const toggleRecommendationCategory = useCallback((category: string) => {
    setFields((prev) => ({
      ...prev,
      recommendationCategories: prev.recommendationCategories.includes(category)
        ? prev.recommendationCategories.filter((item) => item !== category)
        : [...prev.recommendationCategories, category],
    }));
  }, []);

  const applyDateField = useCallback((field: DateFieldKey, date: Date) => {
    const formatted = formatDateInput(date);

    setFields((prev) => {
      const next = { ...prev, [field]: formatted };
      const start = parseDateInput(field === 'startDate' ? formatted : prev.startDate);
      let end = parseDateInput(field === 'endDate' ? formatted : prev.endDate);

      if (start && end) {
        if (end.getTime() < start.getTime()) {
          if (field === 'startDate') {
            next.endDate = formatted;
            end = start;
          } else {
            next.startDate = formatted;
          }
        }

        const maxEnd = addDays(start, MAX_TRIP_DAYS - 1);
        if (end.getTime() > maxEnd.getTime()) {
          next.endDate = formatDateInput(maxEnd);
        }
      }

      return next;
    });
  }, []);

  const openAndroidDatePicker = useCallback(
    (field: DateFieldKey) => {
      const baseValue =
        parseDateInput(fields[field]) ??
        (field === 'endDate' ? parseDateInput(fields.startDate) : null) ??
        new Date();

      DateTimePickerAndroid.open({
        mode: 'date',
        display: 'calendar',
        value: baseValue,
        minimumDate:
          field === 'endDate'
            ? parseDateInput(fields.startDate) ?? undefined
            : (() => {
              const end = parseDateInput(fields.endDate);
              return end ? subtractDays(end, MAX_TRIP_DAYS - 1) : undefined;
            })(),
        maximumDate:
          field === 'endDate'
            ? (() => {
              const start = parseDateInput(fields.startDate);
              return start ? addDays(start, MAX_TRIP_DAYS - 1) : undefined;
            })()
            : parseDateInput(fields.endDate) ?? undefined,
        onChange: (event, selectedDate) => {
          if (event.type !== 'set' || !selectedDate) {
            return;
          }

          applyDateField(field, selectedDate);

          if (field === 'startDate') {
            setTimeout(() => {
              openAndroidDatePicker('endDate');
            }, 0);
          }
        },
      });
    },
    [applyDateField, fields.endDate, fields.startDate]
  );

  const openSchedulePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      openAndroidDatePicker('startDate');
      return;
    }

    setActiveDateField(fields.endDate ? 'endDate' : 'startDate');
    setIsIosDateModalVisible(true);
  }, [fields.endDate, openAndroidDatePicker]);

  const iosPickerValue = useMemo(
    () =>
      parseDateInput(fields[activeDateField]) ??
      (activeDateField === 'endDate' ? parseDateInput(fields.startDate) : null) ??
      new Date(),
    [activeDateField, fields.endDate, fields.startDate]
  );

  const scheduleLabel = useMemo(() => {
    if (fields.startDate && fields.endDate) {
      return `${formatDateDisplay(fields.startDate)} 〜 ${formatDateDisplay(fields.endDate)}`;
    }
    if (fields.startDate) {
      return `${formatDateDisplay(fields.startDate)} 〜 終了日を選択`;
    }
    return '開始日〜終了日を選択';
  }, [fields.endDate, fields.startDate]);

  const participantCountNumber = useMemo(() => {
    const parsed = Number(fields.participantCount);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return 1;
    }
    return parsed;
  }, [fields.participantCount]);

  const budgetSliderMax = MAX_BUDGET_PER_PERSON;

  const budgetRawValue = useMemo(() => {
    const parsed = Number(fields.budget);
    if (!Number.isFinite(parsed) || parsed < BUDGET_STEP) {
      return BUDGET_STEP;
    }
    return parsed;
  }, [fields.budget]);

  const handleIosDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (event.type === 'dismissed' || !selectedDate) {
        return;
      }
      applyDateField(activeDateField, selectedDate);
    },
    [activeDateField, applyDateField]
  );

  const resolveCurrentLocationLabel = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('位置情報の利用が許可されていません。端末の設定から許可してください。');
    }

    const currentPosition = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const [place] = await Location.reverseGeocodeAsync({
      latitude: currentPosition.coords.latitude,
      longitude: currentPosition.coords.longitude,
    });

    const areaParts = [place?.region, place?.city, place?.district].filter(
      (value): value is string => Boolean(value && value.trim())
    );

    if (areaParts.length) {
      return areaParts.join(' ');
    }

    return `${currentPosition.coords.latitude.toFixed(4)}, ${currentPosition.coords.longitude.toFixed(4)}`;
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    if (isResolvingCurrentLocationRef.current) {
      return;
    }

    try {
      isResolvingCurrentLocationRef.current = true;
      setIsResolvingCurrentLocation(true);
      const origin = await resolveCurrentLocationLabel();
      updateField('origin', origin);
    } catch (error) {
      const message = error instanceof Error ? error.message : '現在地の取得に失敗しました。';
      Alert.alert('現在地を取得できませんでした', message);
    } finally {
      setIsResolvingCurrentLocation(false);
      isResolvingCurrentLocationRef.current = false;
    }
  }, [resolveCurrentLocationLabel, updateField]);

  const handleOpenCompanions = () => {
    setCreateTripDraft({
      formValues: fields,
      selectedCompanionUserIds,
    });
    router.push('/create/companions');
  };

  const handleSubmit = async () => {
    const result = validateAndBuildCreateTripPayload(fields);
    if (!result.ok) {
      Alert.alert('入力エラー', result.message);
      return;
    }
    setCreateTripDraft({
      formValues: fields,
      selectedCompanionUserIds,
    });
    router.push('/create/generating');
  };

  return (
    <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader
        title="基本情報の入力"
        weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
        leftSlot={headerBackSlot}
      />

      <View style={travelStyles.container}>
        <Text style={styles.requiredLegend}>※必須</Text>
        {formItems.map((item) => (
          <View key={item.key} style={styles.fieldBlock}>
            <View style={travelStyles.rowWrap}>
              <FieldLabel label={item.label} required={REQUIRED_FIELD_KEYS.has(item.key)} />
              {item.key === 'origin' ? (
                <Pressable
                  style={[
                    travelStyles.pillButton,
                    styles.currentLocationButton,
                    isResolvingCurrentLocation ? styles.currentLocationButtonDisabled : null,
                  ]}
                  onPress={handleUseCurrentLocation}
                  disabled={isResolvingCurrentLocation}
                >
                  {isResolvingCurrentLocation ? (
                    <ActivityIndicator color="#F97316" size="small" />
                  ) : (
                    <Text style={[travelStyles.pillText, styles.currentLocationButtonText]}>現在地を入力</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            {item.key === 'participantCount' ? (
              <View style={styles.stepperWrap}>
                <Pressable
                  style={[styles.stepperButton, Number(fields.participantCount) <= 1 ? styles.stepperButtonDisabled : null]}
                  onPress={() => {
                    const next = Math.max(1, Number(fields.participantCount || '1') - 1);
                    updateField('participantCount', String(next));
                  }}
                  disabled={Number(fields.participantCount) <= 1}
                >
                  <MaterialIcons name="remove" size={20} color={Number(fields.participantCount) <= 1 ? '#94A3B8' : '#334155'} />
                </Pressable>

                <View style={styles.stepperValueWrap}>
                  <Text style={styles.stepperValueText}>{fields.participantCount || '1'}</Text>
                  <Text style={styles.stepperValueUnit}>人</Text>
                </View>

                <Pressable
                  style={[
                    styles.stepperButton,
                    Number(fields.participantCount) >= MAX_PARTICIPANT_COUNT ? styles.stepperButtonDisabled : null,
                  ]}
                  onPress={() => {
                    const next = Math.min(MAX_PARTICIPANT_COUNT, Math.max(1, Number(fields.participantCount || '1') + 1));
                    updateField('participantCount', String(next));
                  }}
                  disabled={Number(fields.participantCount) >= MAX_PARTICIPANT_COUNT}
                >
                  <MaterialIcons
                    name="add"
                    size={20}
                    color={Number(fields.participantCount) >= MAX_PARTICIPANT_COUNT ? '#94A3B8' : '#334155'}
                  />
                </Pressable>
              </View>
            ) : item.key === 'budget' ? (
              <View style={styles.budgetSection}>
                <View style={styles.stepperWrap}>
                  <Pressable
                    style={[styles.stepperButton, budgetRawValue <= BUDGET_STEP ? styles.stepperButtonDisabled : null]}
                    onPress={() => {
                      if (budgetRawValue <= BUDGET_STEP) {
                        return;
                      }
                      updateField('budget', String(Math.max(BUDGET_STEP, budgetRawValue - BUDGET_STEP)));
                    }}
                    disabled={budgetRawValue <= BUDGET_STEP}
                  >
                    <MaterialIcons
                      name="remove"
                      size={20}
                      color={budgetRawValue <= BUDGET_STEP ? '#94A3B8' : '#334155'}
                    />
                  </Pressable>

                  <View style={styles.stepperValueWrap}>
                    <Text style={styles.stepperValueText}>{budgetRawValue.toLocaleString('ja-JP')}</Text>
                    <Text style={styles.stepperValueUnit}>円 / 1人</Text>
                  </View>

                  <Pressable
                    style={[styles.stepperButton, budgetRawValue >= budgetSliderMax ? styles.stepperButtonDisabled : null]}
                    onPress={() => {
                      const next = Math.min(budgetSliderMax, (budgetRawValue > 0 ? budgetRawValue : 0) + BUDGET_STEP);
                      updateField('budget', String(next));
                    }}
                    disabled={budgetRawValue >= budgetSliderMax}
                  >
                    <MaterialIcons
                      name="add"
                      size={20}
                      color={budgetRawValue >= budgetSliderMax ? '#94A3B8' : '#334155'}
                    />
                  </Pressable>
                </View>
              </View>
            ) : (
              <TextInput
                style={travelStyles.input}
                value={fields[item.key]}
                onChangeText={(value) => updateField(item.key, value)}
                placeholder={item.placeholder}
                placeholderTextColor="#94A3B8"
                keyboardType="default"
                autoCapitalize="none"
              />
            )}
            {item.key === 'destination' ? (
              <>
                <View style={styles.destinationSuggestionWrap}>
                  {destinationSuggestions.map((suggestion) => {
                    const isSelected = fields.destination.trim() === suggestion;
                    return (
                      <Pressable
                        key={suggestion}
                        style={[styles.destinationSuggestionChip, isSelected ? styles.destinationSuggestionChipSelected : null]}
                        onPress={() => updateField('destination', suggestion)}
                      >
                        <Text
                          style={[
                            styles.destinationSuggestionText,
                            isSelected ? styles.destinationSuggestionTextSelected : null,
                          ]}
                        >
                          {suggestion}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.scheduleSection}>
                  <FieldLabel label="日程" required />
                  <Pressable style={styles.scheduleInput} onPress={openSchedulePicker}>
                    <View style={styles.scheduleInputBody}>
                      <MaterialIcons name="calendar-month" size={20} color="#F97316" />
                      <View style={styles.scheduleTextWrap}>
                        <Text
                          style={[
                            styles.scheduleValueText,
                            !(fields.startDate || fields.endDate) ? styles.schedulePlaceholderText : null,
                          ]}
                        >
                          {scheduleLabel}
                        </Text>
                        <Text style={styles.scheduleHelperText}>タップしてカレンダーで選択</Text>
                      </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        ))}

        <View style={styles.fieldBlock}>
          <FieldLabel label="雰囲気" />
          <View style={styles.optionWrap}>
            {ATMOSPHERE_OPTIONS.map((option) => {
              const active = fields.atmosphere === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                  onPress={() =>
                    setFields((prev) => ({
                      ...prev,
                      atmosphere: prev.atmosphere === option ? '' : option,
                    }))
                  }
                >
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <FieldLabel label="カテゴリ（複数選択可）" />
          <View style={styles.optionWrap}>
            {RECOMMEND_CATEGORY_OPTIONS.map((option) => {
              const active = fields.recommendationCategories.includes(option);
              return (
                <Pressable
                  key={option}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                  onPress={() => toggleRecommendationCategory(option)}
                >
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <FieldLabel label="同行者" />
          <Pressable style={styles.companionSelector} onPress={handleOpenCompanions}>
            <View style={styles.companionSelectorBody}>
              <MaterialIcons name="group" size={20} color="#F97316" />
              <View style={styles.companionSelectorTextWrap}>
                <Text style={styles.companionSelectorTitle}>同行者を選ぶ</Text>
                <Text style={styles.companionSelectorBodyText}>
                  {selectedCompanionUserIds.length
                    ? `${selectedCompanionUserIds.length}人を選択済み`
                    : '選択しなくても作成できます'}
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
          </Pressable>
        </View>

        <Pressable
          style={travelStyles.primaryButton}
          onPress={handleSubmit}
        >
          <Text style={travelStyles.primaryButtonText}>プランを作成する</Text>
        </Pressable>
      </View>

      <Modal visible={isIosDateModalVisible} transparent animationType="slide" onRequestClose={() => setIsIosDateModalVisible(false)}>
        <View style={styles.dateModalOverlay}>
          <View style={styles.dateModalSheet}>
            <View style={styles.dateModalHeader}>
              <Text style={styles.dateModalTitle}>日程を選択</Text>
              <Pressable onPress={() => setIsIosDateModalVisible(false)}>
                <Text style={styles.dateModalCloseText}>完了</Text>
              </Pressable>
            </View>

            <View style={styles.dateFieldTabs}>
              <Pressable
                style={[styles.dateFieldTab, activeDateField === 'startDate' ? styles.dateFieldTabActive : null]}
                onPress={() => setActiveDateField('startDate')}
              >
                <Text style={[styles.dateFieldTabText, activeDateField === 'startDate' ? styles.dateFieldTabTextActive : null]}>
                  開始日
                </Text>
              </Pressable>
              <Pressable
                style={[styles.dateFieldTab, activeDateField === 'endDate' ? styles.dateFieldTabActive : null]}
                onPress={() => setActiveDateField('endDate')}
              >
                <Text style={[styles.dateFieldTabText, activeDateField === 'endDate' ? styles.dateFieldTabTextActive : null]}>
                  終了日
                </Text>
              </Pressable>
            </View>

            <View style={styles.datePreviewCard}>
              <Text style={styles.datePreviewText}>{scheduleLabel}</Text>
            </View>

            <DateTimePicker
              mode="date"
              display="inline"
              themeVariant="light"
              value={iosPickerValue}
              minimumDate={
                activeDateField === 'endDate'
                  ? parseDateInput(fields.startDate) ?? undefined
                  : (() => {
                    const end = parseDateInput(fields.endDate);
                    return end ? subtractDays(end, MAX_TRIP_DAYS - 1) : undefined;
                  })()
              }
              maximumDate={
                activeDateField === 'endDate'
                  ? (() => {
                    const start = parseDateInput(fields.startDate);
                    return start ? addDays(start, MAX_TRIP_DAYS - 1) : undefined;
                  })()
                  : parseDateInput(fields.endDate) ?? undefined
              }
              onChange={handleIosDateChange}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerBackButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headerBackButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EC5B13',
  },
  fieldBlock: {
    marginBottom: 18,
  },
  requiredLegend: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  requiredNote: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  optionChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  optionChipTextActive: {
    color: '#EA580C',
  },
  currentLocationButton: {
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  requiredMark: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: -1,
  },
  currentLocationButtonDisabled: {
    opacity: 0.7,
  },
  currentLocationButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  companionSelector: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  companionSelectorBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  companionSelectorTextWrap: {
    flex: 1,
    gap: 2,
  },
  companionSelectorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  companionSelectorBodyText: {
    fontSize: 12,
    color: '#64748B',
  },
  scheduleSection: {
    marginTop: 22,
  },
  scheduleInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scheduleInputBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  scheduleTextWrap: {
    flex: 1,
    gap: 2,
  },
  scheduleValueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  schedulePlaceholderText: {
    color: '#94A3B8',
  },
  scheduleHelperText: {
    fontSize: 12,
    color: '#64748B',
  },
  stepperWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  stepperValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  stepperValueText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepperValueUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  budgetSection: {
    marginTop: 0,
    gap: 0,
  },
  destinationSuggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  destinationSuggestionChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  destinationSuggestionChipSelected: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  destinationSuggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  destinationSuggestionTextSelected: {
    color: '#EA580C',
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-end',
  },
  dateModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateModalCloseText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F97316',
  },
  dateFieldTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  dateFieldTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  dateFieldTabActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  dateFieldTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  dateFieldTabTextActive: {
    color: '#EA580C',
  },
  datePreviewCard: {
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  datePreviewText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
});
