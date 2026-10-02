import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { supabase } from '../services/supabase';

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

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
    }
  };

  const toggleMode = () => {
    setIsSignup((current) => !current);
    setError(null);
    setMessage(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Care Circle</Text>

      <Text style={styles.heading}>
        {isSignup ? 'Create an account' : 'Welcome back'}
      </Text>

      {isSignup && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      {message && <Text style={styles.message}>{message}</Text>}

      <Button
        title={isSignup ? 'Sign Up' : 'Log In'}
        onPress={handleSubmit}
      />

      <View style={styles.switchContainer}>
        <Text>
          {isSignup
            ? 'Already have an account?'
            : "Don't have an account?"}
        </Text>

        <Button
          title={isSignup ? 'Log In' : 'Sign Up'}
          onPress={toggleMode}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },

  heading: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 24,
    textAlign: 'center',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },

  error: {
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 12,
  },

  message: {
    color: 'green',
    textAlign: 'center',
    marginBottom: 12,
  },

  switchContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
});
