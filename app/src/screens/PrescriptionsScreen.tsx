import { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Alert, Pressable, KeyboardAvoidingView, Platform,} from 'react-native';

import {
  scheduleTestNotification,
  requestNotificationPermissions,
  scheduleMedicationAlarms,
} from '../services/notifications';

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

const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  background: '#F7FAFC',
  card: '#FFFFFF',
  text: '#172033',
  muted: '#64748B',
  placeholder: '#94A3B8',
  border: '#D9E2EC',
  softBlue: '#EFF6FF',
  danger: '#DC2626',
};

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
        Alert.alert(
          'Permission needed',
          'Please allow notifications so medication reminders can work.'
        );
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
      Alert.alert(
        'Could not save prescription',
        error?.message ?? 'Something went wrong.'
      );
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
        Alert.alert(
          'Permission needed',
          'Please allow notifications to test this.'
        );
        return;
      }

      await scheduleTestNotification();

      Alert.alert(
        'Alarm scheduled',
        'You should receive a medicine reminder in 1 minute.'
      );
    } catch (error: any) {
      console.error('Notification error:', error);
      Alert.alert(
        'Notification error',
        error?.message ?? 'Could not schedule notification.'
      );
    }
  };

  const frequencyPerDay = Number(frequency) || 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        data={prescriptions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Prescriptions</Text>
              <Text style={styles.subtitle}>
                Manage medicines and daily reminders
              </Text>
            </View>

            {/* Add medicine card */}
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>
                Add Medicine
              </Text>

              <Text style={styles.label}>Medicine name</Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. Paracetamol"
                placeholderTextColor={COLORS.placeholder}
                value={drugName}
                onChangeText={setDrugName}
              />

              <Text style={styles.label}>Dosage</Text>

              <TextInput
                style={styles.input}
                placeholder="e.g. 500mg"
                placeholderTextColor={COLORS.placeholder}
                value={dosage}
                onChangeText={setDosage}
              />

              <View style={styles.twoColumnRow}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Times per day</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="number-pad"
                    value={frequency}
                    onChangeText={setFrequency}
                  />
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.label}>Quantity</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 10"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="number-pad"
                    value={quantity}
                    onChangeText={setQuantity}
                  />
                </View>
              </View>

              {frequencyPerDay > 0 && (
                <View style={styles.alarmSection}>
                  <Text style={styles.label}>Alarm times</Text>

                  <Text style={styles.helperText}>
                    Enter a different time for each daily dose.
                  </Text>

                  {Array.from({ length: frequencyPerDay }).map(
                    (_, index) => (
                      <TextInput
                        key={index}
                        style={styles.input}
                        placeholder={`Time ${index + 1} (HH:MM)`}
                        placeholderTextColor={COLORS.placeholder}
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
                </View>
              )}

              {/* Save */}
              <Pressable
                style={[
                  styles.primaryButton,
                  saving && styles.disabledButton,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? 'Saving...' : 'Save Medicine'}
                </Text>
              </Pressable>

              {/* Test notification */}
              <Pressable
                style={styles.testButton}
                onPress={handleTestAlarm}
              >
                <Text style={styles.testButtonText}>
                  Test Alarm in 1 Minute
                </Text>
              </Pressable>
            </View>

            {/* Existing medicines heading */}
            <View style={styles.listHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Your Medicines
                </Text>
                <Text style={styles.listSubtitle}>
                  Current prescriptions in this circle
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {prescriptions.length}
                </Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.prescriptionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.drugInfo}>
                <View style={styles.medicineIcon}>
                  <Text style={styles.medicineIconText}>+</Text>
                </View>

                <View style={styles.drugTextContainer}>
                  <Text style={styles.drugName}>
                    {item.drug_name}
                  </Text>

                  <Text style={styles.dosage}>
                    {item.dosage}
                  </Text>
                </View>
              </View>

              <View style={styles.quantityBadge}>
                <Text style={styles.quantity}>
                  {item.quantity_remaining}
                </Text>

                <Text style={styles.quantityLabel}>
                  left
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Frequency</Text>

              <Text style={styles.detailValue}>
                {item.frequency_per_day} time
                {item.frequency_per_day === 1 ? '' : 's'} per day
              </Text>
            </View>

            <View style={styles.alarmBlock}>
              <Text style={styles.alarmLabel}>
                Alarm times
              </Text>

              <View style={styles.alarmTimeRow}>
                {item.alarm_times?.length ? (
                  item.alarm_times.map((time) => (
                    <View
                      key={time}
                      style={styles.timeBadge}
                    >
                      <Text style={styles.timeText}>
                        {time.slice(0, 5)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noTimes}>
                    No times set
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>+</Text>
            </View>

            <Text style={styles.emptyTitle}>
              No prescriptions yet
            </Text>

            <Text style={styles.emptyText}>
              Add your first medicine above to start
              tracking doses and reminders.
            </Text>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
  },

  /* Header */

  header: {
    marginBottom: 24,
  },

  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 5,
  },

  /* Form */

  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },

  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 7,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 15,
    backgroundColor: COLORS.card,
    marginBottom: 16,
  },

  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },

  halfInput: {
    flex: 1,
  },

  alarmSection: {
    marginTop: 2,
  },

  helperText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: -2,
    marginBottom: 12,
  },

  /* Buttons */

  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  disabledButton: {
    opacity: 0.55,
  },

  primaryButtonText: {
    color: COLORS.card,
    fontSize: 15,
    fontWeight: '700',
  },

  testButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: COLORS.card,
  },

  testButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  /* Existing medicines */

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 12,
  },

  listSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },

  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  /* Prescription card */

  prescriptionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  drugInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  medicineIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  medicineIconText: {
    color: COLORS.primary,
    fontSize: 25,
  },

  drugTextContainer: {
    flex: 1,
  },

  drugName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
  },

  dosage: {
    color: COLORS.muted,
    fontSize: 13,
  },

  quantityBadge: {
    backgroundColor: COLORS.softBlue,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    marginLeft: 10,
  },

  quantity: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },

  quantityLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 1,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 15,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  detailLabel: {
    color: COLORS.muted,
    fontSize: 13,
  },

  detailValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },

  alarmBlock: {
    marginTop: 14,
  },

  alarmLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },

  alarmTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },

  timeBadge: {
    backgroundColor: COLORS.softBlue,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  timeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  noTimes: {
    color: COLORS.muted,
    fontSize: 12,
    fontStyle: 'italic',
  },

  /* Empty state */

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyIconText: {
    color: COLORS.primary,
    fontSize: 27,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },

  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});