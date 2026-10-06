import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, } from 'react-native';
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

  if (!activeCircle) return null;

  return (
    <View style={styles.screen}>
      <FlatList
        data={prescriptions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.greeting}>Care Circle</Text>
                <Text style={styles.circleName}>
                  {activeCircle.circle_name}
                </Text>
              </View>

              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  {activeCircle.role}
                </Text>
              </View>
            </View>

            {/* Circle switcher */}
            {memberships.length > 1 && (
              <View style={styles.switcherCard}>
                <Text style={styles.sectionLabel}>Your circles</Text>

                <View style={styles.switcher}>
                  {memberships.map((m) => {
                    const isActive =
                      m.circle_id === activeCircle.circle_id;

                    return (
                      <Pressable
                        key={m.circle_id}
                        onPress={() => setActiveCircleId(m.circle_id)}
                        style={[
                          styles.circleButton,
                          isActive && styles.circleButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.circleButtonText,
                            isActive &&
                              styles.circleButtonTextActive,
                          ]}
                        >
                          {m.circle_name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Medication section */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.title}>Today's Medications</Text>
                <Text style={styles.sectionSubtitle}>
                  Your current prescriptions
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
          <View style={styles.medicationCard}>
            <View style={styles.medicationIcon}>
              <Text style={styles.medicationIconText}>+</Text>
            </View>

            <View style={styles.medicationInfo}>
              <Text style={styles.drugName}>{item.drug_name}</Text>
              <Text style={styles.quantity}>
                {item.quantity_remaining} doses remaining
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>+</Text>
            </View>

            <Text style={styles.emptyTitle}>No medications yet</Text>

            <Text style={styles.emptyText}>
              Add a prescription to start tracking medications.
            </Text>
          </View>
        }
        ListFooterComponent={
          <>
            {/* Main actions */}
            <View style={styles.actionsSection}>
              <Text style={styles.sectionLabel}>Quick actions</Text>

              <Pressable
                style={styles.primaryAction}
                onPress={() =>
                  navigation.navigate('Prescriptions')
                }
              >
                <Text style={styles.primaryActionText}>
                  Prescriptions
                </Text>
              </Pressable>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryAction}
                  onPress={() =>
                    navigation.navigate('Appointments')
                  }
                >
                  <Text style={styles.actionIcon}>▣</Text>
                  <Text style={styles.secondaryActionText}>
                    Appointments
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryAction}
                  onPress={() =>
                    navigation.navigate('InviteMembers')
                  }
                >
                  <Text style={styles.actionIcon}>+</Text>
                  <Text style={styles.secondaryActionText}>
                    Invite Members
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* SOS */}
            {activeCircle.can_trigger_sos && (
              <Pressable
                style={({ pressed }) => [
                  styles.sosButton,
                  pressed && styles.sosPressed,
                ]}
                onPress={() => navigation.navigate('SOS')}
              >
                <View style={styles.sosIcon}>
                  <Text style={styles.sosIconText}>!</Text>
                </View>

                <View style={styles.sosTextContainer}>
                  <Text style={styles.sosTitle}>Emergency SOS</Text>
                  <Text style={styles.sosSubtitle}>
                    Alert your care circle
                  </Text>
                </View>
              </Pressable>
            )}
          </>
        }
      />
    </View>
  );
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
  dangerBackground: '#FEF2F2',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 32,
  },

  /* Header */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  greeting: {
    color: COLORS.muted,
    fontSize: 14,
    marginBottom: 3,
  },

  circleName: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '700',
  },

  roleBadge: {
    backgroundColor: COLORS.softBlue,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  roleBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  /* Circle switcher */

  switcherCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  sectionLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  switcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  circleButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  circleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  circleButtonText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
  },

  circleButtonTextActive: {
    color: COLORS.card,
  },

  /* Medication section */

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  title: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '700',
  },

  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 3,
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

  medicationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  medicationIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  medicationIconText: {
    color: COLORS.primary,
    fontSize: 25,
    fontWeight: '400',
  },

  medicationInfo: {
    flex: 1,
  },

  drugName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },

  quantity: {
    color: COLORS.muted,
    fontSize: 13,
  },

  /* Empty state */

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
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

  /* Actions */

  actionsSection: {
    marginTop: 28,
  },

  primaryAction: {
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  primaryActionText: {
    color: COLORS.card,
    fontSize: 15,
    fontWeight: '700',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },

  secondaryAction: {
    flex: 1,
    minHeight: 76,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },

  actionIcon: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 5,
  },

  secondaryActionText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },

  /* SOS */

  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerBackground,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 15,
    marginTop: 20,
  },

  sosPressed: {
    opacity: 0.75,
  },

  sosIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  sosIconText: {
    color: COLORS.card,
    fontSize: 21,
    fontWeight: '800',
  },

  sosTextContainer: {
    flex: 1,
  },

  sosTitle: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },

  sosSubtitle: {
    color: '#991B1B',
    fontSize: 12,
  },
});