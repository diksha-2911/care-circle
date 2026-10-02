import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useCareCircle } from '../contexts/CareCircleContext';
import { createCareCircle, joinCareCircleWithCode } from '../services/circle';

export default function CircleSetupScreen() {
  const { userId, refreshMemberships } = useCareCircle();
  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!userId || !circleName.trim()) return;
    setBusy(true);
    try {
      await createCareCircle(userId, circleName.trim());
      await refreshMemberships();
      // CareCircleProvider will pick the new circle up automatically and
      // the navigator (see navigation/index.tsx) will move past this
      // screen once activeCircle is set.
    } catch (err: any) {
      Alert.alert('Could not create circle', err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!userId || !inviteCode.trim()) return;

    setBusy(true);

    try {
      await joinCareCircleWithCode(
        userId,
        inviteCode.trim().toUpperCase()
      );

      await refreshMemberships();

      Alert.alert(
        'Circle joined',
        'You have successfully joined the care circle.'
      );
    } catch (err: any) {
      Alert.alert(
        'Could not join circle',
        err.message ?? String(err)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Care Circle</Text>
      <Text style={styles.subtitle}>
        You're not part of a care circle yet. Create one as a patient, or
        join one you've been invited to.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create a Care Circle</Text>
        <Text style={styles.hint}>You'll be the patient in this circle.</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Meera's Care Circle"
          value={circleName}
          onChangeText={setCircleName}
        />
        <Button title="Create Circle" onPress={handleCreate} disabled={busy || !circleName.trim()} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Join with an invite code</Text>
        <Text style={styles.hint}>
          Ask a family member for their circle's invite code.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. FAM-7XQ2"
          autoCapitalize="characters"
          value={inviteCode}
          onChangeText={setInviteCode}
        />
        <Button title="Join Circle" onPress={handleJoin} disabled={busy || !inviteCode.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', color: '#555', marginBottom: 32 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  hint: { color: '#777', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
});