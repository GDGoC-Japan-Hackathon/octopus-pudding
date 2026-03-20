import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type DateFieldKey = 'startDate' | 'endDate';

type ParticipantCountFieldProps = {
  participantCount: string;
  onChangeParticipantCount: (value: string) => void;
  label?: string;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  required?: boolean;
  maxParticipantCount?: number;
  style?: StyleProp<ViewStyle>;
};

type ScheduleFieldProps = {
  startDate: string;
  endDate: string;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
  label?: string;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  required?: boolean;
  maxTripDays?: number;
  style?: StyleProp<ViewStyle>;
};

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

function FieldLabel({
  label,
  required = false,
  iconName,
}: {
  label: string;
  required?: boolean;
  iconName?: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <View style={styles.fieldLabelRow}>
      {iconName ? <MaterialIcons name={iconName} size={16} color="#EC5B13" style={styles.fieldLabelIcon} /> : null}
      <View style={styles.fieldLabelTextWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required ? <Text style={styles.requiredMark}>※</Text> : null}
      </View>
    </View>
  );
}

export function ParticipantCountField({
  participantCount,
  onChangeParticipantCount,
  label = '人数',
  iconName,
  required = false,
  maxParticipantCount,
  style,
}: ParticipantCountFieldProps) {
  const participantCountNumber = useMemo(() => {
    const parsed = Number(participantCount);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return 1;
    }
    return parsed;
  }, [participantCount]);

  const canIncrement =
    typeof maxParticipantCount === 'number'
      ? participantCountNumber < maxParticipantCount
      : true;

  return (
    <View style={style}>
      <FieldLabel label={label} required={required} iconName={iconName} />
      <View style={styles.stepperWrap}>
        <Pressable
          style={[styles.stepperButton, participantCountNumber <= 1 ? styles.stepperButtonDisabled : null]}
          onPress={() => onChangeParticipantCount(String(Math.max(1, participantCountNumber - 1)))}
          disabled={participantCountNumber <= 1}
        >
          <MaterialIcons name="remove" size={20} color={participantCountNumber <= 1 ? '#94A3B8' : '#334155'} />
        </Pressable>

        <View style={styles.stepperValueWrap}>
          <Text style={styles.stepperValueText}>{participantCountNumber}</Text>
          <Text style={styles.stepperValueUnit}>人</Text>
        </View>

        <Pressable
          style={[styles.stepperButton, !canIncrement ? styles.stepperButtonDisabled : null]}
          onPress={() =>
            onChangeParticipantCount(
              String(
                typeof maxParticipantCount === 'number'
                  ? Math.min(maxParticipantCount, participantCountNumber + 1)
                  : participantCountNumber + 1
              )
            )
          }
          disabled={!canIncrement}
        >
          <MaterialIcons name="add" size={20} color={!canIncrement ? '#94A3B8' : '#334155'} />
        </Pressable>
      </View>
    </View>
  );
}

