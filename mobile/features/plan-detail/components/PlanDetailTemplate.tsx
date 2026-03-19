import { MaterialIcons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import { type PlanDetailDay, type PlanDetailTimelineItem } from '@/features/plan-detail/types';

type PlanDetailTemplateProps = {
  headerTitle: string;
  weatherLabel: string;
  headerLeftSlot?: ReactNode;
  headerRightSlot?: ReactNode;
  heroImage: string;
  heroBadge: string;
  title: string;
  subtitle: string;
  intro?: string;
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
};

export function PlanDetailTemplate({
  headerTitle,
  weatherLabel,
  headerLeftSlot,
  headerRightSlot,
  heroImage,
  heroBadge,
  title,
  subtitle,
  intro,
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
}: PlanDetailTemplateProps) {
  return (
    <View style={styles.screen}>
      <AppHeader title={headerTitle} weatherLabel={weatherLabel} leftSlot={headerLeftSlot} rightSlot={headerRightSlot} />

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{heroBadge}</Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {intro ? <Text style={styles.intro}>{intro}</Text> : null}

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
              <View key={String(item.id)}>
                <View style={styles.timelineRow}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeTextStrong}>{item.start}</Text>
                    <Text style={styles.timeTextMuted}>{item.end}</Text>
                  </View>

                  <View style={styles.cardColumn}>
                    <View
                      style={[
                        styles.timelineCard,
                        item.itemType === 'transport' && styles.timelineCardTransport,
                      ]}
                    >
                      <View style={styles.timelineCardHeader}>
                        <View style={styles.timelineCardTitleRow}>
                          <View
                            style={[
                              styles.timelineIconWrap,
                              item.itemType === 'transport' && styles.timelineIconWrapTransport,
                            ]}
                          >
                            <MaterialIcons name={item.icon ?? 'place'} size={16} color="#EC5B13" />
                          </View>
                          <Text style={styles.timelineCardTitle}>{item.title}</Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.durationBadge,
                          item.itemType === 'transport' && styles.durationBadgeTransport,
                        ]}
                      >
                        <Text
                          style={[
                            styles.durationBadgeText,
                            item.itemType === 'transport' && styles.durationBadgeTextTransport,
                          ]}
                        >
                          {item.itemType === 'transport'
                            ? item.metaLabel ?? '移動'
                            : `滞在: ${item.start} - ${item.end}`}
                        </Text>
                      </View>
                      <Text style={styles.timelineCardBody}>{item.body}</Text>
                    </View>
                  </View>
                </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FDFDFD',
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
  heroBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(236,91,19,0.15)',
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EC5B13',
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
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  intro: {
    paddingHorizontal: 20,
    paddingTop: 16,
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  timelineCardTransport: {
    backgroundColor: '#F8FBFF',
    borderColor: '#BFDBFE',
  },
  timelineCardHeader: {
    marginBottom: 10,
  },
  timelineCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconWrapTransport: {
    backgroundColor: '#DBEAFE',
  },
  timelineCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  durationBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 10,
  },
  durationBadgeTransport: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  durationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EC5B13',
  },
  durationBadgeTextTransport: {
    color: '#2563EB',
  },
  timelineCardBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
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
