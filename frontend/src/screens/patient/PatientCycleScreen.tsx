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
import type { CycleDay, CyclePrediction, MoodStats, Symptom } from "@/types/api";

const moods = ["great", "good", "okay", "bad", "terrible"] as const;
const flowOptions: { key: "none" | "light" | "medium" | "heavy"; color: string }[] = [
  { key: "none", color: "#F0DCE7" },
  { key: "light", color: "#F8B6CF" },
  { key: "medium", color: "#E53F8F" },
  { key: "heavy", color: "#A11D5C" },
];

function getCyclePhase(dayOfCycle: number, cycleLength: number) {
  if (dayOfCycle <= 5) return { name: "Menstrual Phase", color: "#E53F8F" };
  const ovulation = Math.round(cycleLength / 2);
  if (dayOfCycle <= ovulation - 2) return { name: "Follicular Phase", color: "#F8B6CF" };
  if (dayOfCycle <= ovulation + 2) return { name: "Ovulation Phase", color: "#A11D5C" };
  return { name: "Luteal Phase", color: "#E53F8F" };
}

function buildCalendarMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  // weekday for first: 0=Sun, convert to Mon=0
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, month, year };
}

export function PatientCycleScreen() {
  const { accessToken } = useAuth();
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [cycleDays, setCycleDays] = useState<CycleDay[]>([]);
  const [catalog, setCatalog] = useState<Symptom[]>([]);
  const [moodStats, setMoodStats] = useState<MoodStats | null>(null);
  const [tab, setTab] = useState<"overview" | "log" | "mood">("overview");
  const [selectedFlow, setSelectedFlow] = useState<"none" | "light" | "medium" | "heavy">("none");
  const [cycleNotes, setCycleNotes] = useState("");
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [severity, setSeverity] = useState(3);
  const [selectedMood, setSelectedMood] = useState<(typeof moods)[number]>("good");
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [error, setError] = useState("");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [nextPrediction, nextCycleDays, nextCatalog, nextMoodStats] = await Promise.all([
        api.cyclePrediction(accessToken).catch(() => null),
        api.listCycleDays(accessToken),
        api.listSymptomsCatalog(accessToken),
        api.moodStats(accessToken).catch(() => null),
      ]);
      setPrediction(nextPrediction);
      setCycleDays(nextCycleDays);
      setCatalog(nextCatalog.slice(0, 10));
      setMoodStats(nextMoodStats);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cycle view");
    }
  }, [accessToken]);
  useFocusReload(load);

  function shiftMonth(delta: number) {
    setCalMonth((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  async function logCycleDay() {
    if (!accessToken) return;
    await api.createCycleDay(accessToken, {
      date: new Date().toISOString().slice(0, 10),
      flow_intensity: selectedFlow,
      notes: cycleNotes || undefined,
    });
    setCycleNotes("");
    await load();
  }

  async function logSymptom() {
    if (!accessToken || !selectedSymptom) return;
    await api.createPatientSymptom(accessToken, {
      symptom_id: selectedSymptom,
      date: new Date().toISOString().slice(0, 10),
      severity,
    });
    setSelectedSymptom(null);
    await load();
  }

  async function logMood() {
    if (!accessToken) return;
    await api.createMoodEntry(accessToken, {
      date: new Date().toISOString().slice(0, 10),
      mood: selectedMood,
      energy_level: energy,
      stress_level: stress,
      sleep_quality: sleep,
    });
    await load();
  }

  const calendar = useMemo(
    () => buildCalendarMonth(calMonth.year, calMonth.month),
    [calMonth]
  );
  const cycleLength = prediction?.average_cycle_length ?? 28;

  // Map dates → flow intensity for calendar coloring
  const flowByDate = useMemo(() => {
    const map = new Map<string, string>();
    cycleDays.forEach((d) => map.set(d.date, d.flow_intensity));
    return map;
  }, [cycleDays]);

  // Compute current cycle day for ring
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const sortedDays = [...cycleDays].sort((a, b) => a.date.localeCompare(b.date));
  const lastPeriodStart = sortedDays.find((d) => d.flow_intensity !== "none")?.date;
  const dayOfCycle = lastPeriodStart
    ? Math.min(
        cycleLength,
        Math.floor(
          (today.getTime() - new Date(lastPeriodStart).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      )
    : 1;
  const phase = getCyclePhase(dayOfCycle, cycleLength);
  const ringPct = Math.min(1, dayOfCycle / cycleLength);

  const monthLabel = new Date(calMonth.year, calMonth.month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Mood distribution for tiny chart
  const moodDist = moodStats?.mood_distribution ?? {};
  const moodMax = Math.max(1, ...Object.values(moodDist));

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Cycle</Text>
        <View style={styles.bellPill}>
          <Feather name="bell" size={16} color="#E53F8F" />
        </View>
      </View>

      {/* Phase ring hero */}
      <GlassCard style={styles.heroCard}>
        <View style={styles.ring}>
          <View style={[styles.ringFill, { borderColor: phase.color, opacity: 0.25 }]} />
          <View
            style={[
              styles.ringFill,
              {
                borderColor: phase.color,
                borderTopColor: ringPct > 0.25 ? phase.color : "transparent",
                borderRightColor: ringPct > 0.5 ? phase.color : "transparent",
                borderBottomColor: ringPct > 0.75 ? phase.color : "transparent",
                borderLeftColor: ringPct > 0 ? phase.color : "transparent",
              },
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>Current Phase</Text>
          <Text style={styles.heroPhase}>{phase.name}</Text>
          <Text style={styles.heroDay}>
            Day {dayOfCycle} of {cycleLength}
          </Text>
        </View>
      </GlassCard>

      {/* Stat row: regularity + stress */}
      <View style={styles.statRow}>
        <GlassCard style={[styles.statCard, { backgroundColor: "#FCE4EF" }]}>
          <Feather name="droplet" size={20} color="#E53F8F" />
          <Text style={styles.statLabel}>Regularity</Text>
          <Text style={styles.statValue}>
            {prediction ? "Good" : "—"}
          </Text>
        </GlassCard>
        <GlassCard style={[styles.statCard, { backgroundColor: "#FCE4EF" }]}>
          <Feather name="meh" size={20} color="#E53F8F" />
          <Text style={styles.statLabel}>Stress</Text>
          <Text style={styles.statValue}>
            {moodStats?.average_stress
              ? moodStats.average_stress < 2.5
                ? "Low"
                : moodStats.average_stress < 3.5
                ? "Med"
                : "High"
              : "—"}
          </Text>
        </GlassCard>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        {(["overview", "log", "mood"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "overview" ? "Calendar" : t === "log" ? "Log" : "Mood"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "overview" && (
        <GlassCard>
          <View style={styles.calHeader}>
            <Pressable onPress={() => shiftMonth(-1)} style={styles.calNavBtn}>
              <Feather name="chevron-left" size={18} color="#E53F8F" />
            </Pressable>
            <Text style={styles.cardTitle}>{monthLabel}</Text>
            <Pressable onPress={() => shiftMonth(1)} style={styles.calNavBtn}>
              <Feather name="chevron-right" size={18} color="#E53F8F" />
            </Pressable>
          </View>
          <View style={styles.weekHeader}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <Text key={i} style={styles.weekHeaderCell}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendar.cells.map((day, idx) => {
              if (!day) return <View key={idx} style={styles.dayCell} />;
              const dateKey = `${calendar.year}-${String(calendar.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const flow = flowByDate.get(dateKey);
              const isToday = dateKey === todayKey;
              const flowColor = flow === "heavy"
                ? "#A11D5C"
                : flow === "medium"
                ? "#E53F8F"
                : flow === "light"
                ? "#F8B6CF"
                : null;
              return (
                <View key={idx} style={styles.dayCell}>
                  <View
                    style={[
                      styles.dayInner,
                      flowColor && { backgroundColor: flowColor },
                      isToday && !flowColor && styles.dayToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        flowColor && styles.dayTextLight,
                        isToday && !flowColor && styles.dayTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.legendRow}>
            {flowOptions.map((f) => (
              <View key={f.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: f.color }]} />
                <Text style={styles.legendText}>{f.key}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      {tab === "log" && (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>Log today's flow</Text>
            <View style={styles.flowRow}>
              {flowOptions.map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => setSelectedFlow(f.key)}
                  style={[
                    styles.flowDot,
                    { borderColor: f.color },
                    selectedFlow === f.key && { backgroundColor: f.color },
                  ]}
                >
                  <Text
                    style={[
                      styles.flowText,
                      selectedFlow === f.key && styles.flowTextActive,
                    ]}
                  >
                    {f.key}
                  </Text>
                </Pressable>
              ))}
            </View>
            <AppInput label="Notes" value={cycleNotes} onChangeText={setCycleNotes} />
            <PrimaryButton label="Save cycle log" onPress={logCycleDay} />
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Log symptom</Text>
            <View style={styles.chipRow}>
              {catalog.map((symptom) => (
                <Pressable
                  key={symptom.id}
                  onPress={() => setSelectedSymptom(symptom.id)}
                  style={[styles.chip, selectedSymptom === symptom.id && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedSymptom === symptom.id && styles.chipTextActive,
                    ]}
                  >
                    {symptom.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.cardLabel}>Severity: {severity}</Text>
            <View style={styles.severityRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSeverity(s)}
                  style={[styles.sevDot, severity >= s && styles.sevDotActive]}
                />
              ))}
            </View>
            <PrimaryButton label="Save symptom" onPress={logSymptom} disabled={!selectedSymptom} />
          </GlassCard>
        </>
      )}

      {tab === "mood" && (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>Mood Report</Text>
            <View style={styles.moodChart}>
              {moods.map((m) => {
                const count = moodDist[m] || 0;
                const heightPct = (count / moodMax) * 100;
                return (
                  <View key={m} style={styles.barWrap}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${heightPct}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{m.slice(0, 3)}</Text>
                    <Text style={styles.barValue}>{count}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.miniStatRow}>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatLabel}>Energy</Text>
                <Text style={styles.miniStatValue}>
                  {moodStats?.average_energy?.toFixed(1) ?? "--"}
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatLabel}>Stress</Text>
                <Text style={styles.miniStatValue}>
                  {moodStats?.average_stress?.toFixed(1) ?? "--"}
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatLabel}>Sleep</Text>
                <Text style={styles.miniStatValue}>
                  {moodStats?.average_sleep?.toFixed(1) ?? "--"}
                </Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>How are you feeling?</Text>
            <View style={styles.chipRow}>
              {moods.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setSelectedMood(m)}
                  style={[styles.chip, selectedMood === m && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedMood === m && styles.chipTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.cardLabel}>Energy: {energy}</Text>
            <View style={styles.severityRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setEnergy(s)}
                  style={[styles.sevDot, energy >= s && styles.sevDotActive]}
                />
              ))}
            </View>
            <Text style={styles.cardLabel}>Stress: {stress}</Text>
            <View style={styles.severityRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setStress(s)}
                  style={[styles.sevDot, stress >= s && styles.sevDotActive]}
                />
              ))}
            </View>
            <Text style={styles.cardLabel}>Sleep: {sleep}</Text>
            <View style={styles.severityRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSleep(s)}
                  style={[styles.sevDot, sleep >= s && styles.sevDotActive]}
                />
              ))}
            </View>
            <PrimaryButton label="Save mood" onPress={logMood} />
          </GlassCard>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  bellPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#FCE4EF",
  },
  ring: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  ringFill: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
  },
  heroEyebrow: { fontSize: 12, color: "#A94D7A", fontWeight: "700" },
  heroPhase: { fontSize: 20, fontWeight: "800", color: "#231F29", marginTop: 4 },
  heroDay: { fontSize: 12, color: "#7F7486", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, alignItems: "flex-start", gap: 6 },
  statLabel: { fontSize: 12, color: "#7F7486" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#231F29" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFF6FA",
    borderRadius: 999,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabActive: { backgroundColor: "#E53F8F" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#7F7486" },
  tabTextActive: { color: "#FFFFFF" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#231F29", marginBottom: 12 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: { fontSize: 13, color: "#7F7486", fontWeight: "600", marginTop: 8, marginBottom: 6 },
  weekHeader: { flexDirection: "row", marginBottom: 8 },
  weekHeaderCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: "#7F7486",
    fontWeight: "700",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayInner: {
    flex: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayToday: { borderWidth: 1.5, borderColor: "#E53F8F" },
  dayText: { fontSize: 12, color: "#231F29", fontWeight: "600" },
  dayTextLight: { color: "#FFFFFF" },
  dayTextToday: { color: "#E53F8F", fontWeight: "800" },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: "#7F7486", textTransform: "capitalize" },
  flowRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  flowDot: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
  },
  flowText: { fontSize: 12, fontWeight: "700", color: "#231F29", textTransform: "capitalize" },
  flowTextActive: { color: "#FFFFFF" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFF6FA",
    borderWidth: 1,
    borderColor: "#F0DCE7",
  },
  chipActive: { backgroundColor: "#E53F8F", borderColor: "#E53F8F" },
  chipText: { color: "#7F7486", fontWeight: "600", textTransform: "capitalize", fontSize: 12 },
  chipTextActive: { color: "#FFFFFF" },
  severityRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  sevDot: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F0DCE7",
  },
  sevDotActive: { backgroundColor: "#E53F8F" },
  moodChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 140,
    marginBottom: 12,
  },
  barWrap: { alignItems: "center", gap: 4, flex: 1 },
  barTrack: {
    width: 22,
    height: 100,
    backgroundColor: "#FCE4EF",
    borderRadius: 11,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", backgroundColor: "#E53F8F", borderRadius: 11 },
  barLabel: { fontSize: 10, color: "#7F7486", textTransform: "capitalize" },
  barValue: { fontSize: 10, color: "#231F29", fontWeight: "700" },
  miniStatRow: { flexDirection: "row", gap: 8 },
  miniStat: {
    flex: 1,
    backgroundColor: "#FFF6FA",
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  miniStatLabel: { fontSize: 11, color: "#7F7486" },
  miniStatValue: { fontSize: 16, fontWeight: "800", color: "#E53F8F", marginTop: 2 },
  error: { color: "#E25555" },
});
