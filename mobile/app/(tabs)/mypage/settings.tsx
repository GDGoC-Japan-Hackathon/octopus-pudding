import { FlatList, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { ListButton } from '@/components/travel/ListButton';
import { travelStyles } from '@/components/travel/styles';
import { settingsMock, weatherMock } from '@/data/travel';

export default function SettingsListScreen() {
  return (
    <View style={travelStyles.screen}>
      <AppHeader title="設定" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
      <View style={travelStyles.container}>
        <FlatList
          data={settingsMock}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListButton
              title={item.title}
              description={item.detail}
              href={{
                pathname: '/mypage/detail',
                params: { section: 'settings', id: item.id },
              }}
            />
          )}
          ItemSeparatorComponent={() => null}
        />
      </View>
    </View>
  );
}
