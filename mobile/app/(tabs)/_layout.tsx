import { MaterialIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#F97316',
          tabBarInactiveTintColor: '#64748B',
          tabBarButton: HapticTab,
          tabBarStyle: {
            height: 60 + insets.bottom,
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 6),
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            overflow: 'visible',
          },
        }}>
        <Tabs.Screen
          name="home"
          options={{
            title: 'ホーム',
            tabBarIcon: ({ color }) => <MaterialIcons name="home" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="plans"
          options={{
            title: 'マイプラン',
            tabBarIcon: ({ color }) => <MaterialIcons name="bookmark" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: '作成',
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <View style={styles.createButtonWrap}>
                <View style={styles.createButton}>
                  <View style={styles.createButtonContent}>
                    <MaterialIcons name="add" size={35} color="#FFFFFF" />
                    <Text style={styles.createButtonText}>作成</Text>
                  </View>
                </View>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="recommend"
          options={{
            title: 'おすすめ',
            tabBarIcon: ({ color }) => <MaterialIcons name="explore" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="mypage"
          options={{
            title: 'マイページ',
            tabBarIcon: ({ color }) => <MaterialIcons name="person" size={22} color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 0,
  },
  createItem: {
    alignItems: 'center',
  },
  createButtonWrap: {
    width: 63,
    height: 63,
    marginTop: -18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    width: 63,
    height: 63,
    borderRadius: 35,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F97316',
    elevation: 10,
  },
  createButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
