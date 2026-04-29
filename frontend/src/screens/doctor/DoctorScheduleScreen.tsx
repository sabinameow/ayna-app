import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import { weekdayLabel } from "@/utils/format";

type EditableSlot = {
  weekday: number;
  active: boolean;
  start_time: string;
  end_time: string;
  slot_duration_minutes: string;
};

export function DoctorScheduleScreen() {
  const { accessToken } = useAuth();
  const [slots, setSlots] = useState<EditableSlot[]>(
    Array.from({ length: 5 }, (_, weekday) => ({
      weekday,
      active: weekday !== 2,
      start_time: "09:00",
      end_time: "17:00",
      slot_duration_minutes: "30",
    }))
  );
  const [saved, setSaved] = useState(false);

  const loadSchedule = useCallback(() => {
    if (!accessToken) return;
    void api
      .doctorSchedule(accessToken)
      .then((existing) => {
        if (!existing.length) return;
        setSlots(
          Array.from({ length: 5 }, (_, weekday) => {
            const match = existing.find((s) => s.weekday === weekday);
            return {
              weekday,
              active: Boolean(match),
              start_time: match?.start_time?.slice(0, 5) || "09:00",
              end_time: match?.end_time?.slice(0, 5) || "17:00",
              slot_duration_minutes: String(match?.slot_duration_minutes ?? 30),
            };
          })
        );
      })
      .catch(() => undefined);
  }, [accessToken]);
  useFocusReload(loadSchedule);

  const payload = useMemo(
    () =>
      slots
        .filter((s) => s.active)
        .map((s) => ({
          weekday: s.weekday,
          start_time: `${s.start_time}:00`,
          end_time: `${s.end_time}:00`,
          slot_duration_minutes: Number(s.slot_duration_minutes),
        })),
    [slots]
  );

  function toggleDay(weekday: number) {
    setSlots((prev) =>
      prev.map((s) => (s.weekday === weekday ? { ...s, active: !s.active } : s))
    );
  }

  function updateSlot(weekday: number, key: keyof EditableSlot, value: string) {
    setSlots((prev) =>
      prev.map((s) => (s.weekday === weekday ? { ...s, [key]: value } : s))
    );
  }

  async function save() {
    if (!accessToken) return;
    await api.updateDoctorSchedule(accessToken, payload);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const activeCount = slots.filter((s) => s.active).length;

  return (
    <AppScreen>
      <View style={styles.header}>
        <Text style={styles.title}>My schedule</Text>
        <Text style={styles.subtitle}>
          {activeCount} active day{activeCount !== 1 ? "s" : ""} per week
        </Text>
      </View>

      {/* Week summary */}
      <View style={styles.weekRow}>
        {slots.map((slot) => (
          <Pressable
            key={slot.weekday}
            onPress={() => toggleDay(slot.weekday)}
            style={[styles.dayPill, slot.active && styles.dayPillActive]}
          >
            <Text style={[styles.dayPillText, slot.active && styles.dayPillTextActive]}>
              {weekdayLabel(slot.weekday).charAt(0)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Slot editors */}
      {slots.map((slot) => (
        <GlassCard
          key={slot.weekday}
          style={[styles.slotCard, !slot.active && styles.slotCardOff]}
        >
          <View style={styles.slotHeader}>
            <View>
              <Text style={styles.dayLabel}>{weekdayLabel(slot.weekday)}</Text>
              {slot.active ? (
                <Text style={styles.slotMeta}>
                  {slot.start_time} – {slot.end_time} · {slot.slot_duration_minutes}min slots
                </Text>
              ) : (
                <Text style={styles.offMeta}>Not available</Text>
              )}
            </View>
            <Pressable
              onPress={() => toggleDay(slot.weekday)}
              style={[styles.toggle, slot.active && styles.toggleActive]}
            >
              <View style={[styles.toggleDot, slot.active && styles.toggleDotActive]} />
            </Pressable>
          </View>

          {slot.active && (
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Start"
                  value={slot.start_time}
                  onChangeText={(v) => updateSlot(slot.weekday, "start_time", v)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="End"
                  value={slot.end_time}
                  onChangeText={(v) => updateSlot(slot.weekday, "end_time", v)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Mins"
                  keyboardType="number-pad"
                  value={slot.slot_duration_minutes}
                  onChangeText={(v) => updateSlot(slot.weekday, "slot_duration_minutes", v)}
                />
              </View>
            </View>
          )}
        </GlassCard>
      ))}

      <PrimaryButton
        label={saved ? "Schedule saved!" : "Save schedule"}
        onPress={save}
        style={[styles.saveBtn, saved && styles.saveBtnDone]}
      />

      {activeCount > 0 && (
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Feather name="info" size={14} color="#3F6CF6" />
            <Text style={styles.summaryTitle}>Active schedule</Text>
          </View>
          {slots
            .filter((s) => s.active)
            .map((s) => (
              <View key={s.weekday} style={styles.summaryRow}>
                <Text style={styles.summaryDay}>{weekdayLabel(s.weekday)}</Text>
                <Text style={styles.summaryTime}>
                  {s.start_time} – {s.end_time}
                </Text>
                <Text style={styles.summarySlots}>{s.slot_duration_minutes}m slots</Text>
              </View>
            ))}
        </GlassCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  subtitle: { fontSize: 13, color: "#7F7486", marginTop: 4 },
  weekRow: { flexDirection: "row", gap: 10, marginBottom: 20, justifyContent: "center" },
  dayPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F4F8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D9E1FF",
  },
  dayPillActive: { backgroundColor: "#3F6CF6", borderColor: "#3F6CF6" },
  dayPillText: { fontSize: 14, fontWeight: "800", color: "#7F7486" },
  dayPillTextActive: { color: "#FFF" },
  slotCard: { marginBottom: 12 },
  slotCardOff: { opacity: 0.6 },
  slotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  dayLabel: { fontSize: 17, fontWeight: "800", color: "#231F29" },
  slotMeta: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  offMeta: { fontSize: 12, color: "#B0A8B9", marginTop: 2 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#D9E1FF",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleActive: { backgroundColor: "#3F6CF6" },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  toggleDotActive: { alignSelf: "flex-end" },
  timeRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  saveBtn: { backgroundColor: "#3F6CF6", marginTop: 4 },
  saveBtnDone: { backgroundColor: "#38A169" },
  summaryCard: { backgroundColor: "#EAF0FF", marginTop: 4 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  summaryTitle: { fontSize: 14, fontWeight: "700", color: "#3356C4" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C4D3FF",
  },
  summaryDay: { fontWeight: "700", color: "#231F29", width: 40 },
  summaryTime: { color: "#231F29", fontSize: 13, flex: 1, textAlign: "center" },
  summarySlots: { color: "#7F7486", fontSize: 12 },
});
