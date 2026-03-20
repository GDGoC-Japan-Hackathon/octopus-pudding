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
  disabled?: boolean;
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

function formatDateRangeLabel(startDate: string, endDate: string) {
  if (startDate && endDate) {
    return `${formatDateDisplay(startDate)} 〜 ${formatDateDisplay(endDate)}`;
  }
  if (startDate) {
    return `${formatDateDisplay(startDate)} 〜 終了日`;
  }
  return '開始日〜終了日';
}

function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function buildNextDateRange({
  field,
  selectedDate,
  currentStartDate,
  currentEndDate,
  maxTripDays,
}: {
  field: DateFieldKey;
  selectedDate: Date;
  currentStartDate: Date | null;
  currentEndDate: Date | null;
  maxTripDays?: number;
}) {
  const normalizedSelectedDate = new Date(selectedDate);
  normalizedSelectedDate.setHours(0, 0, 0, 0);
  let nextStartDate = field === 'startDate' ? normalizedSelectedDate : currentStartDate;
  let nextEndDate = field === 'endDate' ? normalizedSelectedDate : currentEndDate;

  if (nextStartDate && (!nextEndDate || nextEndDate.getTime() < nextStartDate.getTime())) {
    nextEndDate = nextStartDate;
  }

  if (typeof maxTripDays === 'number' && maxTripDays > 0 && nextStartDate && nextEndDate) {
    const maxEnd = addDays(nextStartDate, maxTripDays - 1);
    if (nextEndDate.getTime() > maxEnd.getTime()) {
      nextEndDate = maxEnd;
    }
  }

  return {
    startDate: nextStartDate,
    endDate: nextEndDate,
  };
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
  disabled = false,
}: ScheduleFieldProps) {
  const [activePicker, setActivePicker] = useState<DateFieldKey | null>(null);
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const todayDate = useMemo(() => getTodayDate(), []);

  const applyDateField = useCallback(
    (
      field: DateFieldKey,
      selectedDate: Date,
      overrides?: {
        startDate?: Date | null;
        endDate?: Date | null;
      }
    ) => {
      const next = buildNextDateRange({
        field,
        selectedDate,
        currentStartDate: overrides?.startDate ?? parseDateInput(startDate),
        currentEndDate: overrides?.endDate ?? parseDateInput(endDate),
        maxTripDays,
      });

      onChangeStartDate(next.startDate ? formatDateInput(next.startDate) : '');
      onChangeEndDate(next.endDate ? formatDateInput(next.endDate) : '');

      return next;
    },
    [endDate, maxTripDays, onChangeEndDate, onChangeStartDate, startDate]
  );

  const openAndroidDatePicker = useCallback(
    (
      field: DateFieldKey,
      overrides?: {
        startDate?: Date | null;
        endDate?: Date | null;
      }
    ) => {
      const resolvedStartDate = overrides?.startDate ?? parseDateInput(startDate);
      const resolvedEndDate = overrides?.endDate ?? parseDateInput(endDate);
      const baseValue =
        (field === 'startDate' ? resolvedStartDate : resolvedEndDate) ??
        resolvedStartDate ??
        todayDate;

      DateTimePickerAndroid.open({
        mode: 'date',
        display: 'calendar',
        value: baseValue,
        minimumDate: field === 'endDate' ? resolvedStartDate ?? undefined : undefined,
        maximumDate:
          field === 'endDate' && typeof maxTripDays === 'number' && maxTripDays > 0 && resolvedStartDate
            ? addDays(resolvedStartDate, maxTripDays - 1)
            : undefined,
        onChange: (event, selectedDate) => {
          if (event.type !== 'set' || !selectedDate) {
            return;
          }

          const next = applyDateField(field, selectedDate, {
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
          });

          if (field === 'startDate') {
            setTimeout(() => {
              openAndroidDatePicker('endDate', {
                startDate: next.startDate,
                endDate: next.endDate,
              });
            }, 0);
          }
        },
      });
    },
    [applyDateField, endDate, maxTripDays, startDate, todayDate]
  );

  const openDatePicker = useCallback(
    (field: DateFieldKey) => {
      if (disabled) {
        return;
      }

      if (Platform.OS === 'android') {
        openAndroidDatePicker(field);
        return;
      }

      setDraftDate(
        field === 'startDate'
          ? parseDateInput(startDate) ?? todayDate
          : parseDateInput(endDate) ?? parseDateInput(startDate) ?? todayDate
      );
      setActivePicker(field);
    },
    [disabled, endDate, openAndroidDatePicker, startDate, todayDate]
  );

  const rangeLabel = formatDateRangeLabel(startDate, endDate);

  const pickerValue = useMemo(() => {
    if (draftDate) {
      return draftDate;
    }
    if (activePicker === 'startDate') {
      return parseDateInput(startDate) ?? todayDate;
    }
    if (activePicker === 'endDate') {
      return parseDateInput(endDate) ?? parseDateInput(startDate) ?? todayDate;
    }
    return todayDate;
  }, [activePicker, draftDate, endDate, startDate, todayDate]);

  const pickerMinimumDate = useMemo(() => {
    if (activePicker === 'endDate') {
      return parseDateInput(startDate) ?? undefined;
    }
    return undefined;
  }, [activePicker, startDate]);

  const pickerMaximumDate = useMemo(() => {
    const parsedStartDate = parseDateInput(startDate);
    if (activePicker === 'endDate' && typeof maxTripDays === 'number' && maxTripDays > 0 && parsedStartDate) {
      return addDays(parsedStartDate, maxTripDays - 1);
    }
    return undefined;
  }, [activePicker, maxTripDays, startDate]);

  const handleModalDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (event.type !== 'set' || !selectedDate || activePicker === null) {
        return;
      }
      setDraftDate(selectedDate);
    },
    [activePicker]
  );

  const handleClosePicker = useCallback(() => {
    setActivePicker(null);
    setDraftDate(null);
  }, []);

  const handleConfirmPicker = useCallback(() => {
    if (activePicker !== null && draftDate !== null) {
      applyDateField(activePicker, draftDate);
    }
    setActivePicker(null);
    setDraftDate(null);
  }, [activePicker, applyDateField, draftDate]);

  return (
    <View style={style}>
      <FieldLabel label={label} required={required} iconName={iconName} />

      <View style={styles.scheduleRow}>
        <View style={styles.schedulePickerOptions}>
          <Pressable
            style={[styles.scheduleInput, disabled ? styles.scheduleInputDisabled : null]}
            onPress={() => openDatePicker('startDate')}
            disabled={disabled}
          >
            <View style={styles.scheduleTextWrap}>
              <Text style={styles.scheduleFieldLabel}>開始日</Text>
              <Text
                style={[
                  styles.scheduleValueText,
                  disabled ? styles.scheduleValueTextDisabled : null,
                  !startDate ? styles.schedulePlaceholderText : null,
                ]}
              >
                {startDate ? formatDateDisplay(startDate) : '開始日を選択'}
              </Text>
            </View>
            <MaterialIcons name={disabled ? 'lock' : 'calendar-today'} size={18} color="#94A3B8" />
          </Pressable>

          <Pressable
            style={[styles.scheduleInput, disabled ? styles.scheduleInputDisabled : null]}
            onPress={() => openDatePicker('endDate')}
            disabled={disabled}
          >
            <View style={styles.scheduleTextWrap}>
              <Text style={styles.scheduleFieldLabel}>終了日</Text>
              <Text
                style={[
                  styles.scheduleValueText,
                  disabled ? styles.scheduleValueTextDisabled : null,
                  !endDate ? styles.schedulePlaceholderText : null,
                ]}
              >
                {endDate ? formatDateDisplay(endDate) : '終了日を選択'}
              </Text>
            </View>
            <MaterialIcons name={disabled ? 'lock' : 'calendar-today'} size={18} color="#94A3B8" />
          </Pressable>
        </View>
      </View>

      <Text style={styles.scheduleHelperText}>{rangeLabel}</Text>

      <Modal
        visible={activePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={handleClosePicker}
      >
        <View style={styles.dateModalOverlay}>
          <View style={styles.dateModalSheet}>
            <View style={styles.dateModalHeader}>
              <Text style={styles.dateModalTitle}>
                {activePicker === 'startDate' ? '開始日を選択' : '終了日を選択'}
              </Text>
            </View>

            <View style={styles.calendarSection}>
              <DateTimePicker
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="light"
                value={pickerValue}
                minimumDate={pickerMinimumDate}
                maximumDate={pickerMaximumDate}
                onChange={handleModalDateChange}
              />
            </View>

            <View style={styles.dateModalFooter}>
              <Pressable
                style={[styles.dateModalActionButton, styles.dateModalSecondaryButton]}
                onPress={handleClosePicker}
              >
                <Text style={styles.dateModalSecondaryButtonText}>閉じる</Text>
              </Pressable>
              <Pressable
                style={[styles.dateModalActionButton, styles.dateModalConfirmButton]}
                onPress={handleConfirmPicker}
              >
                <Text style={styles.dateModalConfirmButtonText}>決定</Text>
              </Pressable>
            </View>
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
  scheduleRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  schedulePickerOptions: {
    flex: 1,
    gap: 10,
  },
  scheduleInput: {
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
  scheduleInputDisabled: {
    backgroundColor: '#F8FAFC',
  },
  scheduleTextWrap: {
    flex: 1,
    gap: 2,
  },
  scheduleFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  scheduleValueText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#0F172A',
  },
  scheduleValueTextDisabled: {
    color: '#64748B',
  },
  schedulePlaceholderText: {
    color: '#94A3B8',
  },
  scheduleHelperText: {
    marginTop: 8,
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
    justifyContent: 'center',
    marginBottom: 14,
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  calendarSection: {
    alignItems: 'center',
  },
  dateModalFooter: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  dateModalActionButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  dateModalSecondaryButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dateModalSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  dateModalConfirmButton: {
    backgroundColor: '#EC5B13',
  },
  dateModalConfirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
