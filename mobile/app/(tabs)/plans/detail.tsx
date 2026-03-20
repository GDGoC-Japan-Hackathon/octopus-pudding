import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { weatherMock } from '@/data/travel';
import { BackButton } from '@/components/back-button';
import { PlanDetailTemplate } from '@/features/plan-detail/components/PlanDetailTemplate';
import {
  buildAiGenerationRequestFromAggregate,
  getAiGenerationErrorMessage,
  getTripStartErrorMessage,
  getTripDetailErrorMessage,
  groupItineraryByDay,
  parseTripId,
  toPlanDetailViewModel,
} from '@/features/plan-detail/utils/plan-detail';
import { type PlanDetailTimelineItem } from '@/features/plan-detail/types';
import { createAiPlanGeneration } from '@/features/trips/api/ai-plan-generation';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { startTrip } from '@/features/trips/api/start-trip';
import { type CreateAiPlanGenerationRequest } from '@/features/trips/types/ai-plan-generation';
import { type TripDetailAggregateResponse } from '@/features/trips/types/trip-detail';
import { AppHeader } from '@/features/travel/components/AppHeader';

const PLAN_IMAGE_URL =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80';

type AdjustmentIncidentType = 'bad_weather' | 'delay' | 'mood_change' | 'fatigue' | 'other';
type AdjustmentPolicy =
  | 'indoor_preferred'
  | 'shorter_travel'
  | 'less_walking'
  | 'food_priority'
  | 'scenic_priority';

type PendingAdjustment = {
  item: PlanDetailTimelineItem;
  targetItemId: number;
};

const INCIDENT_OPTIONS: Array<{ value: AdjustmentIncidentType; label: string }> = [
  { value: 'bad_weather', label: '天候' },
  { value: 'delay', label: '遅延' },
  { value: 'mood_change', label: '気分の変化' },
  { value: 'fatigue', label: '疲れた' },
  { value: 'other', label: 'その他' },
];

const POLICY_OPTIONS: Array<{ value: AdjustmentPolicy; label: string }> = [
  { value: 'indoor_preferred', label: '屋内優先' },
  { value: 'shorter_travel', label: '移動を短く' },
  { value: 'less_walking', label: '歩きを減らす' },
  { value: 'food_priority', label: '食事優先' },
  { value: 'scenic_priority', label: '景色優先' },
];

