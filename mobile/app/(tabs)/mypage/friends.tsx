import { FlatList, View } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import { ListButton } from '@/features/travel/components/ListButton';
import { travelStyles } from '@/features/travel/styles';
import { friendsMock, weatherMock } from '@/data/travel';

export default function FriendsListScreen() {
  return (
    <View style={travelStyles.screen}>
      <AppHeader title="フレンド一覧" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
      <View style={travelStyles.container}>
        <FlatList
          data={friendsMock}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListButton
              title={item.name}
              description={`ID: ${item.id} ／ ${item.role}`}
              href={{
                pathname: '/mypage/detail',
                params: { section: 'friends', id: item.id },
              }}
            />
          )}
          ItemSeparatorComponent={() => null}
        />
      </View>
    </View>
  );
}
