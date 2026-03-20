import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { weatherMock } from '@/data/travel';
import { getRecommendPlans } from '@/features/recommend/api/get-recommend-plans';
import { RecommendPlanCard } from '@/features/recommend/components/RecommendPlanCard';
import { type RecommendPlanListItemViewModel } from '@/features/recommend/types';
import {
  pickHomeRecommendPlans,
  toRecommendPlanListItemViewModels,
} from '@/features/recommend/utils/recommend-list';
import { formatTripStatusLabel } from '@/features/trips/utils/trip-list';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { buildHomeOngoingTripView, selectFeaturedOngoingTrip, type HomeTimelineItem } from '@/features/travel/utils/home-trip';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { getTrips } from '@/features/trips/api/get-trips';
import { type TripDetailAggregateResponse } from '@/features/trips/types/trip-detail';
import { type TripResponse } from '@/features/trips/types/trip-edit';

type DetailState = 'idle' | 'ready' | 'empty' | 'unavailable';
type RecommendationState = 'loading' | 'ready' | 'empty' | 'error';

function TimelineItemBlock({
  label,
  item,
}: {
  label: '現在' | 'まもなく' | 'このあと' | '終了';
  item: HomeTimelineItem;
}) {
  const isUpcoming = label === 'まもなく' || label === 'このあと';
  const iconName =
    item.itemType === 'transport'
      ? item.transportMode === 'WALK'
        ? 'directions-walk'
        : item.transportMode === 'BUS'
          ? 'directions-bus'
          : 'train'
      : 'place';
  const iconColor = item.itemType === 'transport'
    ? isUpcoming
      ? '#0369A1'
      : '#EA580C'
    : '#0284C7';

  return (
    <View style={[styles.timelineBlock, isUpcoming ? styles.timelineBlockUpcoming : null]}>
      <View style={styles.timelineBlockHeader}>
        <View
          style={[
            styles.timelineStateBadge,
            isUpcoming ? styles.timelineStateBadgeNext : null,
            label === '終了' ? styles.timelineStateBadgeFinished : null,
          ]}
        >
          <Text
            style={[
              styles.timelineStateBadgeText,
              isUpcoming ? styles.timelineStateBadgeTextUpcoming : null,
              label === '終了' ? styles.timelineStateBadgeTextFinished : null,
            ]}
          >
            {label}
          </Text>
        </View>
      </View>

      <View style={travelStyles.timelineRow}>
        <Text
          style={[
            travelStyles.timelineTime,
            isUpcoming ? styles.nextTimelineTime : null,
            label === '終了' ? styles.finishedTimelineTime : null,
          ]}
        >
          {item.time}
        </Text>

        <View style={travelStyles.timelineTextBlock}>
          <View style={styles.timelineTitleRow}>
            <View
              style={[
                styles.timelineIconWrap,
                item.itemType === 'transport' ? styles.timelineIconWrapTransport : null,
                isUpcoming && item.itemType === 'transport' ? styles.timelineIconWrapTransportUpcoming : null,
              ]}
            >
              <MaterialIcons
                name={iconName}
                size={16}
                color={iconColor}
              />
            </View>
            <Text style={travelStyles.timelineText}>{item.title}</Text>
          </View>

          <Text style={[travelStyles.subheading, styles.timelineMemo]}>{item.detail}</Text>

          {item.metaLabel ? (
            <View style={styles.timelineMetaChip}>
              <Text style={styles.timelineMetaChipText}>{item.metaLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

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
        <Text
          style={[
            travelStyles.subheading,
            timelineView?.sectionTitle === '次の予定' ? styles.timelineSectionTitleUpcoming : null,
          ]}
        >
          {timelineView?.dayLabel ? `${timelineView.sectionTitle} (${timelineView.dayLabel})` : timelineView?.sectionTitle ?? '本日の行程'}
        </Text>

        {detailState === 'ready' && timelineView?.hasTimeline && timelineView.primaryItem ? (
          <>
            <TimelineItemBlock label={timelineView.primaryLabel} item={timelineView.primaryItem} />

            {timelineView.secondaryItem || timelineView.helperText ? <View style={travelStyles.divider} /> : null}

            {timelineView.secondaryItem ? (
              <>
                <TimelineItemBlock label={timelineView.secondaryLabel ?? 'このあと'} item={timelineView.secondaryItem} />
              </>
            ) : null}

            {timelineView.helperText ? <Text style={[travelStyles.subheading, styles.timelineHelperText]}>{timelineView.helperText}</Text> : null}
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
    </>
  );
}

function HomeRecommendationsSection({
  traveling,
  recommendations,
  recommendationState,
}: {
  traveling: boolean;
  recommendations: RecommendPlanListItemViewModel[];
  recommendationState: RecommendationState;
}) {
  return (
    <>
      <RecommendationsSection traveling={traveling} />

      {recommendationState === 'loading' ? (
        <View style={styles.recommendStatusCard}>
          <ActivityIndicator color="#EC5B13" />
          <Text style={travelStyles.subheading}>おすすめを読み込み中...</Text>
        </View>
      ) : null}

      {recommendationState === 'error' ? (
        <View style={styles.recommendStatusCard}>
          <Text style={travelStyles.subheading}>おすすめの取得に失敗しました。時間をおいて再度お試しください。</Text>
        </View>
      ) : null}

      {recommendationState === 'empty' ? (
        <View style={styles.recommendStatusCard}>
          <Text style={travelStyles.subheading}>表示できるおすすめ旅がまだありません。</Text>
        </View>
      ) : null}

      {recommendationState === 'ready' ? (
        <View style={travelStyles.horizontalSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recommendationsScrollContent}
          >
            {recommendations.map((plan) => (
              <Link key={plan.id} href={{ pathname: '/recommend/detail', params: { id: plan.id } }} asChild>
                <Pressable>
                  <RecommendPlanCard plan={plan} variant="home" />
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}

export default function HomeScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [ongoingTrip, setOngoingTrip] = useState<TripResponse | null>(null);
  const [ongoingDetail, setOngoingDetail] = useState<TripDetailAggregateResponse | null>(null);
  const [detailState, setDetailState] = useState<DetailState>('idle');
  const [recommendationState, setRecommendationState] = useState<RecommendationState>('loading');
  const [recommendations, setRecommendations] = useState<RecommendPlanListItemViewModel[]>([]);

  const loadOngoingTrip = useCallback(async () => {
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

  const loadRecommendations = useCallback(async () => {
    try {
      setRecommendationState('loading');
      const plans = await getRecommendPlans();
      const homePlans = pickHomeRecommendPlans(toRecommendPlanListItemViewModels(plans));
      setRecommendations(homePlans);
      setRecommendationState(homePlans.length ? 'ready' : 'empty');
    } catch {
      setRecommendations([]);
      setRecommendationState('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOngoingTrip();
      void loadRecommendations();
    }, [loadOngoingTrip, loadRecommendations])
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

        <HomeRecommendationsSection
          traveling={!!ongoingTrip}
          recommendations={recommendations}
          recommendationState={recommendationState}
        />
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
  recommendationsScrollContent: {
    gap: 12,
    paddingVertical: 4,
    paddingRight: 16,
  },
  recommendStatusCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
    minWidth: 0,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
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
    flexShrink: 0,
    alignSelf: 'flex-start',
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
  timelineBlock: {
    gap: 8,
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  timelineBlockUpcoming: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  timelineBlockHeader: {
    flexDirection: 'row',
  },
  timelineStateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
    alignSelf: 'flex-start',
  },
  timelineStateBadgeNext: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  timelineStateBadgeFinished: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  timelineStateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  timelineStateBadgeTextUpcoming: {
    color: '#FFFFFF',
  },
  timelineStateBadgeTextFinished: {
    color: '#475569',
  },
  timelineTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  timelineIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    flexShrink: 0,
    marginTop: 1,
  },
  timelineIconWrapTransport: {
    backgroundColor: '#FFEDD5',
  },
  timelineIconWrapTransportUpcoming: {
    backgroundColor: '#E0F2FE',
  },
  timelineMemo: {
    lineHeight: 20,
  },
  timelineMetaChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  timelineMetaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#075985',
  },
  timelineHelperText: {
    lineHeight: 20,
  },
  timelineSectionTitleUpcoming: {
    color: '#0369A1',
    fontWeight: '700',
  },
  nextTimelineTime: {
    backgroundColor: '#0EA5E9',
  },
  finishedTimelineTime: {
    backgroundColor: '#94A3B8',
  },
});
