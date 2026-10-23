import { NavigationContainer } from '@react-navigation/native';
import { CareCircleProvider } from './src/contexts/CareCircleContext';
import RootNavigator from './src/navigation';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { initNotifications } from './src/services/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  useEffect(() => {
    initNotifications().catch((e) =>
      console.warn('Notification init failed:', e)
    );
  }, []);

  return (
    <CareCircleProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </CareCircleProvider>
  );
}