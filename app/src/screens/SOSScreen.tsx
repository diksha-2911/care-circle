import { useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, Text, View } from 'react-native';
import { useCareCircle } from '../contexts/CareCircleContext';
import { triggerSos, SosResult } from '../services/sos';

export default function SOSScreen({ navigation }: any) {
  const { activeCircle } = useCareCircle();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SosResult | null>(null);

  const handleSOS = () => {
    if (!activeCircle?.circle_id) {
      Alert.alert('No care circle', 'Join or create a care circle before sending SOS.');
      return;
    }
    if (!activeCircle.can_trigger_sos) {
      Alert.alert('Not permitted', 'Your account cannot trigger SOS in this circle.');
      return;
    }
    Alert.alert('Send emergency SOS?', 'This will alert eligible members of your care circle.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send SOS', style: 'destructive', onPress: () => { void send(); } },
    ]);
  };

  const send = async () => {
    if (!activeCircle) return;
    setSending(true);
    setResult(null);
    try {
      // Reuse this key only for a retry of this same user action.
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await triggerSos(activeCircle.circle_id, idempotencyKey);
      setResult(response);
    } catch (error) {
      Alert.alert('SOS request failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency SOS</Text>
      <Text style={styles.subtitle}>Send an emergency alert to members of {activeCircle?.circle_name ?? 'your care circle'} who are configured to receive SOS alerts.</Text>
      {!activeCircle?.can_trigger_sos && <Text style={styles.warning}>Your current account cannot trigger SOS in this circle.</Text>}
      {sending ? <ActivityIndicator size="large" /> : <Button title="Send SOS" color="#d32f2f" onPress={handleSOS} disabled={!activeCircle?.can_trigger_sos} />}
      {result && <View style={styles.result}>
        <Text style={styles.resultTitle}>SOS request recorded</Text>
        <Text>Event: {result.eventId}</Text>
        <Text>Status: {result.status}</Text>
        <Text>{result.message}</Text>
        <Text style={styles.note}>Check delivery status before assuming every recipient received the alert. If there is immediate danger, contact local emergency services directly.</Text>
      </View>}
      <View style={styles.cancel}><Button title="Close" onPress={() => navigation.goBack()} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 12, color: '#555', lineHeight: 21 },
  warning: { color: '#b91c1c', textAlign: 'center' },
  result: { padding: 14, borderRadius: 10, backgroundColor: '#f3f4f6', gap: 6 },
  resultTitle: { fontWeight: '700', fontSize: 16 },
  note: { color: '#555', fontSize: 12, marginTop: 6 },
  cancel: { marginTop: 8 },
});
