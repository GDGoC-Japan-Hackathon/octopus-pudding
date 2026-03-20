import { BackButton } from '@/components/back-button';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { createAiPlanGeneration } from '@/features/trips/api/ai-plan-generation';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { addTripMember, removeTripMember } from '@/features/trips/api/trip-members';
import { updateTrip } from '@/features/trips/api/update-trip';
import { upsertTripPreference } from '@/features/trips/api/upsert-trip-preference';
import { TripPlanForm, type TripPlanFormSubmitPayload } from '@/features/trips/components/TripPlanForm';
import { type TripDetailAggregateResponse } from '@/features/trips/types/trip-detail';
import { validateAndBuildCreateTripPayload } from '@/features/trips/utils/create-trip';
import { buildAiGenerationRequestFromForm, buildTripPlanFormValues } from '@/features/trips/utils/trip-plan-form';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

async function syncTripMembers(tripId: number, currentUserIds: number[], nextUserIds: number[]) {
  const currentSet = new Set(currentUserIds);
  const nextSet = new Set(nextUserIds);

  for (const userId of nextSet) {
    if (currentSet.has(userId)) {
      continue;
    }
    try {
      await addTripMember(tripId, userId);
    } catch (error) {
      const maybeApiError = error as { status?: number };
      if (maybeApiError.status !== 409) {
        throw error;
      }
    }
  }

  for (const userId of currentSet) {
    if (nextSet.has(userId)) {
      continue;
    }
    await removeTripMember(tripId, userId);
  }
}

export default function EditTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string; id?: string }>();
  const tripId = useMemo(() => Number(params.tripId ?? params.id ?? 0), [params.id, params.tripId]);
  const [detail, setDetail] = useState<TripDetailAggregateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function run() {
      if (!tripId) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await getTripDetail(tripId);
        if (!active) {
          return;
        }
        setDetail(response);
      } catch {
        if (!active) {
          return;
        }
        Alert.alert('旅行情報取得に失敗した');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [tripId]);

  async function handleSubmit({
    formValues,
    selectedCompanionUserIds,
  }: TripPlanFormSubmitPayload) {
    if (!detail) {
      return;
    }

    const validation = validateAndBuildCreateTripPayload(formValues);
    if (!validation.ok) {
      Alert.alert('入力エラー', validation.message);
      return;
    }

    const payload = validation.payload;

    await updateTrip(tripId, {
      origin: payload.origin,
      destination: payload.destination,
      start_date: payload.start_date,
      end_date: payload.end_date,
      participant_count: payload.participant_count,
      recommendation_categories: payload.recommendation_categories,
      status: 'planned',
    });

    await upsertTripPreference(tripId, {
      atmosphere: payload.preference.atmosphere,
      budget: payload.preference.budget,
      transport_type: payload.preference.transport_type,
      must_visit_places_text: formValues.mustVisitPlacesText.trim() || null,
      additional_request_comment: formValues.additionalRequestComment.trim() || null,
    });

    const currentMemberUserIds = detail.members
      .filter((member) => member.role !== 'owner')
      .map((member) => member.user_id);
    await syncTripMembers(tripId, currentMemberUserIds, selectedCompanionUserIds);

    let generationRequest;
    try {
      generationRequest = await buildAiGenerationRequestFromForm(formValues);
    } catch (error) {
      const message = error instanceof Error ? error.message : '座標の解決に失敗しました。';
      Alert.alert('入力エラー', message);
      return;
    }

    const generation = await createAiPlanGeneration(
      tripId,
      generationRequest
    );

    if (generation.status === 'failed') {
      Alert.alert('プラン更新に失敗しました', generation.error_message ?? 'AIプランの再生成に失敗しました。');
      return;
    }

    router.replace({
      pathname: '/plans/detail',
      params: { id: String(tripId) },
    });
  }

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <AppHeader title="プランをカスタマイズ" leftSlot={<BackButton size={28} onPress={() => router.back()} />} />
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#EC5B13" />
        </View>
      </View>
    );
  }

  if (!detail || !tripId) {
    return (
      <View style={styles.screen}>
        <AppHeader title="プランをカスタマイズ" leftSlot={<BackButton size={28} onPress={() => router.back()} />} />
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>旅行情報が見つかりません。</Text>
        </View>
      </View>
    );
  }

  return (
    <TripPlanForm
      title="プランをカスタマイズ"
      submitLabel="プランを更新"
      initialFormValues={buildTripPlanFormValues(detail)}
      initialSelectedCompanionUserIds={detail.members.filter((member) => member.role !== 'owner').map((member) => member.user_id)}
      onBack={() => {
        router.replace({
          pathname: '/plans/detail',
          params: { id: String(tripId) },
        });
      }}
      onSubmit={handleSubmit}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6F6',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
});
