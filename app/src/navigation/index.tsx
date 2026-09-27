import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PrescriptionsScreen from '../screens/PrescriptionsScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import SOSScreen from '../screens/SOSScreen';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Prescriptions: undefined;
  Appointments: undefined;
  SOS: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Prescriptions" component={PrescriptionsScreen} />
      <Stack.Screen name="Appointments" component={AppointmentsScreen} />
      <Stack.Screen name="SOS" component={SOSScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
