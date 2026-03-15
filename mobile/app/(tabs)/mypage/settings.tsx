import { FlatList, View } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import { ListButton } from '@/features/travel/components/ListButton';
import { travelStyles } from '@/features/travel/styles';
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
