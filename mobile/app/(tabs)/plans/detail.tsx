import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, Image, Pressable, Alert } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import {
  createAiPlanGeneration,
  getAiPlanGeneration,
} from '@/features/trips/api/ai-plan-generation';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { type AiPlanGenerationResponse } from '@/features/trips/types/ai-plan-generation';
import { type TripAggregateResponse } from '@/features/trips/types/trip-edit';
import { travelStyles } from '@/features/travel/styles';
import { weatherMock } from '@/data/travel';
import { ApiError } from '@/lib/api/client';

const PLAN_IMAGE_URL =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80';

function parseTripId(rawTripId?: string): number | null {
  if (!rawTripId) {
    return null;
  }
  const parsed = Number(rawTripId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '計画詳細の取得に失敗しました。';
  }
  if (error.status === 401) {
    return '認証が切れています。再ログイン後にお試しください。';
  }
  if (error.status === 403) {
    return 'この計画を閲覧する権限がありません。';
  }
  if (error.status === 404) {
    return '対象の計画が見つかりませんでした。';
  }
  return `計画詳細の取得に失敗しました (${error.status})`;
}

function getAiGenerationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'AIプラン構築の実行に失敗しました。';
  }
  if (error.status === 401) {
    return '認証が切れています。再ログイン後にお試しください。';
  }
  if (error.status === 403) {
    return 'この計画でAIプランを作成する権限がありません。';
  }
  if (error.status === 404) {
    return '対象の計画が見つかりませんでした。';
  }
  return `AIプラン構築の実行に失敗しました (${error.status})`;
}

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const tripId = useMemo(() => parseTripId(id), [id]);
  const [aggregate, setAggregate] = useState<TripAggregateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [generation, setGeneration] = useState<AiPlanGenerationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
      Alert.alert('取得失敗', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void loadTripDetail();
  }, [loadTripDetail]);

  useEffect(() => {
    if (!tripId || !generation || (generation.status !== 'queued' && generation.status !== 'running')) {
      return;
    }

    const intervalId = setInterval(() => {
      void (async () => {
        try {
          const latest = await getAiPlanGeneration(tripId, generation.id);
          setGeneration(latest);

          if (latest.status === 'succeeded') {
            clearInterval(intervalId);
            setIsGenerating(false);
            Alert.alert('AIプラン構築完了', '行程を更新しました。');
            void loadTripDetail();
          } else if (latest.status === 'failed') {
            clearInterval(intervalId);
            setIsGenerating(false);
            Alert.alert('AIプラン構築失敗', latest.error_message ?? 'プラン構築に失敗しました。');
          }
        } catch (error) {
          clearInterval(intervalId);
          setIsGenerating(false);
          Alert.alert('取得失敗', getAiGenerationErrorMessage(error));
        }
      })();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [generation, loadTripDetail, tripId]);

  const handleGenerateAiPlan = useCallback(async () => {
    if (!tripId) {
      return;
    }
    try {
      setIsGenerating(true);
      const created = await createAiPlanGeneration(tripId, { run_async: true });
      setGeneration(created);
      if (created.status === 'succeeded') {
        setIsGenerating(false);
        void loadTripDetail();
      }
    } catch (error) {
      setIsGenerating(false);
      Alert.alert('実行失敗', getAiGenerationErrorMessage(error));
    }
  }, [loadTripDetail, tripId]);

  if (!tripId) {
    return (
      <View style={travelStyles.screen}>
        <AppHeader title="作成済みの計画" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={travelStyles.container}>
          <Text style={[travelStyles.heading, travelStyles.accentText]}>tripId が不正です</Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={travelStyles.screen}>
        <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={travelStyles.container}>
          <ActivityIndicator color="#F97316" />
          <Text style={travelStyles.sectionBody}>読み込み中...</Text>
        </View>
      </View>
    );
  }

  if (!aggregate) {
    return (
      <View style={travelStyles.screen}>
        <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={travelStyles.container}>
          <Text style={[travelStyles.heading, travelStyles.accentText]}>計画が見つかりませんでした</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <Image source={{ uri: PLAN_IMAGE_URL }} style={{ width: '100%', height: 180, borderRadius: 16 }} />

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>{aggregate.trip.origin} → {aggregate.trip.destination}</Text>
          <Text style={travelStyles.sectionBody}>開始日: {aggregate.trip.start_date}</Text>
          <Text style={travelStyles.sectionBody}>終了日: {aggregate.trip.end_date}</Text>
          <Text style={travelStyles.sectionBody}>ステータス: {aggregate.trip.status}</Text>
        </View>

        <View style={travelStyles.card}>
          <Text style={travelStyles.sectionTitleText}>好み</Text>
          <Text style={travelStyles.sectionBody}>雰囲気: {aggregate.preference?.atmosphere ?? '未設定'}</Text>
          <Text style={travelStyles.sectionBody}>同行者: {aggregate.preference?.companions ?? '未設定'}</Text>
          <Text style={travelStyles.sectionBody}>予算: {aggregate.preference?.budget ? `¥${aggregate.preference.budget.toLocaleString()}` : '未設定'}</Text>
          <Text style={travelStyles.sectionBody}>移動手段: {aggregate.preference?.transport_type ?? '未設定'}</Text>
        </View>

        <View style={travelStyles.card}>
          <Text style={travelStyles.sectionTitleText}>日程</Text>
          {aggregate.days.length ? (
            aggregate.days.map((day) => (
              <Text key={day.id} style={travelStyles.sectionBody}>
                Day {day.day_number}: {day.date ?? '日付未設定'}
              </Text>
            ))
          ) : (
            <Text style={travelStyles.sectionBody}>日程は未登録です。</Text>
          )}
        </View>

        <View style={travelStyles.card}>
          <Text style={travelStyles.sectionTitleText}>行程</Text>
          {aggregate.itinerary_items.length ? (
            aggregate.itinerary_items.map((item) => (
              <Text key={item.id} style={travelStyles.sectionBody}>
                • {item.name} (DayID: {item.trip_day_id})
              </Text>
            ))
          ) : (
            <Text style={travelStyles.sectionBody}>行程は未登録です。</Text>
          )}
        </View>

        <Pressable
          style={[travelStyles.primaryButton, isGenerating && { opacity: 0.6 }]}
          onPress={handleGenerateAiPlan}
          disabled={isGenerating}
        >
          <Text style={travelStyles.primaryButtonText}>
            {isGenerating ? 'AIプランを構築中...' : 'AIにプランを作成してもらう'}
          </Text>
        </Pressable>

        <Link href={{ pathname: '/create/edit', params: { tripId: String(tripId) } }} asChild>
          <Pressable style={travelStyles.primaryButton}>
            <Text style={travelStyles.primaryButtonText}>この計画を編集する</Text>
          </Pressable>
        </Link>

        <Link href={{ pathname: '/create/replanning', params: { tripId: String(tripId) } }} asChild>
          <Pressable style={travelStyles.primaryButton}>
            <Text style={travelStyles.primaryButtonText}>AIによるプランの再構築</Text>
          </Pressable>
        </Link>

        {generation ? (
          <View style={travelStyles.card}>
            <Text style={travelStyles.sectionTitleText}>AI構築ステータス</Text>
            <Text style={travelStyles.sectionBody}>status: {generation.status}</Text>
            {generation.error_message ? (
              <Text style={travelStyles.sectionBody}>error: {generation.error_message}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
