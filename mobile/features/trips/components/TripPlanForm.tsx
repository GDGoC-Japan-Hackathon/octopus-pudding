import { BackButton } from '@/components/back-button';
import { getFriends } from '@/features/friends/api/get-friends';
import { type FriendResponse } from '@/features/friends/types/friend-request';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { ScheduleField } from '@/features/trips/components/TripBasicInfoFields';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type CreateTripFormValues } from '@/features/trips/utils/create-trip';

type TripPlanFormSubmitPayload = {
  formValues: CreateTripFormValues;
  selectedCompanionUserIds: number[];
};

type TripPlanFormProps = {
  title: string;
  submitLabel: string;
  initialFormValues: CreateTripFormValues;
  initialSelectedCompanionUserIds: number[];
  onBack: () => void;
  onSubmit: (payload: TripPlanFormSubmitPayload) => Promise<void> | void;
};

const DESTINATION_SUGGESTIONS = ['京都', '沖縄', '北海道', '金沢'] as const;
const ATMOSPHERE_OPTIONS = ['のんびり', 'アクティブ', '映え'] as const;
const RECOMMEND_CATEGORY_OPTIONS = ['カフェ', '夜景', 'グルメ', '温泉'] as const;
const BUDGET_STEP = 10000;
const MAX_PARTICIPANT_COUNT = 10;
const MAX_TRIP_DAYS = 3;
const MAX_BUDGET_PER_PERSON = 100000;

function FieldLabel({
  label,
  iconName,
  required = false,
}: {
  label: string;
  iconName: keyof typeof MaterialIcons.glyphMap;
  required?: boolean;
}) {
  return (
    <View style={styles.fieldLabelRow}>
      <View style={styles.fieldLabelLeft}>
        <MaterialIcons name={iconName} size={16} color="#EC5B13" />
        <View style={styles.fieldLabelTextWrap}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {required ? <Text style={styles.requiredMark}>※</Text> : null}
        </View>
      </View>
    </View>
  );
}

function getInitials(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1) : '?';
}

function cloneFormValues(values: CreateTripFormValues): CreateTripFormValues {
  return {
    ...values,
    recommendationCategories: [...values.recommendationCategories],
    transportTypes: [...values.transportTypes],
    accommodationNotesByDay: [...values.accommodationNotesByDay],
  };
}

