import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import type { CycleDay, CyclePrediction, MoodStats, Symptom } from "@/types/api";

const PERIOD_COLOR = "#E53F8F";
const PERIOD_LIGHT = "#F8B6CF";
const PERIOD_DARK = "#A11D5C";
const PERIOD_BG = "#FCE4EF";

const moods = ["great", "good", "okay", "bad", "terrible"] as const;
const flowOptions: { key: "none" | "light" | "medium" | "heavy"; color: string }[] = [
  { key: "none", color: "#F0DCE7" },
  { key: "light", color: PERIOD_LIGHT },
  { key: "medium", color: PERIOD_COLOR },
  { key: "heavy", color: PERIOD_DARK },
];

function getCyclePhase(dayOfCycle: number, cycleLength: number) {
  if (dayOfCycle <= 5) return { name: "Menstrual Phase", color: PERIOD_COLOR };
  const ovulation = Math.round(cycleLength / 2);
  if (dayOfCycle <= ovulation - 2) return { name: "Follicular Phase", color: PERIOD_LIGHT };
  if (dayOfCycle <= ovulation + 2) return { name: "Ovulation Phase", color: PERIOD_DARK };
  return { name: "Luteal Phase", color: PERIOD_COLOR };
}

function buildCalendarMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, month, year };
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function flowForDay(i: number, total: number): "light" | "medium" | "heavy" {
  if (i <= 1) return "heavy";
  if (i >= total - 2) return "light";
  return "medium";
}

function findPeriodRange(
  date: string,
  flowByDate: Map<string, string>
): { start: string; end: string; length: number } {
  let start = date;
  let end = date;
  let check = addDays(start, -1);
  while (flowByDate.has(check) && flowByDate.get(check) !== "none") {
    start = check;
    check = addDays(start, -1);
  }
  check = addDays(end, 1);
  while (flowByDate.has(check) && flowByDate.get(check) !== "none") {
    end = check;
    check = addDays(end, 1);
  }
  const startD = new Date(start + "T12:00:00");
  const endD = new Date(end + "T12:00:00");
  const length = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
  return { start, end, length };
}

function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric" });
}

