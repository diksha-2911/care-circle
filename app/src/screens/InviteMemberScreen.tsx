import { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useCareCircle } from '../contexts/CareCircleContext';
import { createCircleInvitation } from '../services/circle';

interface CircleMember {
  user_id: string;
  full_name: string;
  role: string;
}

export default function InviteMemberScreen({ navigation }: any) {
  const { activeCircle } = useCareCircle();
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const generateInvite = async () => {
  if (!activeCircle) return;

  try {
    setGenerating(true);

    const code = await createCircleInvitation(
      activeCircle.circle_id
    );

    setInviteCode(code);
    } catch (error: any) {
        Alert.alert(
        'Could not create invite',
        error.message
        );
    } finally {
        setGenerating(false);
    }
};

  useEffect(() => {
    if (!activeCircle) return;

    const loadMembers = async () => {
      const { data, error } = await supabase
        .from('circle_members')
        .select(`
          user_id,
          role,
          users (
            full_name
          )
        `)
        .eq('circle_id', activeCircle.circle_id);

      if (error) {
        console.error('Error loading circle members:', error);
        return;
      }

      const members = (data ?? []).map((member: any) => ({
        user_id: member.user_id,
        full_name: member.users?.full_name ?? 'Unknown member',
        role: member.role,
      }));

      setCircleMembers(members);
    };

    loadMembers();
  }, [activeCircle?.circle_id]);

  if (!activeCircle) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.circleName}>
        {activeCircle.circle_name}
      </Text>

      <Text style={styles.role}>
        You are a {activeCircle.role} in this circle
      </Text>

      <Text style={styles.title}>
        Your Circle Members
      </Text>

      <FlatList
        data={circleMembers}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.full_name}</Text>
            <Text style={styles.memberRole}>
              {item.role}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No members in circle yet.
          </Text>
        }
      />

      <Text style={styles.title}>
        Invite a caregiver
      </Text>

      <Text style={styles.description}>
        Generate an invitation code and share it with the caregiver you
        want to add to this circle.
      </Text>

    {!inviteCode && (
    <Button
        title={generating ? 'Generating...' : 'Generate Invite'}
        onPress={generateInvite}
        disabled={generating}
    />
    )}

    {inviteCode && (
        <View style={styles.inviteBox}>
            <Text style={styles.inviteLabel}>
            Share this code with the caregiver
            </Text>

            <Text style={styles.inviteCode}>
            {inviteCode}
            </Text>

            <Text>
            This invitation is valid for 7 days.
            </Text>
        </View>
    )}
  
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },

  circleName: {
    fontSize: 24,
    fontWeight: '700',
  },

  role: {
    color: '#777',
    marginBottom: 24,
    textTransform: 'capitalize',
  },

  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },

  description: {
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  memberRole: {
    color: '#777',
    textTransform: 'capitalize',
  },

  empty: {
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  inviteBox: {
    marginTop: 24,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },

  inviteLabel: {
    fontSize: 16,
    color: '#666',
  },

  inviteCode: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    marginVertical: 12,
  },
});
