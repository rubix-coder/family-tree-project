import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import SetupScreen from '../screens/SetupScreen';
import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TreesScreen from '../screens/TreesScreen';
import TreeDetailScreen from '../screens/TreeDetailScreen';
import MemberDetailScreen from '../screens/MemberDetailScreen';
import AddMemberScreen from '../screens/AddMemberScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const NAV = '#1a2744';
const GOLD = '#c9a84c';

function TabIcon({ name, focused }) {
  const icons = { Home: '🏠', Trees: '🌳', Notifications: '🔔', Profile: '👤' };
  return <Text style={{ fontSize: focused ? 22 : 18 }}>{icons[name]}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e2e8f0', height: 64, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Trees" component={TreesScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ initialRoute }) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute || 'Setup'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="TreeDetail" component={TreeDetailScreen}
          options={{ headerShown: true, headerTitle: '', headerStyle: { backgroundColor: NAV }, headerTintColor: '#fff' }} />
        <Stack.Screen name="MemberDetail" component={MemberDetailScreen}
          options={{ headerShown: true, headerTitle: 'Member', headerStyle: { backgroundColor: NAV }, headerTintColor: '#fff', presentation: 'modal' }} />
        <Stack.Screen name="AddMember" component={AddMemberScreen}
          options={{ headerShown: true, headerTitle: 'Add Member', headerStyle: { backgroundColor: NAV }, headerTintColor: '#fff', presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
