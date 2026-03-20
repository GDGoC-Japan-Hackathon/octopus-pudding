import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { weatherMock } from '@/data/travel';
import {
  createIncident,
  createReplan,
  listIncidents,
} from '@/features/trips/api/replanning';
import { type IncidentResponse } from '@/features/trips/types/replanning';
import { getReplanningErrorMessage } from '@/features/trips/utils/replanning';

const troubleOptions = [
  { label: '遅延・欠航が起きた', incidentType: 'delay_flight' },
  { label: '予定時間より行動が遅い', incidentType: 'running_late' },
  { label: '宿泊時間が変更になった', incidentType: 'lodging_changed' },
  { label: '移動手段を乗り換えたい', incidentType: 'transport_changed' },
  { label: '悪天候になった', incidentType: 'bad_weather' },
] as const;

function parseTripId(rawTripId?: string | string[]): number | null {
  const value = Array.isArray(rawTripId) ? rawTripId[0] : rawTripId;
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default function ReplanningScreen() {
  const router = useRouter();
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = useMemo(() => parseTripId(rawTripId), [rawTripId]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastIncident, setLastIncident] = useState<IncidentResponse | null>(null);

  const handleSelectTrouble = async (option: (typeof troubleOptions)[number]) => {
    if (!tripId) {
      return;
    }

    try {
      setIsSubmitting(true);
      const incident = await createIncident(tripId, {
        incident_type: option.incidentType,
        description: option.label,
        occurred_at: new Date().toISOString(),
      });
      setLastIncident(incident);

      const replan = await createReplan(tripId, {
        incident_id: incident.id,
        reason: option.label,
        items: [],
      });

      await listIncidents(tripId);
      Alert.alert('保存完了', 'トラブル情報と再計画セッションを保存しました。');
      router.replace({
        pathname: '/plans/detail',
        params: { id: String(tripId), replanSessionId: String(replan.session.id) },
      });
    } catch (error) {
      Alert.alert('保存失敗', getReplanningErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={travelStyles.screen}>
      <AppHeader
        title="再計画"
        weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
        leftSlot={<BackButton onPress={() => router.replace('/(tabs)/create')} />}
      />

      <View style={travelStyles.container}>
        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>トラブル時に再計画</Text>
          <Text style={travelStyles.sectionBody}>該当する原因を選ぶと、修正案を作成します。</Text>
          {!tripId ? (
            <Text style={[travelStyles.sectionBody, { color: '#DC2626' }]}>
              対象プランが未選択です。作成済みプラン詳細から再計画を開いてください。
            </Text>
          ) : null}
          {lastIncident ? (
            <Text style={travelStyles.sectionBody}>
              直近保存: #{lastIncident.id} / {lastIncident.description}
            </Text>
          ) : null}
        </View>

        {troubleOptions.map((option) => (
          <Pressable
            key={option.incidentType}
            style={[travelStyles.button, (!tripId || isSubmitting) ? { opacity: 0.5 } : null]}
            onPress={() => handleSelectTrouble(option)}
            disabled={!tripId || isSubmitting}
          >
            <Text style={travelStyles.buttonTitle}>{option.label}</Text>
            <Text style={travelStyles.buttonDescription}>候補を再生成して、時間を再計算します</Text>
            {isSubmitting ? <ActivityIndicator color="#F97316" /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
