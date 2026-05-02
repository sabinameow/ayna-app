import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import { saveFeedbackLabel, useSaveFeedback } from "@/hooks/useSaveFeedback";
import type { DoctorAvailabilitySlot } from "@/types/api";

type EditableDay = {
  date: string;
  shortLabel: string;
  titleLabel: string;
  subtitleLabel: string;
  active: boolean;
  startTime: string;
  endTime: string;
  durationMinutes: string;
  existingSlots: DoctorAvailabilitySlot[];
};

function buildWorkweek(base: Date) {
  const dates: EditableDay[] = [];
  const cursor = new Date(base);

  while (dates.length < 5) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) {
      dates.push({
        date: cursor.toISOString().slice(0, 10),
        shortLabel: cursor.toLocaleString("en-US", { weekday: "short" }).charAt(0),
        titleLabel: cursor.toLocaleString("en-US", { weekday: "short" }),
        subtitleLabel: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        active: false,
        startTime: "09:00",
        endTime: "17:00",
        durationMinutes: "30",
        existingSlots: [],
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function minutesFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.NaN;
  return hour * 60 + minute;
}

function timeFromMinutes(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function slotKey(startTime: string, endTime: string) {
  return `${startTime.slice(0, 5)}-${endTime.slice(0, 5)}`;
}

function inferDuration(slots: DoctorAvailabilitySlot[]) {
  if (!slots.length) return "30";
  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
  if (sorted.length > 1) {
    const diff =
      minutesFromTime(sorted[1].start_time.slice(0, 5)) -
      minutesFromTime(sorted[0].start_time.slice(0, 5));
    if (diff > 0) return String(diff);
  }
  const first =
    minutesFromTime(sorted[0].end_time.slice(0, 5)) -
    minutesFromTime(sorted[0].start_time.slice(0, 5));
  return first > 0 ? String(first) : "30";
}

function buildEditableDays(
  template: EditableDay[],
  availability: DoctorAvailabilitySlot[]
) {
  return template.map((day) => {
    const daySlots = availability
      .filter((slot) => slot.date === day.date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (!daySlots.length) {
      return day;
    }

    return {
      ...day,
      active: true,
      startTime: daySlots[0].start_time.slice(0, 5),
      endTime: daySlots[daySlots.length - 1].end_time.slice(0, 5),
      durationMinutes: inferDuration(daySlots),
      existingSlots: daySlots,
    };
  });
}

function buildDesiredIntervals(day: EditableDay) {
  if (!day.active) return [] as { start: string; end: string }[];

  const start = minutesFromTime(day.startTime);
  const end = minutesFromTime(day.endTime);
  const duration = Number(day.durationMinutes);

  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(duration)) {
    throw new Error(`Invalid time format for ${day.titleLabel}`);
  }
  if (duration <= 0) {
    throw new Error(`Duration must be greater than 0 for ${day.titleLabel}`);
  }
  if (end <= start) {
    throw new Error(`End time must be after start time for ${day.titleLabel}`);
  }

  const intervals: { start: string; end: string }[] = [];
  for (let cursor = start; cursor + duration <= end; cursor += duration) {
    intervals.push({
      start: `${timeFromMinutes(cursor)}:00`,
      end: `${timeFromMinutes(cursor + duration)}:00`,
    });
  }

  if (!intervals.length) {
    throw new Error(`No slots fit inside ${day.titleLabel}'s range`);
  }

  return intervals;
}

export function DoctorScheduleScreen() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const workweek = useMemo(() => buildWorkweek(new Date()), []);
  const [days, setDays] = useState<EditableDay[]>(workweek);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const saveFeedback = useSaveFeedback();

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const availability = await api.doctorAvailability(accessToken);
      setDays(buildEditableDays(workweek, availability));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load available slots");
    } finally {
      setLoading(false);
    }
  }, [accessToken, workweek]);

  useFocusReload(load);

  const activeCount = useMemo(
    () => days.filter((day) => day.active).length,
    [days]
  );

  function updateDay(date: string, patch: Partial<EditableDay>) {
    setDays((current) =>
      current.map((day) => (day.date === date ? { ...day, ...patch } : day))
    );
  }

  function toggleDay(day: EditableDay) {
    const hasBooked = day.existingSlots.some((slot) => slot.is_booked);
    if (hasBooked && day.active) {
      setError("Booked slots keep this day active until the appointment is resolved.");
      showToast("Booked slots cannot be turned off", "error");
      return;
    }
    updateDay(day.date, { active: !day.active });
  }

  async function saveSchedule() {
    if (!accessToken || saving) return;
    setSaving(true);
    saveFeedback.markSaving();
    setError("");
    try {
      for (const day of days) {
        const hasBooked = day.existingSlots.some((slot) => slot.is_booked);
        if (hasBooked) {
          continue;
        }

        const desired = buildDesiredIntervals(day);
        const desiredKeys = new Set(desired.map((slot) => slotKey(slot.start, slot.end)));

        for (const slot of day.existingSlots) {
          const key = slotKey(slot.start_time, slot.end_time);
          const shouldDelete = !slot.is_booked && !desiredKeys.has(key);
          if (shouldDelete) {
            await api.deleteDoctorAvailability(accessToken, slot.id);
          }
        }

        if (!day.active) {
          continue;
        }

        const existingKeys = new Set(
          day.existingSlots.map((slot) => slotKey(slot.start_time, slot.end_time))
        );

        for (const slot of desired) {
          if (existingKeys.has(slotKey(slot.start, slot.end))) continue;
          await api.createDoctorAvailability(accessToken, {
            date: day.date,
            start_time: slot.start,
            end_time: slot.end,
          });
        }
      }

      await load();
      saveFeedback.markSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save schedule";
      setError(message);
      saveFeedback.markError();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <View style={styles.header}>
        <Text style={styles.title}>My schedule</Text>
        <Text style={styles.subtitle}>
          {loading
            ? "Loading your week"
            : `${activeCount} active day${activeCount === 1 ? "" : "s"} per week`}
        </Text>
      </View>

      <View style={styles.weekRow}>
        {days.map((day) => (
          <Pressable
            key={day.date}
            onPress={() => toggleDay(day)}
            style={[styles.dayPill, day.active && styles.dayPillActive]}
          >
            <Text style={[styles.dayPillText, day.active && styles.dayPillTextActive]}>
              {day.shortLabel}
            </Text>
          </Pressable>
        ))}
      </View>

      {days.map((day) => {
        const hasBooked = day.existingSlots.some((slot) => slot.is_booked);
        return (
          <GlassCard
            key={day.date}
            style={[styles.dayCard, !day.active && styles.dayCardInactive]}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>{day.titleLabel}</Text>
                <Text style={styles.cardMeta}>
                  {day.active
                    ? `${day.subtitleLabel} · ${day.startTime} – ${day.endTime} · ${day.durationMinutes}min slots`
                    : `${day.subtitleLabel} · Not available`}
                </Text>
                {hasBooked ? (
                  <Text style={styles.bookedHint}>Booked slots lock this day until completed.</Text>
                ) : null}
              </View>
              <Switch
                value={day.active}
                onValueChange={() => toggleDay(day)}
                disabled={hasBooked && day.active}
                trackColor={{ false: "#E8E4F8", true: "#3F63F6" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {day.active ? (
              <View style={styles.inputsRow}>
                <View style={styles.inputWrap}>
                  <AppInput
                    label="Start"
                    value={day.startTime}
                    editable={!hasBooked}
                    onChangeText={(value) => updateDay(day.date, { startTime: value })}
                  />
                </View>
                <View style={styles.inputWrap}>
                  <AppInput
                    label="End"
                    value={day.endTime}
                    editable={!hasBooked}
                    onChangeText={(value) => updateDay(day.date, { endTime: value })}
                  />
                </View>
                <View style={styles.inputWrap}>
                  <AppInput
                    label="Mins"
                    keyboardType="number-pad"
                    value={day.durationMinutes}
                    editable={!hasBooked}
                    onChangeText={(value) => updateDay(day.date, { durationMinutes: value })}
                  />
                </View>
              </View>
            ) : null}
          </GlassCard>
        );
      })}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={saveFeedbackLabel(saveFeedback.status, "Save schedule")}
        onPress={saveSchedule}
        disabled={saving}
        feedbackStatus={saveFeedback.status}
        style={styles.saveButton}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#231F29",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#8A7E94",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  dayPill: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F4F1FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0D8F7",
  },
  dayPillActive: {
    backgroundColor: "#3F63F6",
    borderColor: "#3F63F6",
  },
  dayPillText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#7E75A0",
  },
  dayPillTextActive: {
    color: "#FFFFFF",
  },
  dayCard: {
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 14,
  },
  dayCardInactive: {
    opacity: 0.72,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#231F29",
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#8A7E94",
  },
  bookedHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#9B5E11",
  },
  inputsRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputWrap: {
    flex: 1,
  },
  error: {
    color: "#E25555",
    fontSize: 13,
    fontWeight: "600",
  },
  saveButton: {
    marginTop: 4,
    backgroundColor: "#3F63F6",
  },
});
