import { MaterialIcons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import { type PlanDetailDay, type PlanDetailTimelineItem } from '@/features/plan-detail/types';

type PlanDetailTemplateProps = {
  headerTitle: string;
  weatherLabel: string;
  topNoticeMessage?: string | null;
  headerLeftSlot?: ReactNode;
  headerRightSlot?: ReactNode;
  heroImage: string;
  title: string;
  comment?: string;
  createdAtLabel?: string | null;
  travelDateLabel?: string | null;
  budgetLabel: string;
  moveTimeLabel: string;
  days: PlanDetailDay[];
  activeDayKey: string;
  onSelectDay: (dayKey: string) => void;
  timeline: PlanDetailTimelineItem[];
  primaryActionLabel: string;
  onPrimaryAction?: () => void;
  primaryActionSlot?: ReactNode;
  primaryButtonVariant?: 'orange' | 'gray';
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionDisabled?: boolean;
  secondaryButtonVariant?: 'light' | 'orange' | 'gray';
  footerSlot?: ReactNode;
  timelinePrimaryActionLabel?: string;
  onTimelinePrimaryAction?: (item: PlanDetailTimelineItem) => void;
  timelineSecondaryActionLabel?: string;
  onTimelineSecondaryAction?: (item: PlanDetailTimelineItem) => void;
  timelineActionLoadingId?: string | number | null;
};

export function PlanDetailTemplate({
  headerTitle,
  weatherLabel,
  topNoticeMessage,
  headerLeftSlot,
  headerRightSlot,
  heroImage,
  title,
  comment,
  createdAtLabel,
  travelDateLabel,
  budgetLabel,
  moveTimeLabel,
  days,
  activeDayKey,
  onSelectDay,
  timeline,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionSlot,
  primaryButtonVariant = 'orange',
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled,
  secondaryButtonVariant = 'light',
  footerSlot,
  timelinePrimaryActionLabel,
  onTimelinePrimaryAction,
  timelineSecondaryActionLabel,
  onTimelineSecondaryAction,
  timelineActionLoadingId,
}: PlanDetailTemplateProps) {
  const [selectedTransportItem, setSelectedTransportItem] = useState<PlanDetailTimelineItem | null>(null);
  const [selectedPlaceActionItem, setSelectedPlaceActionItem] = useState<PlanDetailTimelineItem | null>(null);

  return (
    <View style={styles.screen}>
      <AppHeader title={headerTitle} weatherLabel={weatherLabel} leftSlot={headerLeftSlot} rightSlot={headerRightSlot} />

      {topNoticeMessage ? (
        <View style={styles.topNoticeWrap}>
          <MaterialIcons name="autorenew" size={16} color="#C2410C" />
          <Text style={styles.topNoticeText}>{topNoticeMessage}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {comment ? (
            <View style={styles.commentRow}>
              <MaterialIcons name="lightbulb" size={16} color="#EC5B13" />
              <Text style={styles.comment}>{comment}</Text>
            </View>
          ) : null}
          <View style={styles.metaColumn}>
            {createdAtLabel ? <Text style={styles.metaText}>{createdAtLabel}</Text> : null}
            {travelDateLabel ? <Text style={styles.metaText}>{travelDateLabel}</Text> : null}
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={[styles.statCard, styles.statCardOrange]}>
            <Text style={styles.statLabelOrange}>概算予算</Text>
            <Text style={styles.statValueOrange}>{budgetLabel}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardBlue]}>
            <Text style={styles.statLabelBlue}>総移動時間</Text>
            <Text style={styles.statValueBlue}>{moveTimeLabel}</Text>
          </View>
        </View>

        <View style={styles.dayHeader}>
          <Text style={styles.sectionTitle}>タイムライン</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
            {days.map((day) => {
              const active = day.key === activeDayKey;
              return (
                <Pressable key={day.key} style={[styles.dayTab, active && styles.dayTabActive]} onPress={() => onSelectDay(day.key)}>
                  <Text style={[styles.dayTabText, active && styles.dayTabTextActive]}>{day.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.timelineSection}>
          {timeline.length ? (
            timeline.map((item) => (
              <View
                key={String(item.id)}
                style={[
                  styles.timelineEntry,
                  item.itemType === 'transport' ? styles.timelineEntryTransport : styles.timelineEntryPlace,
                ]}
              >
                {item.itemType === 'transport' ? (
                  <View style={styles.transportRow}>
                    <View style={styles.transportConnectorColumn}>
                      <View style={styles.transportConnectorLine} />
                    </View>

                    <View style={styles.transportBubbleWrap}>
                      <Pressable style={styles.transportBubble} onPress={() => setSelectedTransportItem(item)}>
                        <MaterialIcons name={item.icon ?? 'directions-bus'} size={18} color="#2563EB" />
                        <Text style={styles.transportTitle}>{item.title}</Text>
                        {item.metaLabel ? <View style={styles.transportDot} /> : null}
                        {item.durationLabel ? <Text style={styles.transportDuration}>{item.durationLabel}</Text> : null}
                        {item.metaLabel ? <Text style={styles.transportMeta}>{item.metaLabel}</Text> : null}
                        <MaterialIcons name="chevron-right" size={16} color="#94A3B8" />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.timelineRow}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeTextStrong}>{item.start}</Text>
                      <Text style={styles.timeTextMuted}>{item.end}</Text>
                    </View>

                    <View style={styles.cardColumn}>
                      <View style={styles.timelineCard}>
                        <View style={styles.timelineCardHeader}>
                          <View style={styles.timelineCardTitleRow}>
                            <View style={styles.timelineIconWrap}>
                              <MaterialIcons name={item.icon ?? 'place'} size={16} color="#EC5B13" />
                            </View>
                            <Text style={styles.timelineCardTitle}>{item.title}</Text>
                          </View>
                          {(timelinePrimaryActionLabel || timelineSecondaryActionLabel) ? (
                            <Pressable
                              style={styles.moreButton}
                              onPress={() => setSelectedPlaceActionItem(item)}
                            >
                              <MaterialIcons name="more-horiz" size={18} color="#94A3B8" />
                            </Pressable>
                          ) : (
                            <MaterialIcons name="more-horiz" size={18} color="#CBD5E1" />
                          )}
                        </View>

                        {item.durationLabel ? (
                          <View style={styles.durationBadge}>
                            <Text style={styles.durationBadgeText}>滞在: {item.durationLabel}</Text>
                          </View>
                        ) : null}

                        <Text style={styles.timelineCardBody}>{item.body}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyTimelineCard}>
              <Text style={styles.timelineCardBody}>この日の行程はまだありません。</Text>
            </View>
          )}
        </View>

        <View style={styles.actionSection}>
          {primaryActionSlot ?? (
            <Pressable
              style={[
                styles.primaryButton,
                primaryButtonVariant === 'gray' && styles.primaryButtonGray,
              ]}
              onPress={onPrimaryAction}
            >
              <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
            </Pressable>
          )}

          {secondaryActionLabel ? (
            <Pressable
              style={[
                styles.secondaryButton,
                secondaryButtonVariant === 'orange' && styles.secondaryButtonOrange,
                secondaryButtonVariant === 'gray' && styles.secondaryButtonGray,
                secondaryActionDisabled && styles.buttonDisabled,
              ]}
              onPress={onSecondaryAction}
              disabled={secondaryActionDisabled}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  secondaryButtonVariant === 'orange' && styles.secondaryButtonTextOrange,
                  secondaryButtonVariant === 'gray' && styles.secondaryButtonTextGray,
                ]}
              >
                {secondaryActionLabel}
              </Text>
            </Pressable>
          ) : null}

          {footerSlot}
        </View>
      </ScrollView>

      <Modal
        visible={selectedTransportItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTransportItem(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedTransportItem(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIconWrap}>
                  <MaterialIcons name={selectedTransportItem?.icon ?? 'directions-bus'} size={18} color="#2563EB" />
                </View>
                <Text style={styles.modalTitle}>{selectedTransportItem?.title ?? '移動詳細'}</Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={() => setSelectedTransportItem(null)}>
                <MaterialIcons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>

            {selectedTransportItem?.durationLabel ? (
              <View style={styles.modalBadgeRow}>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>移動時間 {selectedTransportItem.durationLabel}</Text>
                </View>
                {selectedTransportItem.metaLabel ? (
                  <View style={[styles.modalBadge, styles.modalBadgeMuted]}>
                    <Text style={[styles.modalBadgeText, styles.modalBadgeTextMuted]}>
                      {selectedTransportItem.metaLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.modalInfoCard}>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>出発</Text>
                <Text style={styles.modalInfoValue}>{selectedTransportItem?.start ?? '--:--'}</Text>
              </View>
              <View style={styles.modalInfoDivider} />
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>到着</Text>
                <Text style={styles.modalInfoValue}>{selectedTransportItem?.end ?? '--:--'}</Text>
              </View>
            </View>

            {selectedTransportItem?.body ? (
              <View style={styles.modalDetailSection}>
                <Text style={styles.modalDetailLabel}>ルート詳細</Text>
                <Text style={styles.modalDetailBody}>{selectedTransportItem.body}</Text>
                {selectedTransportItem.lineName ? (
                  <Text style={styles.modalDetailSubtext}>路線: {selectedTransportItem.lineName}</Text>
                ) : null}
                {selectedTransportItem.departureStopName ? (
                  <Text style={styles.modalDetailSubtext}>出発駅・停留所: {selectedTransportItem.departureStopName}</Text>
                ) : null}
                {selectedTransportItem.arrivalStopName ? (
                  <Text style={styles.modalDetailSubtext}>到着駅・停留所: {selectedTransportItem.arrivalStopName}</Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={selectedPlaceActionItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPlaceActionItem(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedPlaceActionItem(null)}>
          <Pressable style={styles.placeMenuSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.placeMenuTitle}>{selectedPlaceActionItem?.title ?? 'スポット操作'}</Text>

            {timelinePrimaryActionLabel ? (
              <Pressable
                style={[
                  styles.placeMenuButton,
                  styles.placeMenuButtonLight,
                  timelineActionLoadingId === selectedPlaceActionItem?.id && styles.timelineActionButtonDisabled,
                ]}
                onPress={() => {
                  if (!selectedPlaceActionItem) {
                    return;
                  }
                  setSelectedPlaceActionItem(null);
                  onTimelinePrimaryAction?.(selectedPlaceActionItem);
                }}
                disabled={timelineActionLoadingId === selectedPlaceActionItem?.id}
              >
                <Text style={styles.timelineActionButtonText}>{timelinePrimaryActionLabel}</Text>
              </Pressable>
            ) : null}

            {timelineSecondaryActionLabel ? (
              <Pressable
                style={[
                  styles.placeMenuButton,
                  styles.placeMenuButtonOrange,
                  timelineActionLoadingId === selectedPlaceActionItem?.id && styles.timelineActionButtonDisabled,
                ]}
                onPress={() => {
                  if (!selectedPlaceActionItem) {
                    return;
                  }
                  setSelectedPlaceActionItem(null);
                  onTimelineSecondaryAction?.(selectedPlaceActionItem);
                }}
                disabled={timelineActionLoadingId === selectedPlaceActionItem?.id}
              >
                <Text style={styles.timelineActionButtonTextOrange}>{timelineSecondaryActionLabel}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FDFDFD',
  },
  topNoticeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  topNoticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#C2410C',
  },
  contentContainer: {
    paddingBottom: 28,
  },
  heroWrap: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: '#E2E8F0',
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  commentRow: {
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  comment: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  metaColumn: {
    paddingTop: 10,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  statCardOrange: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  statCardBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statLabelOrange: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(194,65,12,0.7)',
    marginBottom: 4,
  },
  statLabelBlue: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(29,78,216,0.7)',
    marginBottom: 4,
  },
  statValueOrange: {
    fontSize: 24,
    fontWeight: '700',
    color: '#C2410C',
  },
  statValueBlue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  dayHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  dayTabs: {
    gap: 6,
    paddingLeft: 12,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  dayTabActive: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dayTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  dayTabTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EC5B13',
  },
  timelineSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  timelineEntry: {
    width: '100%',
  },
  timelineEntryPlace: {
    marginBottom: 2,
  },
  timelineEntryTransport: {
    marginVertical: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 14,
  },
  timeColumn: {
    width: 52,
    paddingTop: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeTextStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  timeTextMuted: {
    marginTop: 24,
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  cardColumn: {
    flex: 1,
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  timelineCardHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  timelineCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  timelineIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  durationBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 10,
  },
  durationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EC5B13',
  },
  timelineCardBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
  },
  timelineActionButtonDisabled: {
    opacity: 0.6,
  },
  timelineActionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },
  timelineActionButtonTextOrange: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeMenuSheet: {
    width: '100%',
    marginTop: 'auto',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 12,
  },
  placeMenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  placeMenuButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  placeMenuButtonLight: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  placeMenuButtonOrange: {
    backgroundColor: '#EC5B13',
  },
  transportRow: {
    flexDirection: 'row',
    gap: 14,
    height: 72,
  },
  transportConnectorColumn: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportConnectorLine: {
    width: 2,
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  transportBubbleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    flexWrap: 'wrap',
  },
  transportTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  transportDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  transportDuration: {
    fontSize: 11,
    fontWeight: '900',
    color: '#2563EB',
  },
  transportMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalSheet: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  modalBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  modalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modalBadgeMuted: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  modalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  modalBadgeTextMuted: {
    color: '#475569',
  },
  modalInfoCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalInfoDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  modalInfoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalInfoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalDetailSection: {
    marginTop: 16,
    gap: 8,
  },
  modalDetailLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalDetailBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
  },
  modalDetailSubtext: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  emptyTimelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 12,
  },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#EC5B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonGray: {
    backgroundColor: '#94A3B8',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonOrange: {
    backgroundColor: '#EC5B13',
  },
  secondaryButtonGray: {
    backgroundColor: '#CBD5E1',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButtonTextOrange: {
    color: '#FFFFFF',
  },
  secondaryButtonTextGray: {
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
