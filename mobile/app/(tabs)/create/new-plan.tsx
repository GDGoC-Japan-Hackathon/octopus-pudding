import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  ParticipantCountField,
  ScheduleField,
} from '@/features/trips/components/TripBasicInfoFields';
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
const BUDGET_STEP = 10000;
const MAX_PARTICIPANT_COUNT = 10;
const MAX_TRIP_DAYS = 3;
const MAX_BUDGET_PER_PERSON = 100000;
const REQUIRED_FIELD_KEYS = new Set(['origin', 'destination', 'participantCount', 'budget'] as const);
type EditableFieldKey = 'origin' | 'destination' | 'participantCount' | 'budget' | 'startDate' | 'endDate';

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

  const updateField = (key: EditableFieldKey, value: string) => {
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

  const budgetSliderMax = MAX_BUDGET_PER_PERSON;

  const budgetRawValue = useMemo(() => {
    const parsed = Number(fields.budget);
    if (!Number.isFinite(parsed) || parsed < BUDGET_STEP) {
      return BUDGET_STEP;
    }
    return parsed;
  }, [fields.budget]);

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
            {item.key !== 'participantCount' ? (
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
            ) : null}
            {item.key === 'participantCount' ? (
              <ParticipantCountField
                participantCount={fields.participantCount}
                onChangeParticipantCount={(value) => updateField('participantCount', value)}
                required
                maxParticipantCount={MAX_PARTICIPANT_COUNT}
              />
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
                  <ScheduleField
                    startDate={fields.startDate}
                    endDate={fields.endDate}
                    onChangeStartDate={(value) => updateField('startDate', value)}
                    onChangeEndDate={(value) => updateField('endDate', value)}
                    required
                    maxTripDays={MAX_TRIP_DAYS}
                  />
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
});
