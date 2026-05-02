import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from "react-native";

import type { SaveFeedbackStatus } from "@/hooks/useSaveFeedback";

type Props = PressableProps & {
  label: string;
  loading?: boolean;
  feedbackStatus?: SaveFeedbackStatus;
};

export function PrimaryButton({ label, loading, style, disabled, feedbackStatus = "idle", ...rest }: Props) {
  const isBusy = loading || feedbackStatus === "saving";
  const showStatusIcon = feedbackStatus === "saved" || feedbackStatus === "error";

  return (
    <Pressable
      style={(state) => {
        const resolvedStyle = typeof style === "function" ? style(state) : style;
        return [
          styles.button,
          resolvedStyle,
          feedbackStatus === "saving" && styles.saving,
          feedbackStatus === "saved" && styles.saved,
          feedbackStatus === "error" && styles.error,
          state.pressed && styles.pressed,
          (disabled || loading) && feedbackStatus === "idle" && styles.disabled,
        ];
      }}
      disabled={disabled || loading}
      {...rest}
    >
      {isBusy ? (
        <View style={styles.content}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.label}>{label}</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {showStatusIcon ? (
            <Feather
              name={feedbackStatus === "saved" ? "check" : "alert-circle"}
              size={17}
              color="#FFFFFF"
            />
          ) : null}
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
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
  saving: {
    opacity: 0.88,
  },
  saved: {
    backgroundColor: "#5F8F72",
  },
  error: {
    backgroundColor: "#B65A5A",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
