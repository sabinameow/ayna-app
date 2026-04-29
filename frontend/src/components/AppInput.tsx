import React from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function AppInput({ label, style, error, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#A594A2"
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: "#7F7486",
    fontWeight: "600",
  },
  input: {
    minHeight: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    color: "#231F29",
    borderWidth: 1,
    borderColor: "#F0DCE7",
  },
  inputError: {
    borderColor: "#E25555",
  },
  errorText: {
    fontSize: 12,
    color: "#E25555",
    fontWeight: "600",
  },
});
