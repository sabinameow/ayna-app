import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useFocusReload } from "@/hooks/useFocusReload";
import { palette } from "@/theme";
import type { NotificationItem } from "@/types/api";
import { formatDateTime } from "@/utils/format";

export function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { items, loading, refresh, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  useFocusReload(refresh);

  async function handleNotificationPress(item: NotificationItem) {
    if (!item.is_read) {
      try {
        await markAsRead(item.id);
      } catch {
        // Navigation should still work even if mark-as-read fails.
      }
    }

    const target = resolveNotificationTarget(item, user?.role ?? null);
    if (!target) {
      return;
    }

    navigation.navigate(target.navigator, { screen: target.screen });
  }

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={22} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{unreadCount} unread</Text>
        </View>
        <Pressable
          style={[styles.markAllBtn, unreadCount === 0 && styles.markAllBtnDisabled]}
          onPress={() => void markAllAsRead()}
          disabled={unreadCount === 0}
        >
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      </View>

      {loading ? (
        <GlassCard style={styles.loadingCard}>
          <ActivityIndicator size="small" color={palette.patient} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </GlassCard>
      ) : items.length ? (
        items.map((item) => (
          <Pressable key={item.id} onPress={() => void handleNotificationPress(item)}>
            <GlassCard style={[styles.itemCard, !item.is_read && styles.itemCardUnread]}>
              <View style={styles.itemTopRow}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {!item.is_read ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.itemMessage}>{item.message}</Text>
              <View style={styles.itemMetaRow}>
                <Text style={styles.itemMeta}>{item.type.replaceAll(".", " ")}</Text>
                <Text style={styles.itemMeta}>{formatDateTime(item.created_at)}</Text>
              </View>
            </GlassCard>
          </Pressable>
        ))
      ) : (
        <GlassCard style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Feather name="bell-off" size={22} color={palette.patient} />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            Important updates about your cycle, appointments, and messages will appear here.
          </Text>
        </GlassCard>
      )}
    </AppScreen>
  );
}

function resolveNotificationTarget(
  item: NotificationItem,
  role: "patient" | "doctor" | "manager" | null
): { navigator: string; screen: string } | null {
  if (!role) return null;

  const isAppointment = item.type.startsWith("appointment.") || Boolean(item.metadata?.appointment_id);
  const isChat = item.type.startsWith("chat.") || Boolean(item.metadata?.session_id);

  if (isAppointment) {
    if (role === "patient") return { navigator: "PatientTabs", screen: "PatientAppointments" };
    if (role === "doctor") return { navigator: "DoctorTabs", screen: "DoctorAppointments" };
    if (role === "manager") return { navigator: "ManagerTabs", screen: "ManagerAppointments" };
  }

  if (isChat) {
    if (role === "patient") return { navigator: "PatientTabs", screen: "PatientChat" };
    if (role === "manager") return { navigator: "ManagerTabs", screen: "ManagerChats" };
  }

  return null;
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.patientSoft,
  },
  markAllBtnDisabled: {
    opacity: 0.5,
  },
  markAllText: {
    color: palette.patient,
    fontSize: 12,
    fontWeight: "700",
  },
  loadingCard: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 13,
  },
  itemCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#F0DCE7",
  },
  itemCardUnread: {
    backgroundColor: "#FFF5FA",
    borderColor: "#F6B5D1",
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  itemTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: "800",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.patient,
  },
  itemMessage: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  itemMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  itemMeta: {
    color: "#9A93A0",
    fontSize: 11,
    textTransform: "capitalize",
  },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 28,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
});