function getPresetPolicies(incidentType: AdjustmentIncidentType): AdjustmentPolicy[] {
  if (incidentType === 'bad_weather') {
    return ['indoor_preferred'];
  }
  if (incidentType === 'delay') {
    return ['shorter_travel'];
  }
  if (incidentType === 'fatigue') {
    return ['shorter_travel', 'less_walking'];
  }
  return [];
}

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const tripId = useMemo(() => parseTripId(id), [id]);
  const [aggregate, setAggregate] = useState<TripDetailAggregateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [activeRegenerationKey, setActiveRegenerationKey] = useState<string | null>(null);
  const [activeDayId, setActiveDayId] = useState<number | null>(null);
  const [pendingAdjustment, setPendingAdjustment] = useState<PendingAdjustment | null>(null);
  const [adjustmentIncidentType, setAdjustmentIncidentType] = useState<AdjustmentIncidentType>('mood_change');
  const [adjustmentPolicies, setAdjustmentPolicies] = useState<AdjustmentPolicy[]>([]);
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [delayMinutesText, setDelayMinutesText] = useState('');
  const headerBackSlot = <BackButton onPress={() => router.push('/plans')} size={28} />;

  const groupedItineraryByDay = useMemo(() => groupItineraryByDay(aggregate), [aggregate]);

  const detailView = useMemo(
    () => (aggregate ? toPlanDetailViewModel(aggregate, activeDayId) : null),
    [activeDayId, aggregate]
  );
  const regenerationMessage = useMemo(() => {
    if (activeRegenerationKey === 'full') {
      return '旅程全体を再生成しています。しばらくお待ちください。';
    }
    if (activeRegenerationKey?.startsWith('from_item:')) {
      return '選択したスポット以降の旅程を再生成しています。しばらくお待ちください。';
    }
    if (activeRegenerationKey?.startsWith('replace_item:')) {
      return '選択したスポットを差し替えています。しばらくお待ちください。';
    }
    return null;
  }, [activeRegenerationKey]);

  const loadTripDetail = useCallback(async () => {
    if (!tripId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const detail = await getTripDetail(tripId);
      setAggregate(detail);
    } catch (error) {
      Alert.alert('取得失敗', getTripDetailErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void loadTripDetail();
  }, [loadTripDetail]);

  useEffect(() => {
    if (groupedItineraryByDay.length && activeDayId === null) {
      setActiveDayId(groupedItineraryByDay[0].tripDayId);
    }
  }, [activeDayId, groupedItineraryByDay]);

  const handleCustomizeAndSave = useCallback(async () => {
    if (!tripId) {
      return;
    }
    try {
      setIsCustomizing(true);
      router.push({ pathname: '/create/edit', params: { tripId: String(tripId) } });
    } finally {
      setIsCustomizing(false);
    }
  }, [router, tripId]);

  const handleStartTrip = useCallback(async () => {
    if (!tripId || aggregate?.trip.status !== 'planned') {
      return;
    }

    try {
      setIsStartingTrip(true);
      await startTrip(tripId);
      await loadTripDetail();
      Alert.alert('旅行開始', '旅行中のプランを更新しました。ホーム画面にも反映されます。');
    } catch (error) {
      Alert.alert('更新失敗', getTripStartErrorMessage(error));
    } finally {
      setIsStartingTrip(false);
    }
  }, [aggregate?.trip.status, loadTripDetail, tripId]);

  const handleRegeneration = useCallback(
    async (
      mode: 'full' | 'from_item' | 'replace_item',
      targetItemId?: number,
      overrides?: Partial<CreateAiPlanGenerationRequest>
    ) => {
      if (!tripId || !aggregate) {
        return;
      }

      const regenerationKey = mode === 'full' ? 'full' : `${mode}:${targetItemId}`;
      try {
        setActiveRegenerationKey(regenerationKey);
        const generationRequest = await buildAiGenerationRequestFromAggregate(aggregate, {
          regeneration_mode: mode,
          target_item_id: targetItemId,
          ...overrides,
        });
        const response = await createAiPlanGeneration(tripId, generationRequest);

        if (response.status === 'failed') {
          Alert.alert('再構成失敗', response.error_message ?? 'AIプランの再構成に失敗しました。');
          return;
        }

        await loadTripDetail();
        Alert.alert(
          '再構成完了',
          mode === 'full'
            ? '旅程全体を再構成しました。'
            : mode === 'from_item'
              ? '選択したスポット以降の旅程を再構成しました。'
              : '選択したスポットを差し替えました。'
        );
      } catch (error) {
        Alert.alert('再構成失敗', getAiGenerationErrorMessage(error));
      } finally {
        setActiveRegenerationKey(null);
      }
    },
    [aggregate, loadTripDetail, tripId]
  );

  const openAdjustmentSheet = useCallback((item: PlanDetailTimelineItem) => {
      const itemId = Number(item.id);
      if (!Number.isInteger(itemId) || itemId <= 0) {
        return;
      }
      setPendingAdjustment({ item, targetItemId: itemId });
      setAdjustmentIncidentType('mood_change');
      setAdjustmentPolicies([]);
      setAdjustmentNote('');
      setDelayMinutesText('');
    },
    []
  );

  const handleRegenerateFromItem = useCallback(
    async (item: PlanDetailTimelineItem) => {
      openAdjustmentSheet(item);
    },
    [openAdjustmentSheet]
  );

  const applyIncidentPreset = useCallback((incidentType: AdjustmentIncidentType) => {
    setAdjustmentIncidentType(incidentType);
    setAdjustmentPolicies(getPresetPolicies(incidentType));
    if (incidentType !== 'delay') {
      setDelayMinutesText('');
    }
  }, []);

  const toggleAdjustmentPolicy = useCallback((policy: AdjustmentPolicy) => {
    setAdjustmentPolicies((current) =>
      current.includes(policy) ? current.filter((value) => value !== policy) : [...current, policy]
    );
  }, []);

  const handleSubmitAdjustment = useCallback(async () => {
    if (!pendingAdjustment) {
      return;
    }

    const nextPolicies = adjustmentPolicies;
    const nextNote = adjustmentNote.trim() || undefined;
    const parsedDelayMinutes = Number(delayMinutesText);
    const nextDelayMinutes =
      adjustmentIncidentType === 'delay' && Number.isFinite(parsedDelayMinutes) && parsedDelayMinutes > 0
        ? Math.round(parsedDelayMinutes)
        : undefined;

    const requestOverrides: Partial<CreateAiPlanGenerationRequest> = {
      incident_type: adjustmentIncidentType,
      incident_note: nextNote,
      delay_minutes: nextDelayMinutes,
      adjustment_policies: nextPolicies,
    };

    const target = pendingAdjustment;
    setPendingAdjustment(null);
    await handleRegeneration('from_item', target.targetItemId, requestOverrides);
  }, [
    adjustmentIncidentType,
    adjustmentNote,
    adjustmentPolicies,
    delayMinutesText,
    handleRegeneration,
    pendingAdjustment,
  ]);

  if (!tripId) {
    return (
      <View style={styles.screen}>
        <AppHeader
          title="計画詳細"
          weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
          leftSlot={headerBackSlot}
        />
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>tripId が不正です</Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <AppHeader
          title="計画詳細"
          weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
          leftSlot={headerBackSlot}
        />
        <View style={styles.centerState}>
          <ActivityIndicator color="#EC5B13" />
          <Text style={styles.centerBody}>読み込み中...</Text>
        </View>
      </View>
    );
  }

  if (!aggregate) {
    return (
      <View style={styles.screen}>
        <AppHeader
          title="計画詳細"
          weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
          leftSlot={headerBackSlot}
        />
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>計画が見つかりませんでした</Text>
        </View>
      </View>
    );
  }

  if (!detailView) {
    return null;
  }

  return (
    <>
      <PlanDetailTemplate
        headerTitle="マイプラン詳細"
        weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
        topNoticeMessage={regenerationMessage}
        headerLeftSlot={headerBackSlot}
        heroImage={detailView.heroImage ?? PLAN_IMAGE_URL}
        title={detailView.title}
        comment={detailView.comment}
        createdAtLabel={detailView.createdAtLabel}
        travelDateLabel={detailView.travelDateLabel}
        budgetLabel={detailView.budgetLabel}
        moveTimeLabel={detailView.moveTimeLabel}
        days={detailView.days}
        activeDayKey={detailView.activeDayKey}
        onSelectDay={(dayKey) => setActiveDayId(Number(dayKey))}
        timeline={detailView.timeline}
        timelinePrimaryActionLabel="ここ以降を再生成"
        onTimelinePrimaryAction={(item) => void handleRegenerateFromItem(item)}
        timelineActionLoadingId={
          activeRegenerationKey?.startsWith('from_item:')
            ? Number(activeRegenerationKey.split(':')[1])
            : null
        }
        primaryActionLabel=""
        primaryActionSlot={
          <View style={styles.actionWrap}>
            <Pressable
              style={[
                styles.actionButton,
                activeRegenerationKey === 'full' ? styles.actionButtonGray : styles.actionButtonOrange,
              ]}
              onPress={() => void handleRegeneration('full')}
              disabled={activeRegenerationKey !== null}
            >
              <MaterialIcons name="auto-awesome" size={22} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>
                {activeRegenerationKey === 'full' ? '旅程を再構成中...' : '旅程を全体再生成'}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionButton,
                isCustomizing || activeRegenerationKey !== null ? styles.actionButtonGray : styles.actionButtonOrange,
              ]}
              onPress={handleCustomizeAndSave}
              disabled={isCustomizing || activeRegenerationKey !== null}
            >
              <MaterialIcons name="edit-note" size={22} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>
                {isCustomizing ? 'カスタマイズへ\n移動中...' : 'プランをカスタマイズ'}
              </Text>
            </Pressable>

            {aggregate.trip.status !== 'completed' ? (
              <Pressable
                style={[
                  styles.actionButton,
                  aggregate.trip.status === 'planned' && !isStartingTrip && activeRegenerationKey === null
                    ? styles.actionButtonWhite
                    : styles.actionButtonGray,
                ]}
                onPress={handleStartTrip}
                disabled={aggregate.trip.status !== 'planned' || isStartingTrip || activeRegenerationKey !== null}
              >
                <MaterialIcons
                  name="flight-takeoff"
                  size={22}
                  color={
                    aggregate.trip.status === 'planned' && !isStartingTrip && activeRegenerationKey === null
                      ? '#EC5B13'
                      : '#FFFFFF'
                  }
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    aggregate.trip.status === 'planned' && !isStartingTrip && activeRegenerationKey === null
                      ? styles.actionButtonTextOrange
                      : null,
                  ]}
                >
                  {isStartingTrip ? '旅行開始中...' : aggregate.trip.status === 'ongoing' ? '旅行中' : '旅行開始'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <Modal
        visible={pendingAdjustment !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPendingAdjustment(null)}
      >
          <Pressable style={styles.sheetBackdrop} onPress={() => setPendingAdjustment(null)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>ここ以降を再生成</Text>
            <Text style={styles.sheetTarget}>{pendingAdjustment?.item.title ?? ''}</Text>

            <Text style={styles.sheetLabel}>変更理由</Text>
            <View style={styles.chipRow}>
              {INCIDENT_OPTIONS.map((option) => {
                const active = adjustmentIncidentType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                    onPress={() => applyIncidentPreset(option.value)}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>調整方針</Text>
            <View style={styles.chipRow}>
              {POLICY_OPTIONS.map((option) => {
                const active = adjustmentPolicies.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                    onPress={() => toggleAdjustmentPolicy(option.value)}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {adjustmentIncidentType === 'delay' ? (
              <>
                <Text style={styles.sheetLabel}>遅延時間</Text>
                <TextInput
                  style={styles.input}
                  value={delayMinutesText}
                  onChangeText={setDelayMinutesText}
                  placeholder="例: 30"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                />
              </>
            ) : null}

            <Text style={styles.sheetLabel}>メモ</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={adjustmentNote}
              onChangeText={setAdjustmentNote}
              placeholder="雨が強い、30分遅れた、景色より休憩したい など"
              placeholderTextColor="#94A3B8"
              multiline
            />

            <View style={styles.sheetActionRow}>
              <Pressable style={[styles.sheetButton, styles.sheetButtonSecondary]} onPress={() => setPendingAdjustment(null)}>
                <Text style={styles.sheetButtonSecondaryText}>閉じる</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.sheetButton,
                  activeRegenerationKey !== null ? styles.sheetButtonDisabled : styles.sheetButtonPrimary,
                ]}
                onPress={() => void handleSubmitAdjustment()}
                disabled={activeRegenerationKey !== null}
              >
                <Text style={styles.sheetButtonPrimaryText}>この内容で再生成</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FDFDFD',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  centerBody: {
    fontSize: 14,
    color: '#64748B',
  },
  actionWrap: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    width: '100%',
    minHeight: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButtonOrange: {
    backgroundColor: '#EC5B13',
  },
  actionButtonGray: {
    backgroundColor: '#94A3B8',
  },
  actionButtonWhite: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButtonTextOrange: {
    color: '#EC5B13',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetTarget: {
    fontSize: 14,
    color: '#64748B',
  },
  sheetLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  chipActive: {
    borderColor: '#EC5B13',
    backgroundColor: '#FFF1E8',
  },
  chipInactive: {
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#C2410C',
  },
  chipTextInactive: {
    color: '#475569',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  sheetActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  sheetButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sheetButtonPrimary: {
    backgroundColor: '#EC5B13',
  },
  sheetButtonSecondary: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  sheetButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  sheetButtonSecondaryText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
});
