import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";

type Props = PressableProps & {
  label: string;
  loading?: boolean;
};

export function PrimaryButton({ label, loading, style, disabled, ...rest }: Props) {
  return (
    <Pressable
      style={(state) => {
        const resolvedStyle = typeof style === "function" ? style(state) : style;
        return [
          styles.button,
          state.pressed && styles.pressed,
          (disabled || loading) && styles.disabled,
          resolvedStyle,
        ];
      }}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#E53F8F",
    borderRadius: 999,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
