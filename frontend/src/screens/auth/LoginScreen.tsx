import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { API_BASE_URL } from "@/constants/config";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { validateEmail } from "@/utils/validators";

type Props = NativeStackScreenProps<any>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("patient1@ayna.app");
  const [password, setPassword] = useState("Patient1Pass");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (emailError) setEmailError(validateEmail(value));
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (passwordError && value) setPasswordError(null);
  }

  async function handleLogin() {
    const eErr = validateEmail(email);
    const pErr = password ? null : "Password is required";
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    try {
      setLoading(true);
      setError("");
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.brandWrap}>
        <Text style={styles.brand}>AYNA</Text>
        <Text style={styles.tagline}>Reflect. Understand. Care.</Text>
      </View>

      <GlassCard>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in to access your patient, doctor, or manager workspace.
        </Text>
        <AppInput
          label="Email"
          value={email}
          autoCapitalize="none"
          onChangeText={handleEmailChange}
          onBlur={() => setEmailError(validateEmail(email))}
          keyboardType="email-address"
          placeholder="name@example.com"
          error={emailError}
        />
        <AppInput
          label="Password"
          value={password}
          secureTextEntry
          onChangeText={handlePasswordChange}
          error={passwordError}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Sign In" loading={loading} onPress={handleLogin} />
      </GlassCard>

      <Pressable onPress={() => navigation.navigate("Register")}>
        <Text style={styles.link}>New patient? Create an account</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center" },
  brandWrap: { alignItems: "center", gap: 8, marginBottom: 12 },
  brand: { fontSize: 44, fontWeight: "300", letterSpacing: 10, color: "#6F6480" },
  tagline: { color: "#9A8E9D", letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: "800", color: "#231F29", marginBottom: 6 },
  subtitle: { color: "#7F7486", marginBottom: 18 },
  apiHint: { color: "#9A8E9D", fontSize: 12, marginBottom: 14 },
  error: { color: "#E25555", marginTop: -4 },
  link: { textAlign: "center", color: "#E53F8F", fontWeight: "700" },
  hintBox: { backgroundColor: "#FFFFFFAA", borderRadius: 18, padding: 16, gap: 4 },
  hintTitle: { fontWeight: "800", color: "#231F29" },
  hintText: { color: "#7F7486" },
});
