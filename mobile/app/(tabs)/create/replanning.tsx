import { Pressable, Text, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { travelStyles } from '@/components/travel/styles';
import { weatherMock } from '@/data/travel';

const troubleOptions = [
  '遅延・欠航が起きた',
  '予定時間より行動が遅い',
  '宿泊時間が変更になった',
  '移動手段を乗り換えたい',
];

export default function ReplanningScreen() {
  return (
    <View style={travelStyles.screen}>
      <AppHeader title="再計画" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>トラブル時に再計画</Text>
          <Text style={travelStyles.sectionBody}>該当する原因を選ぶと、修正案を作成します。</Text>
        </View>

        {troubleOptions.map((text) => (
          <Pressable key={text} style={travelStyles.button}>
            <Text style={travelStyles.buttonTitle}>{text}</Text>
            <Text style={travelStyles.buttonDescription}>候補を再生成して、時間を再計算します</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
