import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { supabase } from '../services/supabase';
import { registerForPushNotifications } from '../services/notifications';
import { saveDeviceToken } from '../services/deviceTokens';

export default function LoginScreen() {
  const [isSignup, setIsSignup] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (isSignup) {
      if (!name.trim() || !phone.trim() || !email.trim() || !password) {
        setError('Please fill in all fields.');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            phone_number: phone.trim(),
          },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      // If email confirmation is enabled, session may be null here.
      if (!data.session) {
        setMessage(
          'Account created. Please confirm your email before logging in.'
        );
      } else {
        setMessage('Account created successfully.');
      }

      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    const user = data.user;

    if (user) {
      try {
        const token = await registerForPushNotifications(user.id);

        if (token) {
          await saveDeviceToken(user.id, token);
          console.log('Device token registered successfully');
        }
      } catch (tokenError) {
        console.error('Failed to register device token:', tokenError);
      }
    }
  };

  const toggleMode = () => {
    setIsSignup((current) => !current);
    setError(null);
    setMessage(null);
  };

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Text style={styles.logoIcon}>♡</Text>
        </View>

        <Text style={styles.title}>Care Circle</Text>
        <Text style={styles.tagline}>Care, connected.</Text>
      </View>

      {/* Form */}
      <View style={styles.formCard}>
        <Text style={styles.heading}>
          {isSignup ? 'Create an account' : 'Welcome back'}
        </Text>

        <Text style={styles.subtitle}>
          {isSignup
            ? 'Set up your Care Circle account to get started.'
            : 'Sign in to continue to your Care Circle.'}
        </Text>

        {isSignup && (
          <>
            <Text style={styles.label}>Full name</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={COLORS.placeholder}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Phone number</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your phone number"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor={COLORS.placeholder}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor={COLORS.placeholder}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        {message && (
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
        )}

        <View style={styles.primaryButton}>
          <Button
            title={isSignup ? 'Create account' : 'Log in'}
            onPress={handleSubmit}
            color={COLORS.primary}
          />
        </View>
      </View>

      {/* Login / Signup switch */}
      <View style={styles.switchContainer}>
        <Text style={styles.switchText}>
          {isSignup
            ? 'Already have an account?'
            : "Don't have an account?"}
        </Text>

        <View style={styles.switchButton}>
          <Button
            title={isSignup ? 'Log In' : 'Sign Up'}
            onPress={toggleMode}
            color={COLORS.primary}
          />
        </View>
      </View>
    </View>
  );
}

const COLORS = {
  primary: '#2563EB',
  background: '#F7FAFC',
  card: '#FFFFFF',
  text: '#172033',
  muted: '#64748B',
  placeholder: '#94A3B8',
  border: '#D9E2EC',
  error: '#DC2626',
  errorBackground: '#FEF2F2',
  success: '#16A34A',
  successBackground: '#F0FDF4',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: COLORS.background,
  },

  brand: {
    alignItems: 'center',
    marginBottom: 32,
  },

  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  logoIcon: {
    color: COLORS.card,
    fontSize: 34,
    fontWeight: '300',
  },

  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  tagline: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 5,
  },

  /* Form card */

  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  heading: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },

  /* Inputs */

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

  /* Feedback */

  errorBox: {
    backgroundColor: COLORS.errorBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },

  error: {
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 18,
  },

  messageBox: {
    backgroundColor: COLORS.successBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },

  message: {
    color: COLORS.success,
    fontSize: 13,
    lineHeight: 18,
  },

  /* Buttons */

  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },

  /* Mode switch */

  switchContainer: {
    marginTop: 24,
    alignItems: 'center',
  },

  switchText: {
    color: COLORS.muted,
    fontSize: 14,
  },

  switchButton: {
    marginTop: 2,
    borderRadius: 12,
  },
});