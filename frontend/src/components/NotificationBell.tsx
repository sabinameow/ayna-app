import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useNotifications } from "@/hooks/useNotifications";

type Props = {
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
};

export function NotificationBell({
  color = "#E53F8F",
  backgroundColor = "#FCE4EF",
  style,
}: Props) {
  const navigation = useNavigation<any>();
  const { unreadCount } = useNotifications();

  return (
    <Pressable
      onPress={() => navigation.navigate("Notifications")}
      style={[styles.button, { backgroundColor }, style]}
    >
      <Feather name="bell" size={18} color={color} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#E25555",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});
