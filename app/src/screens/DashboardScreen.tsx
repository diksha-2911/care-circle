import { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet } from 'react-native';
import { supabase } from '../services/supabase';
import { useCareCircle } from '../contexts/CareCircleContext';

interface Prescription {
  id: string;
  drug_name: string;
  quantity_remaining: number;
}

export default function DashboardScreen({ navigation }: any) {
  const { activeCircle, memberships, setActiveCircleId } = useCareCircle();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  useEffect(() => {
    if (!activeCircle) return;

    const load = async () => {
      const { data } = await supabase
        .from('prescriptions')
        .select('id, drug_name, quantity_remaining')
        .eq('circle_id', activeCircle.circle_id);
      setPrescriptions(data ?? []);
    };
    load();

    const channel = supabase
      .channel(`dose_logs_${activeCircle.circle_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_logs' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCircle?.circle_id]);

  if (!activeCircle) return null; // RootNavigator won't render this screen without one

  return (
    <View style={styles.container}>
      <Text style={styles.circleName}>{activeCircle.circle_name}</Text>
      <Text style={styles.role}>You are a {activeCircle.role} in this circle</Text>

      {memberships.length > 1 && (
        <View style={styles.switcher}>
          {memberships.map((m) => (
            <Button
              key={m.circle_id}
              title={m.circle_name}
              onPress={() => setActiveCircleId(m.circle_id)}
              color={m.circle_id === activeCircle.circle_id ? '#1976d2' : '#999'}
            />
          ))}
        </View>
      )}

      <Text style={styles.title}>Today's Medications</Text>
      <FlatList
        data={prescriptions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.drug_name}</Text>
            <Text>{item.quantity_remaining} left</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No medications yet.</Text>}
      />

      <View style={styles.buttonRow}>
        <Button title="Prescriptions" onPress={() => navigation.navigate('Prescriptions')} />
        <Button title="Appointments" onPress={() => navigation.navigate('Appointments')} />
      </View>

      {activeCircle.can_trigger_sos && (
        <Button title="SOS" color="#d32f2f" onPress={() => navigation.navigate('SOS')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  circleName: { fontSize: 24, fontWeight: '700' },
  role: { color: '#777', marginBottom: 16, textTransform: 'capitalize' },
  switcher: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  empty: { color: '#999', fontStyle: 'italic', paddingVertical: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
});
