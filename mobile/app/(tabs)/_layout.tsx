import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F97316',
        tabBarInactiveTintColor: '#64748B',
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 64,
          paddingTop: 6,
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={22} color={color} />,
          tabBarLabelStyle: { fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: '作成済みの計画',
          tabBarIcon: ({ color }) => <MaterialIcons name="bookmark" size={22} color={color} />,
          tabBarLabelStyle: { fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '作成',
          tabBarIcon: ({ color }) => <MaterialIcons name="add-box" size={24} color={color} />,
          tabBarLabelStyle: { fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="recommend"
        options={{
          title: 'おすすめ',
          tabBarIcon: ({ color }) => <MaterialIcons name="explore" size={22} color={color} />,
          tabBarLabelStyle: { fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: 'マイページ',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={22} color={color} />,
          tabBarLabelStyle: { fontSize: 11 },
        }}
      />
    </Tabs>
  );
}
