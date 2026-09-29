import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCareCircle } from '../contexts/CareCircleContext';
import LoginScreen from '../screens/LoginScreen';
import CircleSetupScreen from '../screens/CircleSetupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PrescriptionsScreen from '../screens/PrescriptionsScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import SOSScreen from '../screens/SOSScreen';

export type RootStackParamList = {
  Login: undefined;
  CircleSetup: undefined;
  Dashboard: undefined;
  Prescriptions: undefined;
  Appointments: undefined;
  SOS: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Three states, three navigators. Which one renders is driven entirely by
 * CareCircleContext — screens never need to manually navigate on
 * login/logout/circle-creation, since a Supabase auth or membership
 * change re-renders this component automatically.
 */
export default function RootNavigator() {
  const { loading, session, activeCircle } = useCareCircle();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  }

  if (!activeCircle) {
    return (
      <Stack.Navigator>
        <Stack.Screen
          name="CircleSetup"
          component={CircleSetupScreen}
          options={{ title: 'Set Up Your Circle', headerBackVisible: false }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator initialRouteName="Dashboard">
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Prescriptions" component={PrescriptionsScreen} />
      <Stack.Screen name="Appointments" component={AppointmentsScreen} />
      <Stack.Screen name="SOS" component={SOSScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
