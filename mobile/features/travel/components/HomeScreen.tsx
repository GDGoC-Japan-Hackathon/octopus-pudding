import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { recommendedPlans, weatherMock } from '@/data/travel';
import { formatTripStatusLabel } from '@/features/trips/utils/trip-list';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { PhotoCard } from '@/features/travel/components/PhotoCard';
import { travelStyles } from '@/features/travel/styles';
import { buildHomeOngoingTripView, selectFeaturedOngoingTrip } from '@/features/travel/utils/home-trip';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { getTrips } from '@/features/trips/api/get-trips';
import { type TripDetailAggregateResponse } from '@/features/trips/types/trip-detail';
import { type TripResponse } from '@/features/trips/types/trip-edit';

type DetailState = 'idle' | 'ready' | 'empty' | 'unavailable';

function OngoingTripSection({
  trip,
  detailState,
  detail,
}: {
  trip: TripResponse;
  detailState: DetailState;
  detail: TripDetailAggregateResponse | null;
}) {
  const timelineView = useMemo(() => (detail ? buildHomeOngoingTripView(detail) : null), [detail]);

  return (
    <>
      <View style={travelStyles.sectionTitle}>
        <Text style={travelStyles.sectionTitleText}>旅行中</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryTextBlock}>
            <Text style={styles.summaryTitle}>{trip.origin} → {trip.destination}</Text>
            <Text style={styles.summaryMeta}>{trip.start_date} - {trip.end_date}</Text>
            <Text style={styles.summaryMeta}>総人数 {trip.participant_count}名</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{formatTripStatusLabel(trip.status)}</Text>
          </View>
        </View>

        <Link href={{ pathname: '/plans/detail', params: { id: String(trip.id) } }} asChild>
          <Pressable style={styles.summaryDetailButton}>
            <Text style={styles.summaryDetailButtonText}>プラン詳細を見る</Text>
            <MaterialIcons name="chevron-right" size={18} color="#EC5B13" />
          </Pressable>
        </Link>
      </View>

      <View style={travelStyles.timelineCard}>
        <Text style={travelStyles.subheading}>
          {timelineView?.dayLabel ? `現在の行程 (${timelineView.dayLabel})` : '現在の行程'}
        </Text>

        {detailState === 'ready' && timelineView?.hasTimeline && timelineView.currentItem ? (
          <>
            <View style={travelStyles.timelineRow}>
              <Text style={travelStyles.timelineTime}>{timelineView.currentItem.time}</Text>
              <Text style={travelStyles.timelineText}>{timelineView.currentItem.place}</Text>
            </View>
            <Text style={travelStyles.subheading}>{timelineView.currentItem.memo}</Text>

            {timelineView.nextItem ? (
              <>
                <View style={travelStyles.divider} />
                <View style={travelStyles.timelineRow}>
                  <Text style={[travelStyles.timelineTime, styles.nextTimelineTime]}>{timelineView.nextItem.time}</Text>
                  <Text style={travelStyles.timelineText}>{timelineView.nextItem.place}</Text>
                </View>
                <Text style={travelStyles.subheading}>{timelineView.nextItem.memo}</Text>
              </>
            ) : (
              <>
                <View style={travelStyles.divider} />
                <Text style={travelStyles.subheading}>次の予定はまだありません。</Text>
              </>
            )}
          </>
        ) : detailState === 'ready' ? (
          <Text style={travelStyles.subheading}>この日の行程はまだありません。</Text>
        ) : detailState === 'unavailable' ? (
          <Text style={travelStyles.subheading}>旅行中プランは表示できていますが、行程の取得に失敗しました。</Text>
        ) : (
          <View style={styles.loadingInline}>
            <ActivityIndicator color="#EC5B13" />
            <Text style={travelStyles.subheading}>行程を読み込み中...</Text>
          </View>
        )}
      </View>
    </>
  );
}

function RecommendationsSection({ traveling }: { traveling: boolean }) {
  return (
    <>
      <View style={travelStyles.sectionTitle}>
        <Text style={travelStyles.sectionTitleText}>{traveling ? 'おすすめ' : '開始前の提案'}</Text>
        <Text style={travelStyles.subheading}>
          {traveling ? '旅行中でも使えるおすすめです' : `現在地（${weatherMock.location}）で使えるおすすめです`}
        </Text>
      </View>

      <View style={travelStyles.horizontalSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
          {recommendedPlans.slice(0, 3).map((item) => (
            <Link key={item.id} href={{ pathname: '/recommend/detail', params: { id: item.id } }} asChild>
              <Pressable>
                <PhotoCard
                  item={{
                    id: item.id,
                    title: item.title,
                    location: item.location,
                    image: item.image,
                    author: item.author,
                    likes: item.likes,
                  }}
                />
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

export default function HomeScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [ongoingTrip, setOngoingTrip] = useState<TripResponse | null>(null);
  const [ongoingDetail, setOngoingDetail] = useState<TripDetailAggregateResponse | null>(null);
  const [detailState, setDetailState] = useState<DetailState>('idle');

  const loadHome = useCallback(async () => {
    try {
      setIsLoading(true);
      const trips = await getTrips();
      const nextOngoingTrip = selectFeaturedOngoingTrip(trips);

      setOngoingTrip(nextOngoingTrip);

      if (!nextOngoingTrip) {
        setOngoingDetail(null);
        setDetailState('empty');
        return;
      }

      try {
        const detail = await getTripDetail(nextOngoingTrip.id);
        setOngoingDetail(detail);
        setDetailState('ready');
      } catch {
        setOngoingDetail(null);
        setDetailState('unavailable');
      }
    } catch {
      setOngoingTrip(null);
      setOngoingDetail(null);
      setDetailState('empty');
      Alert.alert('取得失敗', 'ホーム画面の旅行情報取得に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHome();
    }, [loadHome])
  );

  return (
    <ScrollView style={travelStyles.screen}>
      <AppHeader title="ホーム" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        {isLoading && !ongoingTrip ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#EC5B13" />
            <Text style={travelStyles.subheading}>旅行中プランを確認中...</Text>
          </View>
        ) : ongoingTrip ? (
          <OngoingTripSection trip={ongoingTrip} detailState={detailState} detail={ongoingDetail} />
        ) : (
          <View style={travelStyles.sectionTitle}>
            <Text style={travelStyles.sectionTitleText}>旅行していない</Text>
            <Text style={travelStyles.subheading}>ホーム画面トップ</Text>
          </View>
        )}

        <RecommendationsSection traveling={!!ongoingTrip} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryTextBlock: {
    flex: 1,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  summaryDetailButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryDetailButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EC5B13',
  },
  nextTimelineTime: {
    backgroundColor: '#F97316',
  },
});