export function TripPlanForm({
  title,
  submitLabel,
  initialFormValues,
  initialSelectedCompanionUserIds,
  onBack,
  onSubmit,
}: TripPlanFormProps) {
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const isResolvingCurrentLocationRef = useRef(false);
  const [fields, setFields] = useState<CreateTripFormValues>(() => cloneFormValues(initialFormValues));
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [selectedCompanionUserIds, setSelectedCompanionUserIds] = useState<number[]>(
    initialSelectedCompanionUserIds
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFields(cloneFormValues(initialFormValues));
  }, [initialFormValues]);

  useEffect(() => {
    setSelectedCompanionUserIds(initialSelectedCompanionUserIds);
  }, [initialSelectedCompanionUserIds]);

  const updateField = useCallback(<K extends keyof CreateTripFormValues>(key: K, value: CreateTripFormValues[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const participantCount = useMemo(() => {
    const parsed = Number(fields.participantCount);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  }, [fields.participantCount]);

  const maxSelectableCompanions = Math.max(0, participantCount - 1);

  const tripDays = useMemo(() => {
    if (!fields.startDate || !fields.endDate) {
      return 1;
    }
    const start = new Date(`${fields.startDate}T00:00:00`);
    const end = new Date(`${fields.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return 1;
    }
    return Math.min(
      MAX_TRIP_DAYS,
      Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    );
  }, [fields.endDate, fields.startDate]);
  const lodgingNights = Math.max(0, tripDays - 1);

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

    const areaParts = [place?.region, place?.subregion, place?.city, place?.district].filter(
      (value): value is string => Boolean(value && value.trim())
    );

    if (areaParts.length) {
      return areaParts.join(' ');
    }

    if (place?.name && place.name.trim()) {
      return place.name.trim();
    }

    throw new Error('現在地の住所を特定できませんでした。位置情報設定を確認して再度お試しください。');
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

  const toggleRecommendationCategory = useCallback((category: string) => {
    setFields((prev) => ({
      ...prev,
      recommendationCategories: prev.recommendationCategories.includes(category)
        ? prev.recommendationCategories.filter((item) => item !== category)
        : [...prev.recommendationCategories, category],
    }));
  }, []);

  const toggleAtmosphere = useCallback((option: string) => {
    setFields((prev) => ({
      ...prev,
      atmosphere: prev.atmosphere === option ? '' : option,
    }));
  }, []);

  const toggleFriend = useCallback(
    (userId: number) => {
      setSelectedCompanionUserIds((prev) => {
        if (prev.includes(userId)) {
          return prev.filter((id) => id !== userId);
        }
        if (maxSelectableCompanions > 0 && prev.length >= maxSelectableCompanions) {
          Alert.alert('選択上限', `同行者は最大${maxSelectableCompanions}人まで選択できます。`);
          return prev;
        }
        return [...prev, userId];
      });
    },
    [maxSelectableCompanions]
  );

  const setAccommodationNote = useCallback(
    (index: number, value: string) => {
      const next = [...fields.accommodationNotesByDay];
      while (next.length < MAX_TRIP_DAYS) {
        next.push('');
      }
      next[index] = value;
      updateField('accommodationNotesByDay', next);
    },
    [fields.accommodationNotesByDay, updateField]
  );

  const loadFriends = useCallback(async () => {
    try {
      setIsLoadingFriends(true);
      const list = await getFriends();
      setFriends(list);
    } catch {
      setFriends([]);
      Alert.alert('取得失敗', '友達一覧の取得に失敗しました。');
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        formValues: cloneFormValues(fields),
        selectedCompanionUserIds,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [fields, isSubmitting, onSubmit, selectedCompanionUserIds]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.contentContainer}>
      <AppHeader title={title} leftSlot={<BackButton size={28} onPress={onBack} />} />

      <View style={styles.container}>
        <Text style={styles.requiredLegend}>※必須</Text>

        <View style={styles.sectionBlock}>
          <FieldLabel label="出発地" iconName="location-on" required />
          <View style={styles.inputShell}>
            <TextInput
              value={fields.origin}
              onChangeText={(value) => updateField('origin', value)}
              placeholder="例：東京駅"
              placeholderTextColor="#94A3B8"
              style={[styles.textInput, styles.originInput]}
            />
            <Pressable
              style={[styles.inlineActionButton, isResolvingCurrentLocation ? styles.inlineActionButtonDisabled : null]}
              onPress={() => void handleUseCurrentLocation()}
              disabled={isResolvingCurrentLocation}
            >
              {isResolvingCurrentLocation ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <>
                  <MaterialIcons name="my-location" size={16} color="#0F172A" />
                  <Text style={styles.inlineActionText}>現在地から入力</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <FieldLabel label="目的地" iconName="flag" required />
          <TextInput
            value={fields.destination}
            onChangeText={(value) => updateField('destination', value)}
            placeholder="例：那覇空港"
            placeholderTextColor="#94A3B8"
            style={styles.textInput}
          />
          <View style={styles.chipHintRow}>
            <Text style={styles.chipHintLabel}>人気のスポット</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollRow}>
            {DESTINATION_SUGGESTIONS.map((item) => (
              <Pressable key={item} style={styles.secondaryChip} onPress={() => updateField('destination', item)}>
                <Text style={styles.secondaryChipText}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionBlock}>
          <ScheduleField
            startDate={fields.startDate}
            endDate={fields.endDate}
            onChangeStartDate={(value) => updateField('startDate', value)}
            onChangeEndDate={(value) => updateField('endDate', value)}
            label="日程"
            iconName="calendar-today"
            required
            maxTripDays={MAX_TRIP_DAYS}
          />
        </View>

        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <FieldLabel label="人数" iconName="group" required />
            <View style={styles.budgetCard}>
              <Pressable
                style={[styles.stepperButton, participantCount <= 1 ? styles.stepperButtonDisabled : null]}
                onPress={() => updateField('participantCount', String(Math.max(1, participantCount - 1)))}
                disabled={participantCount <= 1}
              >
                <MaterialIcons name="remove" size={20} color={participantCount <= 1 ? '#94A3B8' : '#334155'} />
              </Pressable>
              <View style={styles.budgetValueWrap}>
                <Text style={styles.budgetValueText}>
                  {participantCount}
                  <Text style={styles.budgetValueUnitInline}> 人</Text>
                </Text>
              </View>
              <Pressable
                style={[styles.stepperButton, participantCount >= MAX_PARTICIPANT_COUNT ? styles.stepperButtonDisabled : null]}
                onPress={() =>
                  updateField('participantCount', String(Math.min(MAX_PARTICIPANT_COUNT, participantCount + 1)))
                }
                disabled={participantCount >= MAX_PARTICIPANT_COUNT}
              >
                <MaterialIcons
                  name="add"
                  size={20}
                  color={participantCount >= MAX_PARTICIPANT_COUNT ? '#94A3B8' : '#334155'}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.gridItem}>
            <FieldLabel label="予算 (一人あたり)" iconName="payments" required />
            <View style={styles.budgetCard}>
              <Pressable
                style={[styles.stepperButton, budgetRawValue <= BUDGET_STEP ? styles.stepperButtonDisabled : null]}
                onPress={() => updateField('budget', String(Math.max(BUDGET_STEP, budgetRawValue - BUDGET_STEP)))}
                disabled={budgetRawValue <= BUDGET_STEP}
              >
                <MaterialIcons name="remove" size={20} color={budgetRawValue <= BUDGET_STEP ? '#94A3B8' : '#334155'} />
              </Pressable>
              <View style={styles.budgetValueWrap}>
                <Text style={styles.budgetValueText}>
                  <Text style={styles.budgetValueUnitInline}>〜 </Text>
                  {Math.round(budgetRawValue / 10000)}
                  <Text style={styles.budgetValueUnitInline}> 万円</Text>
                </Text>
              </View>
              <Pressable
                style={[styles.stepperButton, budgetRawValue >= MAX_BUDGET_PER_PERSON ? styles.stepperButtonDisabled : null]}
                onPress={() =>
                  updateField('budget', String(Math.min(MAX_BUDGET_PER_PERSON, budgetRawValue + BUDGET_STEP)))
                }
                disabled={budgetRawValue >= MAX_BUDGET_PER_PERSON}
              >
                <MaterialIcons
                  name="add"
                  size={20}
                  color={budgetRawValue >= MAX_BUDGET_PER_PERSON ? '#94A3B8' : '#334155'}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <FieldLabel label="旅の雰囲気" iconName="auto-awesome" />
          <View style={styles.wrapRow}>
            {ATMOSPHERE_OPTIONS.map((option) => {
              const selected = fields.atmosphere === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.pillChip, selected ? styles.primaryPillChip : styles.secondaryPillChip]}
                  onPress={() => toggleAtmosphere(option)}
                >
                  <Text style={[styles.pillChipText, selected ? styles.primaryPillChipText : styles.secondaryPillChipText]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <FieldLabel label="カテゴリ（複数選択可）" iconName="category" />
          <View style={styles.wrapRow}>
            {RECOMMEND_CATEGORY_OPTIONS.map((option) => {
              const selected = fields.recommendationCategories.includes(option);
              return (
                <Pressable
                  key={option}
                  style={[styles.pillChip, selected ? styles.secondaryActiveChip : styles.secondaryPillChip]}
                  onPress={() => toggleRecommendationCategory(option)}
                >
                  <Text style={[styles.pillChipText, selected ? styles.secondaryActiveChipText : styles.secondaryPillChipText]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <FieldLabel label="同行者を選択" iconName="person-add" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendScrollRow}>
            {isLoadingFriends ? (
              <View style={styles.friendsLoadingWrap}>
                <ActivityIndicator color="#EC5B13" />
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.emptyFriendState}>
                <Text style={styles.emptyFriendText}>共有できる友達がまだいません</Text>
              </View>
            ) : (
              friends.map((friend) => {
                const selected = selectedCompanionUserIds.includes(friend.user.id);
                return (
                  <Pressable key={friend.user.id} style={styles.friendPill} onPress={() => toggleFriend(friend.user.id)}>
                    <View style={[styles.avatarRing, selected ? styles.avatarRingSelected : null]}>
                      {friend.user.profile_image_url ? (
                        <Image source={{ uri: friend.user.profile_image_url }} style={styles.avatarImage} />
                      ) : (
                        <View style={[styles.avatarFallback, selected ? styles.avatarFallbackSelected : null]}>
                          <Text style={[styles.avatarFallbackText, selected ? styles.avatarFallbackTextSelected : null]}>
                            {getInitials(friend.user.username)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.friendPillText, selected ? styles.friendPillTextSelected : null]} numberOfLines={1}>
                      {friend.user.username}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          <Text style={styles.sectionHelper}>最大 {maxSelectableCompanions} 人まで選択できます</Text>
        </View>

        <View style={styles.sectionBlock}>
          <FieldLabel label="絶対に行きたい場所" iconName="stars" />
          <TextInput
            value={fields.mustVisitPlacesText}
            onChangeText={(value) => updateField('mustVisitPlacesText', value)}
            placeholder="例：清水寺, 地元の市場"
            placeholderTextColor="#94A3B8"
            style={styles.textInput}
          />
        </View>

        <View style={styles.sectionBlock}>
          <FieldLabel label="宿泊地" iconName="hotel" />
          <View style={styles.lodgingCard}>
            {lodgingNights === 0 ? (
              <Text style={styles.noLodgingText}>日帰りプランのため宿泊地入力は不要です</Text>
            ) : (
              Array.from({ length: lodgingNights }).map((_, index) => (
                <View key={index} style={styles.lodgingBlock}>
                  <Text style={styles.lodgingLabel}>{index + 1}泊目</Text>
                  <TextInput
                    value={fields.accommodationNotesByDay[index] ?? ''}
                    onChangeText={(value) => setAccommodationNote(index, value)}
                    placeholder="宿泊予定エリアやホテル名"
                    placeholderTextColor="#94A3B8"
                    style={styles.lodgingInput}
                  />
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <FieldLabel label="追加のリクエスト (コメント)" iconName="chat-bubble" />
          <TextInput
            value={fields.additionalRequestComment}
            onChangeText={(value) => updateField('additionalRequestComment', value)}
            placeholder="例：夕食は海が見えるレストランがいい、移動はなるべく歩きたくない..."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            style={styles.textArea}
          />
        </View>

        <View style={styles.submitWrap}>
          <Pressable style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : null]} onPress={() => void handleSubmit()} disabled={isSubmitting}>
            <MaterialIcons name="bolt" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>{submitLabel}</Text>
          </Pressable>
          <Text style={styles.submitHint}>AIが最適なルート、宿泊先、観光スポットを提案します</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 28,
  },
  requiredLegend: {
    alignSelf: 'flex-end',
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  brandingBlock: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#EC5B13',
    letterSpacing: -0.8,
  },
  brandBody: {
    fontSize: 13,
    color: '#64748B',
  },
  sectionBlock: {
    gap: 14,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  fieldLabelLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  fieldLabelTextWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  requiredMark: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 12,
    marginTop: -3,
  },
  inputShell: {
    position: 'relative',
    justifyContent: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 14,
    color: '#0F172A',
  },
  originInput: {
    paddingRight: 140,
  },
  inlineActionButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    bottom: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inlineActionButtonDisabled: {
    opacity: 0.7,
  },
  inlineActionText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  chipHintRow: {
    paddingHorizontal: 2,
  },
  chipHintLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  chipScrollRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  secondaryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  secondaryChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  gridItem: {
    flex: 1,
  },
  budgetCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 78,
  },
  stepperButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  stepperButtonDisabled: {
    backgroundColor: '#F1F5F9',
  },
  budgetValueWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  budgetValueText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  budgetValueUnitInline: {
    fontSize: 9,
    fontWeight: '600',
    color: '#7B8592',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryPillChip: {
    backgroundColor: '#EC5B13',
  },
  primaryPillChipText: {
    color: '#FFFFFF',
  },
  secondaryPillChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  secondaryPillChipText: {
    color: '#64748B',
  },
  secondaryActiveChip: {
    backgroundColor: '#EC5B13',
    borderWidth: 1,
    borderColor: '#EC5B13',
  },
  secondaryActiveChipText: {
    color: '#FFFFFF',
  },
  pillChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  friendScrollRow: {
    gap: 14,
    paddingHorizontal: 2,
    alignItems: 'flex-start',
  },
  friendsLoadingWrap: {
    width: 120,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFriendState: {
    minWidth: 200,
    paddingVertical: 10,
  },
  emptyFriendText: {
    fontSize: 12,
    color: '#64748B',
  },
  friendPill: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingSelected: {
    borderColor: '#EC5B13',
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackSelected: {
    backgroundColor: '#FFF7ED',
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#64748B',
  },
  avatarFallbackTextSelected: {
    color: '#EC5B13',
  },
  friendPillText: {
    width: '100%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  friendPillTextSelected: {
    color: '#0F172A',
    fontWeight: '800',
  },
  sectionHelper: {
    fontSize: 12,
    color: '#94A3B8',
  },
  lodgingCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 14,
  },
  lodgingBlock: {
    gap: 8,
  },
  noLodgingText: {
    fontSize: 13,
    color: '#64748B',
  },
  lodgingLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  lodgingInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 14,
    lineHeight: 18,
    color: '#0F172A',
  },
  submitWrap: {
    paddingTop: 8,
    paddingBottom: 32,
    gap: 12,
  },
  submitButton: {
    borderRadius: 18,
    backgroundColor: '#EC5B13',
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#EC5B13',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  submitHint: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
});

export type { TripPlanFormSubmitPayload };
