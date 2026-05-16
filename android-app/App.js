import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import Storage from './src/services/storage';
import { setUnauthorizedHandler } from './src/services/api';

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const navigationRef = useRef(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const serverUrl = await Storage.getServerUrl();
        if (!serverUrl) { setInitialRoute('Setup'); return; }
        const { accessToken } = await Storage.getTokens();
        setInitialRoute(accessToken ? 'Main' : 'Auth');
      } catch {
        setInitialRoute('Setup');
      }
    }
    bootstrap();

    setUnauthorizedHandler(async () => {
      await Storage.clear();
      if (navigationRef.current?.isReady()) {
        navigationRef.current.reset({ index: 0, routes: [{ name: 'Auth' }] });
      }
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={s.splash}>
        <ActivityIndicator size="large" color="#c9a84c" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator initialRoute={initialRoute} navigationRef={navigationRef} />
    </>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#1a2744', alignItems: 'center', justifyContent: 'center' },
});