type SheetMode = "log" | "edit";

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

  // Bottom sheet state
  const [sheet, setSheet] = useState<{
    visible: boolean;
    mode: SheetMode;
    date: string;
    duration: number;
    rangeStart?: string;
    rangeEnd?: string;
    rangeLength?: number;
  }>({ visible: false, mode: "log", date: "", duration: 5 });

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [nextPrediction, nextCycleDays, nextCatalog, nextMoodStats] = await Promise.all([
        api.cyclePrediction(accessToken).catch(() => null),
        api.listCycleDays(accessToken, calMonth.month + 1, calMonth.year),
        api.listSymptomsCatalog(accessToken),
        api.moodStats(accessToken).catch(() => null),
      ]);
      setPrediction(nextPrediction);
      setCycleDays(nextCycleDays);
      setCatalog(nextCatalog.slice(0, 10));
      setMoodStats(nextMoodStats);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cycle data");
    }
  }, [accessToken, calMonth]);
  // Use primitive deps so effect only fires when values actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [accessToken, calMonth.year, calMonth.month]);

  const flowByDate = useMemo(() => {
    const map = new Map<string, string>();
    cycleDays.forEach((d) => map.set(d.date, d.flow_intensity));
    return map;
  }, [cycleDays]);

  function applyPreview(date: string, duration: number) {
    setCycleDays((prev) => {
      const map = new Map(prev.map((d) => [d.date, d]));
      for (let i = 0; i < duration; i++) {
        const d = addDays(date, i);
        map.set(d, { id: `preview-${d}`, patient_id: "", date: d, flow_intensity: flowForDay(i, duration) });
      }
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  function removePreview(date: string, duration: number) {
    const dates = new Set(Array.from({ length: duration }, (_, i) => addDays(date, i)));
    setCycleDays((prev) => prev.filter((d) => !dates.has(d.date) || !d.id.startsWith("preview-")));
  }

  function openSheet(dateKey: string) {
    const flow = flowByDate.get(dateKey);
    const marked = !!flow && flow !== "none";
    if (marked) {
      const range = findPeriodRange(dateKey, flowByDate);
      setSheet({ visible: true, mode: "edit", date: dateKey, duration: range.length, rangeStart: range.start, rangeEnd: range.end, rangeLength: range.length });
    } else {
      // Show preview immediately on tap
      applyPreview(dateKey, 5);
      setSheet({ visible: true, mode: "log", date: dateKey, duration: 5 });
    }
  }

  function closeSheet() {
    // Remove preview if user cancels
    if (sheet.mode === "log") removePreview(sheet.date, sheet.duration);
    setSheet((s) => ({ ...s, visible: false }));
  }

  async function confirmLogPeriod() {
    if (!accessToken) return;
    const { date, duration } = sheet;

    // Preview is already showing — just close sheet and save in background
    setSheet((s) => ({ ...s, visible: false }));

    try {
      const saved = await api.logPeriod(accessToken, date, duration);
      // Swap preview entries for real DB entries
      setCycleDays((prev) => {
        const map = new Map(prev.map((d) => [d.date, d]));
        saved.forEach((d) => map.set(d.date, d));
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      });
    } catch {
      // Save failed — remove preview
      removePreview(date, duration);
      setError("Failed to save. Please try again.");
    }
  }

  async function confirmDeletePeriod() {
    if (!accessToken || !sheet.rangeStart || !sheet.rangeEnd) return;
    const { rangeStart, rangeEnd } = sheet;
    const rollback = cycleDays;

    setCycleDays((prev) => prev.filter((d) => d.date < rangeStart || d.date > rangeEnd));
    closeSheet();

    try {
      await api.deleteCycleDaysRange(accessToken, rangeStart, rangeEnd);
      void load();
    } catch {
      setCycleDays(rollback);
      setError("Failed to delete. Please try again.");
    }
  }

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

  const calendar = useMemo(() => buildCalendarMonth(calMonth.year, calMonth.month), [calMonth]);
  const cycleLength = prediction?.average_cycle_length ?? 28;

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const sortedDays = [...cycleDays].sort((a, b) => a.date.localeCompare(b.date));
  const lastPeriodStart = sortedDays.find((d) => d.flow_intensity !== "none")?.date;
  const dayOfCycle = lastPeriodStart
    ? Math.min(
        cycleLength,
        Math.floor((today.getTime() - new Date(lastPeriodStart + "T12:00:00").getTime()) / 86400000) + 1
      )
    : 1;
  const phase = getCyclePhase(dayOfCycle, cycleLength);
  const ringPct = Math.min(1, dayOfCycle / cycleLength);
  const monthLabel = new Date(calMonth.year, calMonth.month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const moodDist = moodStats?.mood_distribution ?? {};
  const moodMax = Math.max(1, ...Object.values(moodDist));

  // Preview dots for log sheet
  const previewDots = Array.from({ length: sheet.duration }, (_, i) => {
    const f = flowForDay(i, sheet.duration);
    return f === "heavy" ? PERIOD_DARK : f === "medium" ? PERIOD_COLOR : PERIOD_LIGHT;
  });

  return (
    <View style={{ flex: 1 }}>
    <AppScreen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Cycle</Text>
        <View style={styles.bellPill}>
          <Feather name="bell" size={16} color={PERIOD_COLOR} />
        </View>
      </View>

      <GlassCard style={styles.heroCard}>
        <View style={styles.ring}>
          <View style={[styles.ringFill, { borderColor: phase.color, opacity: 0.25 }]} />
          <View style={[styles.ringFill, {
            borderColor: phase.color,
            borderTopColor: ringPct > 0.25 ? phase.color : "transparent",
            borderRightColor: ringPct > 0.5 ? phase.color : "transparent",
            borderBottomColor: ringPct > 0.75 ? phase.color : "transparent",
            borderLeftColor: ringPct > 0 ? phase.color : "transparent",
          }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>Current Phase</Text>
          <Text style={styles.heroPhase}>{phase.name}</Text>
          <Text style={styles.heroDay}>Day {dayOfCycle} of {cycleLength}</Text>
        </View>
      </GlassCard>

      <View style={styles.statRow}>
        <GlassCard style={[styles.statCard, { backgroundColor: PERIOD_BG }]}>
          <Feather name="droplet" size={20} color={PERIOD_COLOR} />
          <Text style={styles.statLabel}>Regularity</Text>
          <Text style={styles.statValue}>{prediction ? "Good" : "—"}</Text>
        </GlassCard>
        <GlassCard style={[styles.statCard, { backgroundColor: PERIOD_BG }]}>
          <Feather name="meh" size={20} color={PERIOD_COLOR} />
          <Text style={styles.statLabel}>Stress</Text>
          <Text style={styles.statValue}>
            {moodStats?.average_stress
              ? moodStats.average_stress < 2.5 ? "Low" : moodStats.average_stress < 3.5 ? "Med" : "High"
              : "—"}
          </Text>
        </GlassCard>
      </View>

      <View style={styles.tabBar}>
        {(["overview", "log", "mood"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
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
              <Feather name="chevron-left" size={18} color={PERIOD_COLOR} />
            </Pressable>
            <Text style={styles.cardTitle}>{monthLabel}</Text>
            <Pressable onPress={() => shiftMonth(1)} style={styles.calNavBtn}>
              <Feather name="chevron-right" size={18} color={PERIOD_COLOR} />
            </Pressable>
          </View>
          <View style={styles.weekHeader}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <Text key={i} style={styles.weekHeaderCell}>{d}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendar.cells.map((day, idx) => {
              if (!day) return <View key={idx} style={styles.dayCell} />;
              const dateKey = `${calendar.year}-${String(calendar.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const flow = flowByDate.get(dateKey);
              const hasFlow = !!flow && flow !== "none";
              const isToday = dateKey === todayKey;
              const colIdx = idx % 7;

              const hasPrev = hasFlow
                && flowByDate.has(addDays(dateKey, -1))
                && flowByDate.get(addDays(dateKey, -1)) !== "none"
                && colIdx > 0;
              const hasNext = hasFlow
                && flowByDate.has(addDays(dateKey, 1))
                && flowByDate.get(addDays(dateKey, 1)) !== "none"
                && colIdx < 6;

              const circleColor = flow === "heavy" ? PERIOD_DARK
                : flow === "medium" ? PERIOD_COLOR
                : flow === "light" ? PERIOD_LIGHT
                : null;

              return (
                <Pressable key={idx} style={styles.dayCell} onPress={() => openSheet(dateKey)}>
                  {hasFlow && (
                    <View style={[
                      styles.rangeStrip,
                      !hasPrev && styles.rangeStripStart,
                      !hasNext && styles.rangeStripEnd,
                    ]} />
                  )}
                  <View style={[
                    styles.dayInner,
                    circleColor ? { backgroundColor: circleColor } : null,
                    isToday && !circleColor && styles.dayToday,
                  ]}>
                    <Text style={[
                      styles.dayText,
                      circleColor && styles.dayTextLight,
                      isToday && !circleColor && styles.dayTextToday,
                    ]}>
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.hintRow}>
            <Feather name="info" size={12} color="#B09ABF" />
            <Text style={styles.hintText}>Tap any date to log period · Tap marked day to edit</Text>
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
                  style={[styles.flowDot, { borderColor: f.color }, selectedFlow === f.key && { backgroundColor: f.color }]}
                >
                  <Text style={[styles.flowText, selectedFlow === f.key && styles.flowTextActive]}>{f.key}</Text>
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
                  <Text style={[styles.chipText, selectedSymptom === symptom.id && styles.chipTextActive]}>
                    {symptom.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.cardLabel}>Severity: {severity}</Text>
            <View style={styles.severityRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} onPress={() => setSeverity(s)} style={[styles.sevDot, severity >= s && styles.sevDotActive]} />
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
                return (
                  <View key={m} style={styles.barWrap}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${(count / moodMax) * 100}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{m.slice(0, 3)}</Text>
                    <Text style={styles.barValue}>{count}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.miniStatRow}>
              {[
                { label: "Energy", val: moodStats?.average_energy },
                { label: "Stress", val: moodStats?.average_stress },
                { label: "Sleep", val: moodStats?.average_sleep },
              ].map(({ label, val }) => (
                <View key={label} style={styles.miniStat}>
                  <Text style={styles.miniStatLabel}>{label}</Text>
                  <Text style={styles.miniStatValue}>{val?.toFixed(1) ?? "--"}</Text>
                </View>
              ))}
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>How are you feeling?</Text>
            <View style={styles.chipRow}>
              {moods.map((m) => (
                <Pressable key={m} onPress={() => setSelectedMood(m)} style={[styles.chip, selectedMood === m && styles.chipActive]}>
                  <Text style={[styles.chipText, selectedMood === m && styles.chipTextActive]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            {[
              { label: "Energy", val: energy, set: setEnergy },
              { label: "Stress", val: stress, set: setStress },
              { label: "Sleep", val: sleep, set: setSleep },
            ].map(({ label, val, set }) => (
              <React.Fragment key={label}>
                <Text style={styles.cardLabel}>{label}: {val}</Text>
                <View style={styles.severityRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Pressable key={s} onPress={() => set(s)} style={[styles.sevDot, val >= s && styles.sevDotActive]} />
                  ))}
                </View>
              </React.Fragment>
            ))}
            <PrimaryButton label="Save mood" onPress={logMood} />
          </GlassCard>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>

    {/* Bottom sheet — plain View to avoid Modal focus events triggering reload */}
    {sheet.visible && (
      <View style={styles.overlayWrap}>
        <Pressable style={styles.overlayBg} onPress={closeSheet} />
        <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {sheet.mode === "log" ? (
              <>
                <Text style={styles.sheetTitle}>Log period</Text>
                <Text style={styles.sheetDate}>
                  {sheet.date ? formatDate(sheet.date, { weekday: "long", month: "long", day: "numeric" }) : ""}
                </Text>

                <Text style={styles.sheetLabel}>Duration</Text>
                <View style={styles.durationRow}>
                  <Pressable
                    onPress={() => setSheet((s) => {
                      const next = Math.max(1, s.duration - 1);
                      applyPreview(s.date, next);
                      return { ...s, duration: next };
                    })}
                    style={styles.durationBtn}
                  >
                    <Text style={styles.durationBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.durationValue}>{sheet.duration} days</Text>
                  <Pressable
                    onPress={() => setSheet((s) => {
                      const next = Math.min(10, s.duration + 1);
                      applyPreview(s.date, next);
                      return { ...s, duration: next };
                    })}
                    style={styles.durationBtn}
                  >
                    <Text style={styles.durationBtnText}>+</Text>
                  </Pressable>
                </View>

                <View style={styles.previewRow}>
                  {previewDots.map((color, i) => (
                    <View key={i} style={[styles.previewDot, { backgroundColor: color }]} />
                  ))}
                </View>

                <PrimaryButton label="Confirm" onPress={confirmLogPeriod} />
                <Pressable onPress={closeSheet} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Period logged</Text>
                <Text style={styles.sheetDate}>
                  {sheet.rangeStart && sheet.rangeEnd
                    ? `${formatDate(sheet.rangeStart)} – ${formatDate(sheet.rangeEnd)} · ${sheet.rangeLength} days`
                    : ""}
                </Text>

                <Pressable style={styles.deleteBtn} onPress={confirmDeletePeriod}>
                  <Feather name="trash-2" size={16} color="#E25555" />
                  <Text style={styles.deleteBtnText}>Delete period</Text>
                </Pressable>

                <Pressable onPress={closeSheet} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Close</Text>
                </Pressable>
              </>
            )}
          </View>
      </View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  bellPill: { width: 36, height: 36, borderRadius: 18, backgroundColor: PERIOD_BG, alignItems: "center", justifyContent: "center" },
  heroCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: PERIOD_BG },
  ring: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  ringFill: { position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 6 },
  heroEyebrow: { fontSize: 12, color: "#A94D7A", fontWeight: "700" },
  heroPhase: { fontSize: 20, fontWeight: "800", color: "#231F29", marginTop: 4 },
  heroDay: { fontSize: 12, color: "#7F7486", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, alignItems: "flex-start", gap: 6 },
  statLabel: { fontSize: 12, color: "#7F7486" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#231F29" },
  tabBar: { flexDirection: "row", backgroundColor: "#FFF6FA", borderRadius: 999, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabActive: { backgroundColor: PERIOD_COLOR },
  tabText: { fontSize: 13, fontWeight: "700", color: "#7F7486" },
  tabTextActive: { color: "#FFFFFF" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#231F29", marginBottom: 12 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calNavBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: PERIOD_BG, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 13, color: "#7F7486", fontWeight: "600", marginTop: 8, marginBottom: 6 },
  weekHeader: { flexDirection: "row", marginBottom: 8 },
  weekHeaderCell: { flex: 1, textAlign: "center", fontSize: 11, color: "#7F7486", fontWeight: "700" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  rangeStrip: { position: "absolute", top: "20%", bottom: "20%", left: 0, right: 0, backgroundColor: PERIOD_BG },
  rangeStripStart: { left: "50%" },
  rangeStripEnd: { right: "50%" },
  dayInner: { flex: 1, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  dayToday: { borderWidth: 1.5, borderColor: PERIOD_COLOR },
  dayText: { fontSize: 12, color: "#231F29", fontWeight: "600" },
  dayTextLight: { color: "#FFFFFF" },
  dayTextToday: { color: PERIOD_COLOR, fontWeight: "800" },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  hintText: { fontSize: 11, color: "#B09ABF" },
  flowRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  flowDot: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 2, alignItems: "center" },
  flowText: { fontSize: 12, fontWeight: "700", color: "#231F29", textTransform: "capitalize" },
  flowTextActive: { color: "#FFFFFF" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#FFF6FA", borderWidth: 1, borderColor: "#F0DCE7" },
  chipActive: { backgroundColor: PERIOD_COLOR, borderColor: PERIOD_COLOR },
  chipText: { color: "#7F7486", fontWeight: "600", textTransform: "capitalize", fontSize: 12 },
  chipTextActive: { color: "#FFFFFF" },
  severityRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  sevDot: { flex: 1, height: 10, borderRadius: 5, backgroundColor: "#F0DCE7" },
  sevDotActive: { backgroundColor: PERIOD_COLOR },
  moodChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: 140, marginBottom: 12 },
  barWrap: { alignItems: "center", gap: 4, flex: 1 },
  barTrack: { width: 22, height: 100, backgroundColor: PERIOD_BG, borderRadius: 11, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", backgroundColor: PERIOD_COLOR, borderRadius: 11 },
  barLabel: { fontSize: 10, color: "#7F7486", textTransform: "capitalize" },
  barValue: { fontSize: 10, color: "#231F29", fontWeight: "700" },
  miniStatRow: { flexDirection: "row", gap: 8 },
  miniStat: { flex: 1, backgroundColor: "#FFF6FA", padding: 10, borderRadius: 12, alignItems: "center" },
  miniStatLabel: { fontSize: 11, color: "#7F7486" },
  miniStatValue: { fontSize: 16, fontWeight: "800", color: PERIOD_COLOR, marginTop: 2 },
  error: { color: "#E25555" },
  // Bottom sheet
  overlayWrap: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 100 },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, gap: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0D5E8", alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#231F29" },
  sheetDate: { fontSize: 14, color: "#7F7486", marginTop: -4 },
  sheetLabel: { fontSize: 13, fontWeight: "700", color: "#231F29", marginTop: 4 },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  durationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: PERIOD_BG, alignItems: "center", justifyContent: "center" },
  durationBtnText: { fontSize: 24, color: PERIOD_COLOR, fontWeight: "700", lineHeight: 28 },
  durationValue: { fontSize: 18, fontWeight: "800", color: "#231F29", flex: 1, textAlign: "center" },
  previewRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  previewDot: { width: 26, height: 26, borderRadius: 13 },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: "#E25555", justifyContent: "center" },
  deleteBtnText: { fontSize: 14, fontWeight: "700", color: "#E25555" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 14, color: "#7F7486", fontWeight: "600" },
});