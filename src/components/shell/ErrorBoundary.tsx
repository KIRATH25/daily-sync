import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

/**
 * Route-level error boundary. Deliberately free of theme/i18n context so it
 * can render even if those providers are what failed.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  console.error('Screen crashed', error.message);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Something went wrong on this screen</Text>
      <Text style={styles.body}>Your data is safe. Try again, or go back and reopen the screen.</Text>
      <TouchableOpacity onPress={retry} style={styles.button} accessibilityRole="button" accessibilityLabel="Try again">
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0D0F', justifyContent: 'center', padding: 28, gap: 14 },
  title: { color: '#F5F3EE', fontSize: 21, fontWeight: '700' },
  body: { color: '#A5A7A8', fontSize: 15, lineHeight: 22 },
  button: { backgroundColor: '#F4D54D', borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#1A1708', fontSize: 16, fontWeight: '700' },
});
