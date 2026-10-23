import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useCareCircle } from '../contexts/CareCircleContext';
import { supabase } from '../services/supabase';
import {
  cancelAppointmentReminders,
  requestNotificationPermissions,
  scheduleAppointmentReminders,
} from '../services/notifications';

type Appointment = {
  id: string;
  circle_id: string;
  doctor_name: string | null;
  appointment_time: string;
  notes: string | null;
  location: string | null;
  reminder_ids: string[] | null;
  created_at?: string;
};

type PickerMode = 'date' | 'time';
const COLORS = {
  primary: '#2563EB', primaryDark: '#1D4ED8', background: '#F7FAFC', card: '#FFFFFF',
  text: '#172033', muted: '#64748B', placeholder: '#94A3B8', border: '#D9E2EC',
  softBlue: '#EFF6FF', danger: '#DC2626', softRed: '#FEF2F2',
};

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function formatAppointmentDateTime(value: string) {
  const date = new Date(value);
  return `${formatDate(date)} · ${formatTime(date)}`;
}

export default function AppointmentsScreen() {
  const { activeCircle } = useCareCircle();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [doctorName, setDoctorName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
    return date;
  });
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [pickerValue, setPickerValue] = useState(new Date());

  const loadAppointments = useCallback(async () => {
    if (!activeCircle?.circle_id) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('id, circle_id, doctor_name, appointment_time, notes, location, reminder_ids, created_at')
      .eq('circle_id', activeCircle.circle_id)
      .order('appointment_time', { ascending: true });
    if (error) {
      console.error('Error loading appointments:', error);
      Alert.alert('Could not load appointments', error.message);
    } else {
      setAppointments((data ?? []) as Appointment[]);
    }
    setLoading(false);
  }, [activeCircle?.circle_id]);

  useEffect(() => { void loadAppointments(); }, [loadAppointments]);
  useFocusEffect(useCallback(() => { void loadAppointments(); }, [loadAppointments]));

  const now = Date.now();
  const upcoming = useMemo(
    () => appointments.filter((item) => new Date(item.appointment_time).getTime() >= now),
    [appointments, now],
  );
  const past = useMemo(
    () => appointments.filter((item) => new Date(item.appointment_time).getTime() < now)
      .sort((a, b) => new Date(b.appointment_time).getTime() - new Date(a.appointment_time).getTime()),
    [appointments, now],
  );
  const displayedAppointments = tab === 'upcoming' ? upcoming : past;

  const resetForm = () => {
    const date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
    setDoctorName(''); setLocation(''); setNotes(''); setAppointmentDate(date);
    setEditing(null); setPickerMode(null); setFormVisible(false);
  };

  const openCreateForm = () => {
    resetForm();
    setFormVisible(true);
  };

  const openEditForm = (item: Appointment) => {
    setEditing(item);
    setDoctorName(item.doctor_name ?? '');
    setLocation(item.location ?? '');
    setNotes(item.notes ?? '');
    setAppointmentDate(new Date(item.appointment_time));
    setFormVisible(true);
  };

  const openPicker = (mode: PickerMode) => {
    setPickerValue(appointmentDate);
    setPickerMode(mode);
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null);
    if (event.type === 'dismissed' || !selected) return;
    const next = new Date(appointmentDate);
    if (pickerMode === 'date') {
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    } else {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }
    setAppointmentDate(next);
    setPickerValue(next);
  };

  const saveAppointment = async () => {
    if (!activeCircle?.circle_id) return;
    if (appointmentDate.getTime() <= Date.now()) {
      Alert.alert('Choose a future time', 'Appointments must be scheduled for a future date and time.');
      return;
    }
    try {
      setSaving(true);
      const permissionGranted = await requestNotificationPermissions();
      if (!permissionGranted) {
        Alert.alert('Reminders disabled', 'Notification permission was not granted. The appointment can still be saved, but reminders will not appear.');
      }

      const newReminderIds = permissionGranted
        ? await scheduleAppointmentReminders(doctorName, appointmentDate)
        : [];
      const payload = {
        circle_id: activeCircle.circle_id,
        doctor_name: doctorName.trim() || null,
        appointment_time: appointmentDate.toISOString(),
        notes: notes.trim() || null,
        location: location.trim() || null,
        reminder_ids: newReminderIds,
      };

      let error;
      if (editing) {
        const result = await supabase.from('appointments').update(payload).eq('id', editing.id).eq('circle_id', activeCircle.circle_id);
        error = result.error;
      } else {
        const result = await supabase.from('appointments').insert(payload);
        error = result.error;
      }
      if (error) {
        await cancelAppointmentReminders(newReminderIds);
        throw error;
      }

      if (editing?.reminder_ids?.length) await cancelAppointmentReminders(editing.reminder_ids);
      setFormVisible(false);
      setEditing(null);
      setTab('upcoming');
      await loadAppointments();
      Alert.alert(editing ? 'Appointment updated' : 'Appointment saved', newReminderIds.length
        ? 'Your appointment and local reminders have been saved.'
        : 'Your appointment was saved. No local reminders were scheduled.');
    } catch (error: any) {
      console.error('Error saving appointment:', error);
      Alert.alert('Could not save appointment', error?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAppointment = (item: Appointment) => {
    Alert.alert('Delete appointment?', `Remove ${item.doctor_name || 'this appointment'} from your care circle?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
        const { error } = await supabase.from('appointments').delete().eq('id', item.id).eq('circle_id', item.circle_id);
        if (error) {
          Alert.alert('Could not delete appointment', error.message);
          return;
        }
        await cancelAppointmentReminders(item.reminder_ids ?? []);
        await loadAppointments();
      })(); } },
    ]);
  };

  if (!activeCircle) return null;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Appointments</Text>
            <Text style={styles.subtitle}>Keep track of doctor visits and reminders</Text>
          </View>
          <Pressable style={styles.addButton} onPress={openCreateForm} accessibilityRole="button">
            <Text style={styles.addButtonText}>＋ Add</Text>
          </Pressable>
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          <Pressable style={[styles.tab, tab === 'upcoming' && styles.activeTab]} onPress={() => setTab('upcoming')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'upcoming' }}>
            <Text style={[styles.tabText, tab === 'upcoming' && styles.activeTabText]}>Upcoming ({upcoming.length})</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'past' && styles.activeTab]} onPress={() => setTab('past')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'past' }}>
            <Text style={[styles.tabText, tab === 'past' && styles.activeTabText]}>Past ({past.length})</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator style={styles.loader} size="large" color={COLORS.primary} /> : (
          <FlatList
            data={displayedAppointments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={displayedAppointments.length ? styles.list : styles.emptyList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.appointmentCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.calendarIcon}><Text style={styles.calendarIconText}>✚</Text></View>
                  <View style={styles.appointmentMain}>
                    <Text style={styles.doctorName}>{item.doctor_name || 'Doctor appointment'}</Text>
                    <Text style={styles.dateTime}>{formatAppointmentDateTime(item.appointment_time)}</Text>
                  </View>
                  <View style={[styles.statusBadge, tab === 'past' && styles.pastBadge]}>
                    <Text style={[styles.statusText, tab === 'past' && styles.pastStatusText]}>{tab === 'past' ? 'Past' : 'Upcoming'}</Text>
                  </View>
                </View>
                {!!item.location && <Text style={styles.detailText}>⌖  {item.location}</Text>}
                {!!item.notes && <Text style={styles.notesText}>{item.notes}</Text>}
                {tab === 'upcoming' && (
                  <View style={styles.cardActions}>
                    <Text style={styles.reminderHint}>{item.reminder_ids?.length ? '🔔 Reminders set' : '◷ No reminders set'}</Text>
                    <View style={styles.actionButtons}>
                      <Pressable style={styles.secondaryButton} onPress={() => openEditForm(item)}><Text style={styles.secondaryButtonText}>Edit</Text></Pressable>
                      <Pressable style={styles.deleteButton} onPress={() => deleteAppointment(item)}><Text style={styles.deleteButtonText}>Delete</Text></Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
            ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>{tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}</Text><Text style={styles.emptyText}>{tab === 'upcoming' ? 'Add a doctor visit and we’ll help you remember it.' : 'Completed appointments will appear here.'}</Text>{tab === 'upcoming' && <Pressable style={styles.primaryButton} onPress={openCreateForm}><Text style={styles.primaryButtonText}>Add appointment</Text></Pressable>}</View>}
          />
        )}
      </View>

      <Modal visible={formVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
        <KeyboardAvoidingView style={styles.modalScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>{editing ? 'Edit appointment' : 'New appointment'}</Text><Text style={styles.subtitle}>Appointment details and reminders</Text></View>
              <Pressable onPress={resetForm} hitSlop={10}><Text style={styles.closeText}>Cancel</Text></Pressable>
            </View>

            <Text style={styles.label}>Doctor / provider</Text>
            <TextInput style={styles.input} value={doctorName} onChangeText={setDoctorName} placeholder="e.g. Dr. Sharma" placeholderTextColor={COLORS.placeholder} returnKeyType="next" />
            <Text style={styles.label}>Date</Text>
            <Pressable style={styles.pickerButton} onPress={() => openPicker('date')}><Text style={styles.pickerIcon}>▦</Text><Text style={styles.pickerValue}>{formatDate(appointmentDate)}</Text><Text style={styles.pickerChange}>Change</Text></Pressable>
            <Text style={styles.label}>Time</Text>
            <Pressable style={styles.pickerButton} onPress={() => openPicker('time')}><Text style={styles.pickerIcon}>◷</Text><Text style={styles.pickerValue}>{formatTime(appointmentDate)}</Text><Text style={styles.pickerChange}>Change</Text></Pressable>
            {pickerMode && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={pickerValue}
                  mode={pickerMode}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={pickerMode === 'date' ? new Date(new Date().setHours(0, 0, 0, 0)) : undefined}
                  onChange={onPickerChange}
                />
                {Platform.OS === 'ios' && <Pressable style={styles.pickerDoneButton} onPress={() => setPickerMode(null)}><Text style={styles.pickerDoneText}>Done</Text></Pressable>}
              </View>
            )}
            <Text style={styles.label}>Location (optional)</Text>
            <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Clinic / hospital address" placeholderTextColor={COLORS.placeholder} />
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput style={[styles.input, styles.notesInput]} value={notes} onChangeText={setNotes} placeholder="Reason for visit, questions to ask…" placeholderTextColor={COLORS.placeholder} multiline textAlignVertical="top" />

            <View style={styles.reminderInfo}><Text style={styles.reminderInfoTitle}>🔔 Local reminders</Text><Text style={styles.reminderInfoText}>We’ll schedule reminders 24 hours and 1 hour before the appointment when those times are still in the future. Allow notifications when prompted.</Text></View>
            <Pressable style={[styles.primaryButton, saving && styles.disabledButton]} onPress={() => void saveAppointment()} disabled={saving}><Text style={styles.primaryButtonText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save appointment'}</Text></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 5 },
  addButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  addButtonText: { color: COLORS.card, fontWeight: '700', fontSize: 14 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 13, backgroundColor: '#E9EEF5', marginBottom: 16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10 },
  activeTab: { backgroundColor: COLORS.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  tabText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: COLORS.primary, fontWeight: '700' },
  loader: { marginTop: 40 },
  list: { paddingBottom: 30 },
  emptyList: { flexGrow: 1, justifyContent: 'center', paddingBottom: 30 },
  appointmentCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  calendarIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.softBlue, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  calendarIconText: { color: COLORS.primary, fontSize: 21 },
  appointmentMain: { flex: 1 },
  doctorName: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 5 },
  dateTime: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  statusBadge: { backgroundColor: COLORS.softBlue, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginLeft: 6 },
  statusText: { color: COLORS.primary, fontSize: 10, fontWeight: '700' },
  pastBadge: { backgroundColor: '#F1F5F9' },
  pastStatusText: { color: COLORS.muted },
  detailText: { color: COLORS.muted, fontSize: 13, marginTop: 14 },
  notesText: { color: COLORS.text, fontSize: 13, lineHeight: 19, marginTop: 9 },
  cardActions: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 15, paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  reminderHint: { color: COLORS.muted, fontSize: 11 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  secondaryButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  secondaryButtonText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  deleteButton: { backgroundColor: COLORS.softRed, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  deleteButtonText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  emptyCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 24, alignItems: 'center' },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8, marginBottom: 16 },
  primaryButton: { minHeight: 50, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  primaryButtonText: { color: COLORS.card, fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
  modalScreen: { flex: 1, backgroundColor: COLORS.background },
  modalContent: { padding: 20, paddingTop: 24, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
  modalTitle: { color: COLORS.text, fontSize: 24, fontWeight: '700' },
  closeText: { color: COLORS.primary, fontSize: 14, fontWeight: '700', paddingTop: 6 },
  label: { color: COLORS.text, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input: { minHeight: 49, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontSize: 14, backgroundColor: COLORS.card, marginBottom: 17 },
  notesInput: { minHeight: 96 },
  pickerButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, marginBottom: 17 },
  pickerIcon: { color: COLORS.primary, fontSize: 20, width: 32 },
  pickerValue: { color: COLORS.text, fontSize: 14, fontWeight: '600', flex: 1 },
  pickerChange: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  pickerContainer: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 18, paddingVertical: 8 },
  pickerDoneButton: { alignSelf: 'flex-end', paddingHorizontal: 18, paddingVertical: 10 },
  pickerDoneText: { color: COLORS.primary, fontWeight: '700' },
  reminderInfo: { backgroundColor: COLORS.softBlue, borderRadius: 12, padding: 14, marginTop: 3, marginBottom: 12 },
  reminderInfoTitle: { color: COLORS.text, fontWeight: '700', fontSize: 13, marginBottom: 6 },
  reminderInfoText: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
});
