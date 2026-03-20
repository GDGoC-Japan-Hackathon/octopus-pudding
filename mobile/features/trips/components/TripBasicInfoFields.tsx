import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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

function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function subtractDays(base: Date, days: number) {
  return addDays(base, -days);
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

function formatDraftDateRangeLabel(startDate: Date | null, endDate: Date | null) {
  const startText = startDate ? formatDateInput(startDate) : '';
  const endText = endDate ? formatDateInput(endDate) : '';
  return formatDateRangeLabel(startText, endText);
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
  const isWeb = Platform.OS === 'web';
  const [isIosDateModalVisible, setIsIosDateModalVisible] = useState(false);
  const [iosDraftStartDate, setIosDraftStartDate] = useState<Date | null>(() => parseDateInput(startDate));
  const [iosDraftEndDate, setIosDraftEndDate] = useState<Date | null>(() => parseDateInput(endDate));
  const [webStartDateInput, setWebStartDateInput] = useState(startDate);
  const [webEndDateInput, setWebEndDateInput] = useState(endDate);
  const todayDate = useMemo(() => getTodayDate(), []);

  const applyDateField = useCallback(
    (field: DateFieldKey, date: Date) => {
      const next = buildNextDateRange({
        field,
        selectedDate: date,
        currentStartDate: parseDateInput(startDate),
        currentEndDate: parseDateInput(endDate),
        maxTripDays,
      });

      onChangeStartDate(next.startDate ? formatDateInput(next.startDate) : '');
      onChangeEndDate(next.endDate ? formatDateInput(next.endDate) : '');
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

          const next = buildNextDateRange({
            field,
            selectedDate,
            currentStartDate: resolvedStartDate,
            currentEndDate: resolvedEndDate,
            maxTripDays,
          });
          onChangeStartDate(next.startDate ? formatDateInput(next.startDate) : '');
          onChangeEndDate(next.endDate ? formatDateInput(next.endDate) : '');

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
    [endDate, maxTripDays, onChangeEndDate, onChangeStartDate, startDate]
  );

  const openSchedulePicker = useCallback(() => {
    if (disabled) {
      return;
    }

    if (Platform.OS === 'android') {
      openAndroidDatePicker('startDate');
      return;
    }

    setIosDraftStartDate(parseDateInput(startDate));
    setIosDraftEndDate(parseDateInput(endDate));
    setIsIosDateModalVisible(true);
  }, [disabled, openAndroidDatePicker, startDate, endDate]);

  useEffect(() => {
    if (!isWeb) {
      return;
    }
    setWebStartDateInput(startDate);
    setWebEndDateInput(endDate);
  }, [endDate, isWeb, startDate]);

  const iosStartPickerValue = useMemo(() => iosDraftStartDate ?? todayDate, [iosDraftStartDate, todayDate]);
  const iosEndPickerValue = useMemo(() => iosDraftEndDate ?? iosDraftStartDate ?? todayDate, [iosDraftEndDate, iosDraftStartDate, todayDate]);
  const iosEndPickerMinimumDate = useMemo(() => iosDraftStartDate ?? undefined, [iosDraftStartDate]);
  const iosEndPickerMaximumDate = useMemo(() => {
    if (typeof maxTripDays === 'number' && maxTripDays > 0 && iosDraftStartDate) {
      return addDays(iosDraftStartDate, maxTripDays - 1);
    }

    return undefined;
  }, [iosDraftStartDate, maxTripDays]);

  const scheduleLabel = useMemo(() => {
    if (startDate && endDate) {
      return `${formatDateDisplay(startDate)} 〜 ${formatDateDisplay(endDate)}`;
    }
    if (startDate) {
      return `${formatDateDisplay(startDate)} 〜 終了日`;
    }
    return '開始日〜終了日';
  }, [endDate, startDate]);

  const iosDraftScheduleLabel = useMemo(() => {
    return formatDraftDateRangeLabel(iosDraftStartDate, iosDraftEndDate);
  }, [iosDraftEndDate, iosDraftStartDate]);
  const nonAndroidPickerDisplay = Platform.OS === 'ios' ? 'spinner' : 'default';

  const hasSelectedDates = Boolean(startDate || endDate);
  const iosDraftStartLabel = iosDraftStartDate ? formatDateDisplay(formatDateInput(iosDraftStartDate)) : '開始日を選択';
  const iosDraftEndLabel = iosDraftEndDate ? formatDateDisplay(formatDateInput(iosDraftEndDate)) : '終了日を選択';

  const handleIosFieldChange = useCallback(
    (field: DateFieldKey) => (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (event.type === 'dismissed' || !selectedDate) {
        return;
      }
      const next = buildNextDateRange({
        field,
        selectedDate,
        currentStartDate: iosDraftStartDate,
        currentEndDate: iosDraftEndDate,
        maxTripDays,
      });

      setIosDraftStartDate(next.startDate);
      setIosDraftEndDate(next.endDate);
    },
    [iosDraftEndDate, iosDraftStartDate, maxTripDays]
  );

  const handleResetDates = useCallback(() => {
    setIosDraftStartDate(null);
    setIosDraftEndDate(null);
    onChangeStartDate('');
    onChangeEndDate('');
  }, [onChangeEndDate, onChangeStartDate]);

  const handleConfirmIosDates = useCallback(() => {
    onChangeStartDate(iosDraftStartDate ? formatDateInput(iosDraftStartDate) : '');
    onChangeEndDate(iosDraftEndDate ? formatDateInput(iosDraftEndDate) : '');
    setIsIosDateModalVisible(false);
  }, [iosDraftEndDate, iosDraftStartDate, onChangeEndDate, onChangeStartDate]);

  const commitWebDates = useCallback(() => {
    const startText = webStartDateInput.trim();
    const endText = webEndDateInput.trim();
    const parsedStart = startText ? parseDateInput(startText) : null;
    const parsedEnd = endText ? parseDateInput(endText) : null;

    if (startText && !parsedStart) {
      Alert.alert('日程の形式エラー', '開始日は YYYY-MM-DD 形式で入力してください。');
      return;
    }
    if (endText && !parsedEnd) {
      Alert.alert('日程の形式エラー', '終了日は YYYY-MM-DD 形式で入力してください。');
      return;
    }

    if (!parsedStart && !parsedEnd) {
      onChangeStartDate('');
      onChangeEndDate('');
      return;
    }

    if (parsedStart && parsedEnd) {
      const next = buildNextDateRange({
        field: 'endDate',
        selectedDate: parsedEnd,
        currentStartDate: parsedStart,
        currentEndDate: parsedEnd,
        maxTripDays,
      });
      onChangeStartDate(next.startDate ? formatDateInput(next.startDate) : '');
      onChangeEndDate(next.endDate ? formatDateInput(next.endDate) : '');
      return;
    }

    if (parsedStart) {
      onChangeStartDate(formatDateInput(parsedStart));
      onChangeEndDate('');
      return;
    }

    onChangeStartDate(formatDateInput(parsedEnd!));
    onChangeEndDate(formatDateInput(parsedEnd!));
  }, [maxTripDays, onChangeEndDate, onChangeStartDate, webEndDateInput, webStartDateInput]);

  if (isWeb) {
    return (
      <View style={style}>
        <FieldLabel label={label} required={required} iconName={iconName} />
        <View style={styles.webDateRow}>
          <TextInput
            value={webStartDateInput}
            onChangeText={setWebStartDateInput}
            onBlur={commitWebDates}
            placeholder="開始日 YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
            style={styles.webDateInput}
            autoCapitalize="none"
          />
          <TextInput
            value={webEndDateInput}
            onChangeText={setWebEndDateInput}
            onBlur={commitWebDates}
            placeholder="終了日 YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
            style={styles.webDateInput}
            autoCapitalize="none"
          />
          <Pressable
            style={[styles.scheduleResetButton, !hasSelectedDates ? styles.scheduleResetButtonDisabled : null]}
            onPress={handleResetDates}
            disabled={!hasSelectedDates}
          >
            <MaterialIcons name="close" size={20} color={hasSelectedDates ? '#64748B' : '#CBD5E1'} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={style}>
      <FieldLabel label={label} required={required} iconName={iconName} />
      <View style={styles.scheduleRow}>
        <Pressable
          style={[styles.scheduleInput, disabled ? styles.scheduleInputDisabled : null]}
          onPress={openSchedulePicker}
          disabled={disabled}
        >
          <View style={styles.scheduleInputBody}>
            <View style={styles.scheduleTextWrap}>
              <Text
                style={[
                  styles.scheduleValueText,
                  disabled ? styles.scheduleValueTextDisabled : null,
                  !(startDate || endDate) ? styles.schedulePlaceholderText : null,
                ]}
              >
                {scheduleLabel}
              </Text>
            </View>
          </View>
          <MaterialIcons name={disabled ? 'lock' : 'chevron-right'} size={20} color="#94A3B8" />
        </Pressable>
        <Pressable
          style={[
            styles.scheduleResetButton,
            !hasSelectedDates || disabled ? styles.scheduleResetButtonDisabled : null,
          ]}
          onPress={handleResetDates}
          disabled={!hasSelectedDates || disabled}
        >
          <MaterialIcons
            name="close"
            size={20}
            color={hasSelectedDates && !disabled ? '#64748B' : '#CBD5E1'}
          />
        </Pressable>
      </View>

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
            </View>

            <View style={styles.datePreviewCard}>
              <Text style={styles.datePreviewText}>{iosDraftScheduleLabel}</Text>
            </View>

            <View style={styles.iosDateFieldList}>
              <View style={styles.iosDateFieldRow}>
                <View style={styles.iosDateFieldTextWrap}>
                  <Text style={styles.iosDateFieldLabel}>開始日</Text>
                  <Text style={[styles.iosDateFieldValue, !iosDraftStartDate ? styles.schedulePlaceholderText : null]}>
                    {iosDraftStartLabel}
                  </Text>
                </View>
                <DateTimePicker
                  mode="date"
                  display={nonAndroidPickerDisplay}
                  themeVariant="light"
                  value={iosStartPickerValue}
                  onChange={handleIosFieldChange('startDate')}
                />
              </View>
              <View style={styles.iosDateFieldRow}>
                <View style={styles.iosDateFieldTextWrap}>
                  <Text style={styles.iosDateFieldLabel}>終了日</Text>
                  <Text style={[styles.iosDateFieldValue, !iosDraftEndDate ? styles.schedulePlaceholderText : null]}>
                    {iosDraftEndLabel}
                  </Text>
                </View>
                <DateTimePicker
                  mode="date"
                  display={nonAndroidPickerDisplay}
                  themeVariant="light"
                  value={iosEndPickerValue}
                  minimumDate={iosEndPickerMinimumDate}
                  maximumDate={iosEndPickerMaximumDate}
                  onChange={handleIosFieldChange('endDate')}
                />
              </View>
            </View>

            <View style={styles.dateModalFooter}>
              <Pressable style={[styles.dateModalActionButton, styles.dateModalConfirmButton]} onPress={handleConfirmIosDates}>
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
    flex: 1,
  },
  scheduleInputDisabled: {
    backgroundColor: '#F8FAFC',
  },
  scheduleRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
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
  scheduleValueTextDisabled: {
    color: '#64748B',
  },
  schedulePlaceholderText: {
    color: '#94A3B8',
  },
  scheduleResetButton: {
    width: 50,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleResetButtonDisabled: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  webDateRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webDateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
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
    justifyContent: 'center',
    marginBottom: 14,
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
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
  iosDateFieldList: {
    gap: 10,
  },
  iosDateFieldRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iosDateFieldTextWrap: {
    gap: 4,
    flex: 1,
  },
  iosDateFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  iosDateFieldValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
  dateModalFooter: {
    marginTop: 16,
  },
  dateModalActionButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
