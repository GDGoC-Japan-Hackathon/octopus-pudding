import { FlatList, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { ListButton } from '@/components/travel/ListButton';
import { travelStyles } from '@/components/travel/styles';
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
