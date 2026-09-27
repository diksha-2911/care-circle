import { View, Text, StyleSheet } from 'react-native';

// TODO: prescription list + "add via photo" flow (Textract OCR call),
// with a manual confirm/edit step before saving to Supabase.
export default function PrescriptionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prescriptions</Text>
      <Text>TODO: list + photo-upload OCR flow</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
});
