import { View, Text, StyleSheet } from 'react-native';

// TODO: appointment calendar view + add/edit form.
export default function AppointmentsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Appointments</Text>
      <Text>TODO: calendar + add/edit form</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
});
