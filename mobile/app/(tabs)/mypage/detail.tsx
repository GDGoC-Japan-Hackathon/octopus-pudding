import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { friendsMock, settingsMock, tripHistoryMock, weatherMock } from '@/data/travel';

type MyPageSection = 'friends' | 'history' | 'settings';

type FriendRouteParams = {
  section?: MyPageSection;
  id?: string;
};

export default function MyPageDetailScreen() {
  const { section, id } = useLocalSearchParams<FriendRouteParams>();

  const friend = friendsMock.find((item) => item.id === id);
  const history = tripHistoryMock.find((item) => item.id === id);
  const setting = settingsMock.find((item) => item.id === id);

  if (!section) {
    return (
      <View style={travelStyles.screen}>
        <AppHeader title="マイページ" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={travelStyles.container}>
          <Text style={travelStyles.heading}>項目を選択してください</Text>
        </View>
      </View>
    );
  }

  if (section === 'friends' && friend) {
    return (
      <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
        <AppHeader title="フレンド詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

        <View style={travelStyles.container}>
          <View style={travelStyles.detailSection}>
            <Text style={travelStyles.sectionTitleText}>フレンド情報</Text>
            <Text style={travelStyles.heading}>{friend.name}</Text>
            <Text style={travelStyles.sectionBody}>ID: {friend.id}</Text>
            <Text style={travelStyles.sectionBody}>役割: {friend.role}</Text>
            <Text style={travelStyles.sectionBody}>追加日: {friend.addedAt}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (section === 'history' && history) {
    return (
      <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
        <AppHeader title="旅行履歴詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

        <View style={travelStyles.container}>
          <View style={travelStyles.detailSection}>
            <Text style={travelStyles.sectionTitleText}>履歴情報</Text>
            <Text style={travelStyles.heading}>{history.title}</Text>
            <Text style={travelStyles.sectionBody}>旅行日: {history.date}</Text>
            <Text style={travelStyles.sectionBody}>内容: {history.detail}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (section === 'settings' && setting) {
    return (
      <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
        <AppHeader title="設定詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

        <View style={travelStyles.container}>
          <View style={travelStyles.detailSection}>
            <Text style={travelStyles.sectionTitleText}>設定項目</Text>
            <Text style={travelStyles.heading}>{setting.title}</Text>
            <Text style={travelStyles.sectionBody}>{setting.detail}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={travelStyles.screen}>
      <AppHeader title="詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
      <View style={travelStyles.container}>
        <Text style={travelStyles.heading}>対象が見つかりませんでした</Text>
      </View>
    </View>
  );
}
