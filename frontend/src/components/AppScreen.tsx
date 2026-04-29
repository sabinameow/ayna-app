import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  scroll?: boolean;
  children: React.ReactNode;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
} & ViewProps;

export function AppScreen({
  children,
  scroll = true,
  contentContainerStyle,
  style,
}: Props) {
  const content = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, style]}>{children}</View>
  );

  return (
    <LinearGradient colors={["#FFF9FB", "#FDEFF5", "#FFF9FB"]} style={styles.gradient}>
      <SafeAreaView edges={["top"]} style={styles.safe}>
        {content}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 120,
  },
});
