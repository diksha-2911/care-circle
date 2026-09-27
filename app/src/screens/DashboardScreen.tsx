import { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet } from 'react-native';
import { supabase } from '../services/supabase';

interface Prescription {
  id: string;
  drug_name: string;
  quantity_remaining: number;
}

export default function DashboardScreen({ navigation }: any) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('prescriptions')
        .select('id, drug_name, quantity_remaining');
      setPrescriptions(data ?? []);
    };
    load();

    // Realtime: reflect doses logged via Alexa+ (or another family
    // member's app) without needing to refresh.
    const channel = supabase
      .channel('dose_logs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_logs' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <View style={styles.container}>
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
      />
      <View style={styles.buttonRow}>
        <Button title="Prescriptions" onPress={() => navigation.navigate('Prescriptions')} />
        <Button title="Appointments" onPress={() => navigation.navigate('Appointments')} />
      </View>
      <Button title="SOS" color="#d32f2f" onPress={() => navigation.navigate('SOS')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
});
