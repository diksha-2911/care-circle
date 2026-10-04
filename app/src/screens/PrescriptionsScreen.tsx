import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Button, FlatList, StyleSheet, Alert} from 'react-native';
import { scheduleTestNotification, requestNotificationPermissions, scheduleMedicationAlarms } from '../services/notifications';

import { supabase } from '../services/supabase';
import { useCareCircle } from '../contexts/CareCircleContext';

interface Prescription {
  id: string;
  drug_name: string;
  dosage: string;
  frequency_per_day: number;
  alarm_times: string[];
  quantity_remaining: number;
}

export default function PrescriptionsScreen() {
  const { activeCircle } = useCareCircle();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [alarmTimes, setAlarmTimes] = useState<string[]>([]);
  const [quantity, setQuantity] = useState('');

  const [saving, setSaving] = useState(false);

  const loadPrescriptions = async () => {
    if (!activeCircle) return;

    const { data, error } = await supabase
      .from('prescriptions')
      .select(`
        id,
        drug_name,
        dosage,
        frequency_per_day,
        alarm_times,
        quantity_remaining
      `)
      .eq('circle_id', activeCircle.circle_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading prescriptions:', error);
      return;
    }

    setPrescriptions(data ?? []);
  };

  useEffect(() => {
    loadPrescriptions();
  }, [activeCircle?.circle_id]);

  // Keep alarm inputs synced with frequency
  useEffect(() => {
    const frequencyPerDay = Number(frequency);

    if (
      !Number.isInteger(frequencyPerDay) ||
      frequencyPerDay <= 0
    ) {
      setAlarmTimes([]);
      return;
    }

    setAlarmTimes((current) => {
      const updated = [...current];

      if (updated.length < frequencyPerDay) {
        while (updated.length < frequencyPerDay) {
          updated.push('');
        }
      } else if (updated.length > frequencyPerDay) {
        updated.splice(frequencyPerDay);
      }

      return updated;
    });
  }, [frequency]);

  const validateTime = (time: string) => {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return false;
    }

    const [hours, minutes] = time.split(':').map(Number);

    return (
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59
    );
  };

  const handleSave = async () => {
    if (!activeCircle) return;

    if (
      !drugName.trim() ||
      !dosage.trim() ||
      !frequency.trim() ||
      !quantity.trim()
    ) {
      Alert.alert(
        'Missing information',
        'Please fill in all fields.'
      );
      return;
    }

    const frequencyPerDay = Number(frequency);
    const quantityRemaining = Number(quantity);

    if (
      !Number.isInteger(frequencyPerDay) ||
      frequencyPerDay <= 0
    ) {
      Alert.alert(
        'Invalid frequency',
        'Frequency must be a positive whole number.'
      );
      return;
    }

    if (
      !Number.isInteger(quantityRemaining) ||
      quantityRemaining < 0
    ) {
      Alert.alert(
        'Invalid quantity',
        'Quantity must be a whole number.'
      );
      return;
    }

    if (alarmTimes.length !== frequencyPerDay) {
      Alert.alert(
        'Alarm times',
        `Please enter exactly ${frequencyPerDay} alarm time${
          frequencyPerDay === 1 ? '' : 's'
        }.`
      );
      return;
    }

    if (alarmTimes.some((time) => !time.trim())) {
      Alert.alert(
        'Missing alarm time',
        'Please enter all alarm times.'
      );
      return;
    }

    if (alarmTimes.some((time) => !validateTime(time.trim()))) {
      Alert.alert(
        'Invalid time',
        'Please enter all times in HH:MM format, for example 08:00.'
      );
      return;
    }

    const normalizedAlarmTimes = alarmTimes.map((time) =>
      time.trim()
    );

    const uniqueTimes = new Set(normalizedAlarmTimes);

    if (uniqueTimes.size !== normalizedAlarmTimes.length) {
      Alert.alert(
        'Duplicate time',
        'Please use different alarm times.'
      );
      return;
    }

    try {
        setSaving(true);

        const granted = await requestNotificationPermissions();
        if (!granted) {
          Alert.alert('Permission needed', 'Please allow notifications so medication reminders can work.');
        }

        const { data: inserted, error } = await supabase
          .from('prescriptions')
          .insert({
            circle_id: activeCircle.circle_id,
            drug_name: drugName.trim(),
            dosage: dosage.trim(),
            frequency_per_day: frequencyPerDay,
            alarm_times: normalizedAlarmTimes,
            quantity_remaining: quantityRemaining,
          })
          .select()
          .single();

        if (error) throw error;

        // NEW: schedule the actual device alarms, then save their IDs
        const notificationIds = await scheduleMedicationAlarms(
          drugName.trim(),
          dosage.trim(),
          normalizedAlarmTimes
        );

        await supabase
          .from('prescriptions')
          .update({ notification_ids: notificationIds })
          .eq('id', inserted.id);

        setDrugName('');
        setDosage('');
        setFrequency('');
        setAlarmTimes([]);
        setQuantity('');

        await loadPrescriptions();

        Alert.alert('Saved', 'Prescription added successfully.');
    } catch (error: any) {
        console.error('Error saving prescription:', error);
        Alert.alert('Could not save prescription', error?.message ?? 'Something went wrong.');
    } finally {
        setSaving(false);
    }
  };

  if (!activeCircle) {
    return null;
  }

  const handleTestAlarm = async () => {
    try {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow notifications to test this.');
        return;
      }

      await scheduleTestNotification();

      Alert.alert('Alarm scheduled', 'You should receive a medicine reminder in 1 minute.');
    } catch (error: any) {
      console.error('Notification error:', error);
      Alert.alert('Notification error', error?.message ?? 'Could not schedule notification.');
    }
  };

  const frequencyPerDay = Number(frequency) || 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prescriptions</Text>

      <Text style={styles.sectionTitle}>
        Add Medicine
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Medicine name"
        value={drugName}
        onChangeText={setDrugName}
      />

      <TextInput
        style={styles.input}
        placeholder="Dosage (e.g. 500mg)"
        value={dosage}
        onChangeText={setDosage}
      />

      <TextInput
        style={styles.input}
        placeholder="Times per day (e.g. 2)"
        keyboardType="number-pad"
        value={frequency}
        onChangeText={setFrequency}
      />

      <TextInput
        style={styles.input}
        placeholder="Quantity remaining"
        keyboardType="number-pad"
        value={quantity}
        onChangeText={setQuantity}
      />

      {frequencyPerDay > 0 && (
        <>
          <Text style={styles.label}>
            Alarm times
          </Text>

          {Array.from({ length: frequencyPerDay }).map(
            (_, index) => (
              <TextInput
                key={index}
                style={styles.input}
                placeholder={`Time ${index + 1} (HH:MM)`}
                value={alarmTimes[index] ?? ''}
                onChangeText={(value) => {
                  const updated = [...alarmTimes];
                  updated[index] = value;
                  setAlarmTimes(updated);
                }}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            )
          )}
        </>
      )}

      <Button
        title={saving ? 'Saving...' : 'Save Medicine'}
        onPress={handleSave}
        disabled={saving}
      />

      <Button
        title="Test Alarm in 1 Minute"
        onPress={handleTestAlarm}
      />
      <Text style={styles.sectionTitle}>
        Your Medicines
      </Text>

      <FlatList
        data={prescriptions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.prescriptionCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.drugName}>
                {item.drug_name}
              </Text>

              <Text style={styles.quantity}>
                {item.quantity_remaining} left
              </Text>
            </View>

            <Text style={styles.dosage}>
              {item.dosage}
            </Text>

            <Text style={styles.frequency}>
              {item.frequency_per_day} time
              {item.frequency_per_day === 1
                ? ''
                : 's'} per day
            </Text>

            <Text style={styles.alarmLabel}>
              Alarm times
            </Text>

            <Text style={styles.alarmTimes}>
              {item.alarm_times?.join('  •  ') ||
                'No times set'}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No prescriptions added yet.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },

  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },

  prescriptionCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  drugName: {
    fontSize: 18,
    fontWeight: '600',
  },

  dosage: {
    marginTop: 4,
    color: '#555',
  },

  quantity: {
    color: '#777',
  },

  frequency: {
    marginTop: 8,
    color: '#555',
  },

  alarmLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: '500',
  },

  alarmTimes: {
    color: '#444',
  },

  empty: {
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});