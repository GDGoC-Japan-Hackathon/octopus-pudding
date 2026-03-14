import { FlatList, Pressable, Text, View, Alert } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { travelStyles } from '@/components/travel/styles';
import { friendsMock, profileMock, weatherMock } from '@/data/travel';

export default function MyPageScreen() {
  return (
```
    <View style={travelStyles.screen}>
      <AppHeader title="マイページ" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>プロフィール</Text>
          <Text style={travelStyles.sectionBody}>ユーザー: {profileMock.name}</Text>
          <Text style={travelStyles.sectionBody}>保有ポイント: {profileMock.points.toLocaleString()} pt</Text>
          <Text style={travelStyles.sectionBody}>最寄り駅: {profileMock.nearestStation}</Text>
        </View>

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.sectionTitleText}>友達</Text>
          <View style={travelStyles.rowWrap}>
            <Text style={travelStyles.sectionBody}>合計: {friendsMock.length}人</Text>
            <Pressable
              onPress={() => {
                Alert.alert('未実装', '友達追加機能は準備中です');
              }}
              style={travelStyles.pillButton}
            >
              <Text style={travelStyles.pillText}>友達を追加</Text>
            </Pressable>
          </View>

          <FlatList
            data={friendsMock}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[travelStyles.card, { marginTop: 8 }]}>
                <Text style={travelStyles.buttonTitle}>{item.name}</Text>
                <Text style={travelStyles.sectionBody}>{item.role}</Text>
                <Text style={travelStyles.subheading}>登録: {item.addedAt}</Text>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>

        <Pressable style={travelStyles.primaryButton}>
          <Text style={travelStyles.primaryButtonText}>プロフィールを編集</Text>
        </Pressable>
      </View>
    </View>
  );
}