export function ScheduleField({
  startDate,
  endDate,
  onChangeStartDate,
  onChangeEndDate,
  label = '日程',
  iconName,
  required = false,
  maxTripDays,
  style,
}: ScheduleFieldProps) {
  const [activeDateField, setActiveDateField] = useState<DateFieldKey>('startDate');
  const [isIosDateModalVisible, setIsIosDateModalVisible] = useState(false);

  const applyDateField = useCallback(
    (field: DateFieldKey, date: Date) => {
      const formatted = formatDateInput(date);
      let nextStartDate = field === 'startDate' ? formatted : startDate;
      let nextEndDate = field === 'endDate' ? formatted : endDate;
      const parsedStart = parseDateInput(nextStartDate);
      let parsedEnd = parseDateInput(nextEndDate);

      if (parsedStart && parsedEnd && parsedEnd.getTime() < parsedStart.getTime()) {
        if (field === 'startDate') {
          nextEndDate = formatted;
          parsedEnd = parsedStart;
        } else {
          nextStartDate = formatted;
        }
      }

      if (typeof maxTripDays === 'number' && maxTripDays > 0 && parsedStart && parsedEnd) {
        const maxEnd = addDays(parsedStart, maxTripDays - 1);
        if (parsedEnd.getTime() > maxEnd.getTime()) {
          nextEndDate = formatDateInput(maxEnd);
        }
      }

      onChangeStartDate(nextStartDate);
      onChangeEndDate(nextEndDate);
    },
    [endDate, maxTripDays, onChangeEndDate, onChangeStartDate, startDate]
  );

  const openAndroidDatePicker = useCallback(
    (field: DateFieldKey) => {
      const baseValue =
        parseDateInput(field === 'startDate' ? startDate : endDate) ??
        (field === 'endDate' ? parseDateInput(startDate) : null) ??
        new Date();
      const parsedStart = parseDateInput(startDate);
      const parsedEnd = parseDateInput(endDate);

      DateTimePickerAndroid.open({
        mode: 'date',
        display: 'calendar',
        value: baseValue,
        minimumDate:
          field === 'endDate'
            ? parsedStart ?? undefined
            : typeof maxTripDays === 'number' && maxTripDays > 0 && parsedEnd
              ? subtractDays(parsedEnd, maxTripDays - 1)
              : undefined,
        maximumDate:
          field === 'endDate'
            ? typeof maxTripDays === 'number' && maxTripDays > 0 && parsedStart
              ? addDays(parsedStart, maxTripDays - 1)
              : undefined
            : typeof maxTripDays === 'number' && maxTripDays > 0
              ? parsedEnd ?? undefined
              : undefined,
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
    [applyDateField, endDate, maxTripDays, startDate]
  );

  const openSchedulePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      openAndroidDatePicker('startDate');
      return;
    }

    setActiveDateField(endDate ? 'endDate' : 'startDate');
    setIsIosDateModalVisible(true);
  }, [endDate, openAndroidDatePicker]);

  const iosPickerValue = useMemo(
    () =>
      parseDateInput(activeDateField === 'startDate' ? startDate : endDate) ??
      (activeDateField === 'endDate' ? parseDateInput(startDate) : null) ??
      new Date(),
    [activeDateField, endDate, startDate]
  );

  const iosPickerMinimumDate = useMemo(() => {
    const parsedStart = parseDateInput(startDate);
    const parsedEnd = parseDateInput(endDate);

    if (activeDateField === 'endDate') {
      return parsedStart ?? undefined;
    }

    if (typeof maxTripDays === 'number' && maxTripDays > 0 && parsedEnd) {
      return subtractDays(parsedEnd, maxTripDays - 1);
    }

    return undefined;
  }, [activeDateField, endDate, maxTripDays, startDate]);

  const iosPickerMaximumDate = useMemo(() => {
    const parsedStart = parseDateInput(startDate);
    const parsedEnd = parseDateInput(endDate);

    if (activeDateField === 'endDate') {
      if (typeof maxTripDays === 'number' && maxTripDays > 0 && parsedStart) {
        return addDays(parsedStart, maxTripDays - 1);
      }
      return undefined;
    }

    return parsedEnd ?? undefined;
  }, [activeDateField, endDate, maxTripDays, startDate]);

  const scheduleLabel = useMemo(() => {
    if (startDate && endDate) {
      return `${formatDateDisplay(startDate)} 〜 ${formatDateDisplay(endDate)}`;
    }
    if (startDate) {
      return `${formatDateDisplay(startDate)} 〜 終了日を選択`;
    }
    return '開始日〜終了日を選択';
  }, [endDate, startDate]);

  const handleIosDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (event.type === 'dismissed' || !selectedDate) {
        return;
      }
      applyDateField(activeDateField, selectedDate);
    },
    [activeDateField, applyDateField]
  );

  return (
    <View style={style}>
      <FieldLabel label={label} required={required} iconName={iconName} />
      <Pressable style={styles.scheduleInput} onPress={openSchedulePicker}>
        <View style={styles.scheduleInputBody}>
          <View style={styles.scheduleTextWrap}>
            <Text
              style={[
                styles.scheduleValueText,
                !(startDate || endDate) ? styles.schedulePlaceholderText : null,
              ]}
            >
              {scheduleLabel}
            </Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
      </Pressable>

      <Modal
        visible={isIosDateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsIosDateModalVisible(false)}
      >
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
              minimumDate={iosPickerMinimumDate}
              maximumDate={iosPickerMaximumDate}
              onChange={handleIosDateChange}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  fieldLabelIcon: {
    marginTop: 1,
  },
  fieldLabelTextWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 1,
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#334155',
  },
  requiredMark: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: -4,
  },
  scheduleInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    fontSize: 14,
    fontWeight: '400',
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
