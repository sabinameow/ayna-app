import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import {
  formatPhone,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirm,
  validatePhone,
} from "@/utils/validators";

type Props = NativeStackScreenProps<any>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handlePhoneChange(value: string) {
    setPhone(formatPhone(value));
    if (phoneError) setPhoneError(validatePhone(value));
  }

  async function handleRegister() {
    const nErr = validateName(fullName);
    const eErr = validateEmail(email);
    const phErr = validatePhone(phone);
    const pErr = validatePassword(password);
    const cErr = validatePasswordConfirm(password, passwordConfirm);

    setNameError(nErr);
    setEmailError(eErr);
    setPhoneError(phErr);
    setPasswordError(pErr);
    setConfirmError(cErr);
    if (nErr || eErr || phErr || pErr || cErr) return;

    try {
      setLoading(true);
      setError("");
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone || undefined,
        password,
        password_confirm: passwordConfirm,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <GlassCard>
        <Text style={styles.title}>Create patient account</Text>
        <Text style={styles.subtitle}>
          Patients self-register in Ayna. Doctor and manager accounts come from admin setup.
        </Text>
        <AppInput
          label="Full name"
          value={fullName}
          onChangeText={(v) => {
            setFullName(v);
            if (nameError) setNameError(validateName(v));
          }}
          onBlur={() => setNameError(validateName(fullName))}
          autoCapitalize="words"
          placeholder="Jane Doe"
          error={nameError}
        />
        <AppInput
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (emailError) setEmailError(validateEmail(v));
          }}
          onBlur={() => setEmailError(validateEmail(email))}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="name@example.com"
          error={emailError}
        />
        <AppInput
          label="Phone"
          value={phone}
          onChangeText={handlePhoneChange}
          onBlur={() => setPhoneError(validatePhone(phone))}
          keyboardType="phone-pad"
          placeholder="+7 XXX XXX XX XX"
          maxLength={16}
          error={phoneError}
        />
        <AppInput
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (passwordError) setPasswordError(validatePassword(v));
            if (confirmError && passwordConfirm) {
              setConfirmError(validatePasswordConfirm(v, passwordConfirm));
            }
          }}
          onBlur={() => setPasswordError(validatePassword(password))}
          secureTextEntry
          placeholder="At least 8 chars, A-z, 0-9"
          error={passwordError}
        />
        <AppInput
          label="Confirm password"
          value={passwordConfirm}
          onChangeText={(v) => {
            setPasswordConfirm(v);
            if (confirmError) setConfirmError(validatePasswordConfirm(password, v));
          }}
          onBlur={() => setConfirmError(validatePasswordConfirm(password, passwordConfirm))}
          secureTextEntry
          error={confirmError}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Create Account" loading={loading} onPress={handleRegister} />
      </GlassCard>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Back to sign in</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", flexGrow: 1 },
  title: { fontSize: 28, fontWeight: "800", color: "#231F29", marginBottom: 6 },
  subtitle: { color: "#7F7486", marginBottom: 18 },
  error: { color: "#E25555", marginTop: -4 },
  link: { textAlign: "center", color: "#E53F8F", fontWeight: "700" },
});
