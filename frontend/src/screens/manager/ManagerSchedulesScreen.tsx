import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { DoctorProfile, Schedule } from "@/types/api";
import { formatTime, weekdayLabel } from "@/utils/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayWeekday() {
  // getDay(): 0=Sun, 1=Mon... → convert to Mon=0
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function DoctorScheduleCard({
  doctor,
  slots,
}: {
  doctor: DoctorProfile;
  slots: Schedule[];
}) {
  const [expanded, setExpanded] = useState(false);
  const today = todayWeekday();

  const todaySlot = slots.find((s) => s.weekday === today);
  const nextSlot = slots.find((s) => s.weekday > today) ?? slots[0];

  const activeDays = slots.map((s) => s.weekday);

  return (
    <GlassCard style={styles.docCard}>
      {/* Doctor header */}
      <View style={styles.docHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{doctor.full_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docName}>{doctor.full_name}</Text>
          <Text style={styles.docSpec}>{doctor.specialization || "General medicine"}</Text>
        </View>
        <View style={styles.rightCol}>
          <View
            style={[
              styles.availBadge,
              { backgroundColor: doctor.is_available ? "#EEF7D8" : "#F2F4F8" },
            ]}
          >
            <View
              style={[
                styles.availDot,
                { backgroundColor: doctor.is_available ? "#8AAF2B" : "#B0A8B9" },
              ]}
            />
            <Text
              style={[
                styles.availText,
                { color: doctor.is_available ? "#557417" : "#7F7486" },
              ]}
            >
              {doctor.is_available ? "Available" : "Unavailable"}
            </Text>
          </View>
          <Text style={styles.slotCount}>
            {slots.length} day{slots.length !== 1 ? "s" : ""} scheduled
          </Text>
        </View>
      </View>

      {/* Today's hours */}
      {todaySlot ? (
        <View style={styles.todayRow}>
          <Feather name="clock" size={13} color="#557417" />
          <Text style={styles.todayText}>
            Today: {formatTime(todaySlot.start_time)} – {formatTime(todaySlot.end_time)} ·{" "}
            {todaySlot.slot_duration_minutes}min slots
          </Text>
        </View>
      ) : (
        <View style={styles.todayRow}>
          <Feather name="clock" size={13} color="#B0A8B9" />
          <Text style={styles.todayOffText}>
            Off today
            {nextSlot ? ` · Next: ${weekdayLabel(nextSlot.weekday)}` : ""}
          </Text>
        </View>
      )}

      {/* Week minimap */}
      <View style={styles.weekMap}>
        {WEEKDAYS.map((day, index) => {
          const isActive = activeDays.includes(index);
          const isToday = index === today;
          return (
            <View
              key={day}
              style={[
                styles.dayDot,
                isActive && styles.dayDotActive,
                isToday && styles.dayDotToday,
              ]}
            >
              <Text
                style={[
                  styles.dayDotText,
                  isActive && styles.dayDotTextActive,
                  isToday && styles.dayDotTextToday,
                ]}
              >
                {day.charAt(0)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Expand/collapse slots */}
      {slots.length > 0 && (
        <>
          <Pressable onPress={() => setExpanded((v) => !v)} style={styles.expandBtn}>
            <Text style={styles.expandText}>
              {expanded ? "Hide schedule" : "View full schedule"}
            </Text>
            <Feather
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color="#557417"
            />
          </Pressable>

          {expanded &&
            slots
              .sort((a, b) => a.weekday - b.weekday)
              .map((slot) => (
                <View key={slot.id} style={styles.slotRow}>
                  <Text style={styles.slotDay}>{weekdayLabel(slot.weekday)}</Text>
                  <Text style={styles.slotTime}>
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </Text>
                  <Text style={styles.slotDuration}>{slot.slot_duration_minutes}m</Text>
                </View>
              ))}
        </>
      )}

      {slots.length === 0 && (
        <Text style={styles.noSchedule}>No schedule configured.</Text>
      )}
    </GlassCard>
  );
}

export function ManagerSchedulesScreen() {
  const { accessToken } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);

  const load = useCallback(() => {
    if (!accessToken) return;
    void Promise.all([api.managerSchedules(accessToken), api.listDoctors()])
      .then(([sc, doc]) => {
        setSchedules(sc);
        setDoctors(doc);
      })
      .catch(() => undefined);
  }, [accessToken]);
  useFocusReload(load);

  const grouped = useMemo(
    () =>
      doctors.map((doc) => ({
        doctor: doc,
        slots: schedules.filter((s) => s.doctor_id === doc.id),
      })),
    [doctors, schedules]
  );

  const availableCount = doctors.filter((d) => d.is_available).length;
  const scheduledToday = grouped.filter(({ slots }) =>
    slots.some((s) => s.weekday === todayWeekday())
  ).length;

  return (
    <AppScreen>
      <View style={styles.header}>
        <Text style={styles.title}>Doctor schedules</Text>
        <Text style={styles.subtitle}>Check availability before booking for patients</Text>
      </View>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <GlassCard style={[styles.summaryCard, { backgroundColor: "#EEF7D8" }]}>
          <Text style={[styles.summaryValue, { color: "#557417" }]}>{availableCount}</Text>
          <Text style={styles.summaryLabel}>Available now</Text>
        </GlassCard>
        <GlassCard style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: "#3F6CF6" }]}>{scheduledToday}</Text>
          <Text style={styles.summaryLabel}>Working today</Text>
        </GlassCard>
        <GlassCard style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: "#231F29" }]}>{doctors.length}</Text>
          <Text style={styles.summaryLabel}>Total doctors</Text>
        </GlassCard>
      </View>

      {/* Doctor schedule cards */}
      {grouped.map(({ doctor, slots }) => (
        <DoctorScheduleCard key={doctor.id} doctor={doctor} slots={slots} />
      ))}

      {doctors.length === 0 && (
        <GlassCard>
          <Text style={styles.empty}>No doctors found.</Text>
        </GlassCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 4 },
  title: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  subtitle: { fontSize: 13, color: "#7F7486", marginTop: 4 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, alignItems: "center", paddingVertical: 16 },
  summaryValue: { fontSize: 22, fontWeight: "800" },
  summaryLabel: { fontSize: 10, color: "#7F7486", marginTop: 4, textAlign: "center" },
  docCard: { marginBottom: 4 },
  docHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF7D8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#557417" },
  docName: { fontSize: 15, fontWeight: "800", color: "#231F29" },
  docSpec: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  rightCol: { alignItems: "flex-end", gap: 4 },
  availBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 11, fontWeight: "700" },
  slotCount: { fontSize: 11, color: "#7F7486" },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F7FBEE",
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  todayText: { color: "#557417", fontSize: 13, fontWeight: "600" },
  todayOffText: { color: "#7F7486", fontSize: 13 },
  weekMap: { flexDirection: "row", gap: 6, marginBottom: 4 },
  dayDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F4F8",
    alignItems: "center",
    justifyContent: "center",
  },
  dayDotActive: { backgroundColor: "#DDE8C7" },
  dayDotToday: { backgroundColor: "#8AAF2B" },
  dayDotText: { fontSize: 12, fontWeight: "700", color: "#B0A8B9" },
  dayDotTextActive: { color: "#557417" },
  dayDotTextToday: { color: "#FFF" },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
    alignSelf: "flex-start",
  },
  expandText: { fontSize: 13, color: "#557417", fontWeight: "700" },
  slotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DDE8C7",
  },
  slotDay: { fontWeight: "700", color: "#231F29", width: 36 },
  slotTime: { color: "#231F29", fontSize: 13, flex: 1 },
  slotDuration: { color: "#7F7486", fontSize: 12 },
  noSchedule: { color: "#B0A8B9", fontSize: 13, marginTop: 8 },
  empty: { color: "#7F7486", fontSize: 14 },
});
