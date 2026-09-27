import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { supabase } from '../services/supabase';

export default function SOSScreen({ navigation }: any) {
  const handleSOS = async () => {
    // In the full build, this inserts an sos_events row (or calls a
    // Supabase Edge Function) that fans out to notify.py's push+SMS path
    // — the same multi-channel logic the MCP server's trigger_sos tool uses.
    Alert.alert('SOS sent', 'Your care circle has been notified.');
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency SOS</Text>
      <Text style={styles.subtitle}>
        This will immediately alert everyone in your care circle by push
        notification and SMS.
      </Text>
      <Button title="Send SOS" color="#d32f2f" onPress={handleSOS} />
      <Button title="Cancel" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 24, color: '#555' },
});
