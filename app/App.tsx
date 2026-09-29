import { NavigationContainer } from '@react-navigation/native';
import { CareCircleProvider } from './src/contexts/CareCircleContext';
import RootNavigator from './src/navigation';

export default function App() {
  return (
    <CareCircleProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </CareCircleProvider>
  );
}