import { NavigationContainer } from '@react-navigation/native';
import { CareCircleProvider } from './src/contexts/CareCircleContext';
import RootNavigator from './src/navigation';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { ensureNotificationChannel } from './src/services/notifications';

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
    ensureNotificationChannel().catch((error) => {
      console.warn('Could not configure notification channel:', error);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      // Backend data includes IDs only. A future navigation/deep-link layer can
      // use these identifiers to open the related dose, prescription or circle.
      const data = response.notification.request.content.data;
      console.info('Care Circle notification opened.', {
        alertType: data.alertType,
        referenceId: data.referenceId,
        circleId: data.circleId,
      });
    });

    return () => responseListener.remove();
  }, []);

  return (
    <CareCircleProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </CareCircleProvider>
  );
}
