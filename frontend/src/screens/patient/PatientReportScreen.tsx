import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import {
  listLocalMedicationLogs,
  type LocalMedicationLog,
} from "@/services/medicationLogStorage";
import { palette } from "@/theme";
import type {
  Cycle,
  CycleDay,
  CyclePrediction,
  MoodEntry,
  MoodStats,
  Medication,
  MedicationLog,
  PatientProfile,
  PatientSymptom,
  ProgressSummary,
  Symptom,
} from "@/types/api";

const REPORT_CYCLES = 6;

function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function daysBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

function medicationLogDate(log: MedicationLog) {
  return log.taken_at.slice(0, 10);
}

export function PatientReportScreen() {
  const navigation = useNavigation<any>();
  const { accessToken } = useAuth();

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [symptoms, setSymptoms] = useState<PatientSymptom[]>([]);
  const [symptomCatalog, setSymptomCatalog] = useState<Symptom[]>([]);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [moodStats, setMoodStats] = useState<MoodStats | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [cycleDays, setCycleDays] = useState<CycleDay[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<LocalMedicationLog[]>([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [
        nextProfile,
        nextPrediction,
        nextCycles,
        nextSymptoms,
        nextCatalog,
        nextMood,
        nextMoodStats,
        nextProgress,
        nextCycleDays,
        nextLocalMedicationLogs,
        nextMedications,
      ] = await Promise.all([
        api.patientProfile(accessToken),
        api.cyclePrediction(accessToken).catch(() => null),
        api.listCycles(accessToken).catch(() => [] as Cycle[]),
        api.listPatientSymptoms(accessToken).catch(() => [] as PatientSymptom[]),
        api.listSymptomsCatalog(accessToken).catch(() => [] as Symptom[]),
        api.listMoodEntries(accessToken).catch(() => [] as MoodEntry[]),
        api.moodStats(accessToken).catch(() => null),
        api.patientProgress(accessToken).catch(() => null),
        api.listCycleDays(accessToken).catch(() => [] as CycleDay[]),
        listLocalMedicationLogs().catch(() => [] as LocalMedicationLog[]),
        api.patientMedications(accessToken).catch(() => [] as Medication[]),
      ]);
      const activeMedications = nextMedications.filter((medication) => medication.is_active);
      const backendMedicationLogs = (
        await Promise.all(
          activeMedications.map((medication) =>
            api.medicationLogs(accessToken, medication.id).catch(() => [] as MedicationLog[])
          )
        )
      )
        .flat()
        .filter((log) => !log.skipped)
        .map((log) => {
          const medication = activeMedications.find((item) => item.id === log.medication_id);
          return {
            id: log.id,
            date: medicationLogDate(log),
            name: medication?.name ?? "Medication",
            taken: true,
            createdAt: log.taken_at,
          };
        });
      setProfile(nextProfile);
      setPrediction(nextPrediction);
      setCycles(nextCycles);
      setSymptoms(nextSymptoms);
      setSymptomCatalog(nextCatalog);
      setMoodEntries(nextMood);
      setMoodStats(nextMoodStats);
      setProgress(nextProgress);
      setCycleDays(nextCycleDays);
      setMedicationLogs([...backendMedicationLogs, ...nextLocalMedicationLogs]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    }
  }, [accessToken]);
  useFocusReload(load);

  const recentCycles = useMemo(() => {
    return [...cycles]
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
      .slice(0, REPORT_CYCLES);
  }, [cycles]);

  const periodLength = profile?.average_period_length ?? 5;
  const cycleLength = profile?.average_cycle_length ?? 28;

  const reportPeriod = useMemo(() => {
    if (!recentCycles.length) return { from: null as string | null, to: new Date().toISOString() };
    const oldest = recentCycles[recentCycles.length - 1].start_date;
    const newestEnd =
      recentCycles[0].end_date ?? prediction?.predicted_end_date ?? new Date().toISOString();
    return { from: oldest, to: newestEnd };
  }, [recentCycles, prediction]);

  const symptomNameById = useMemo(() => {
    const map: Record<string, string> = {};
    symptomCatalog.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [symptomCatalog]);

  const topSymptoms = useMemo(() => {
    const counts: Record<string, number> = {};
    symptoms.forEach((s) => {
      const name = symptomNameById[s.symptom_id] ?? "Unknown";
      counts[name] = (counts[name] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [symptoms, symptomNameById]);

  const moodDistribution = useMemo(() => {
    const dist = moodStats?.mood_distribution ?? {};
    const entries = Object.entries(dist);
    const total = entries.reduce((sum, [, n]) => sum + (n ?? 0), 0);
    return { entries, total };
  }, [moodStats]);

  const cycleBars = useMemo(() => {
    if (!recentCycles.length) return [];
    const lengths = recentCycles.map((c) => {
      const len =
        c.cycle_length ??
        (c.end_date ? daysBetween(c.start_date, c.end_date) : cycleLength);
      const pLen = c.period_length ?? periodLength;
      return { cycle: c, len, pLen };
    });
    const max = Math.max(...lengths.map((l) => l.len), cycleLength);
    return lengths.map((l) => ({
      ...l,
      lenPct: Math.min(100, (l.len / max) * 100),
      pPct: Math.min(100, (l.pLen / max) * 100),
    }));
  }, [recentCycles, cycleLength, periodLength]);

  const maxCycleDay = useMemo(() => {
    const max = cycleBars.reduce((acc, b) => Math.max(acc, b.len), cycleLength);
    return Math.max(28, Math.min(60, max));
  }, [cycleBars, cycleLength]);

  function dayOfCycle(date: string): number | null {
    const t = new Date(date).getTime();
    if (Number.isNaN(t)) return null;
    for (const c of recentCycles) {
      const start = new Date(c.start_date).getTime();
      const cLen =
        c.cycle_length ??
        (c.end_date ? daysBetween(c.start_date, c.end_date) : cycleLength);
      const end = start + cLen * 86_400_000;
      if (t >= start && t < end) {
        return Math.floor((t - start) / 86_400_000) + 1;
      }
    }
    return null;
  }

  const symptomDayGrid = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {};
    symptoms.forEach((s) => {
      const name = symptomNameById[s.symptom_id] ?? "Unknown";
      const day = dayOfCycle(s.date);
      if (!day) return;
      grid[name] = grid[name] ?? {};
      grid[name][day] = (grid[name][day] ?? 0) + 1;
    });
    return grid;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symptoms, symptomNameById, recentCycles, cycleLength]);

  const flowDayGrid = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {};
    cycleDays.forEach((d) => {
      const day = dayOfCycle(d.date);
      if (!day) return;
      const label =
        d.flow_intensity === "none"
          ? "No discharge"
          : d.flow_intensity.charAt(0).toUpperCase() + d.flow_intensity.slice(1);
      grid[label] = grid[label] ?? {};
      grid[label][day] = (grid[label][day] ?? 0) + 1;
    });
    return grid;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleDays, recentCycles, cycleLength]);

  const moodDayGrid = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {};
    moodEntries.forEach((m) => {
      const day = dayOfCycle(m.date);
      if (!day) return;
      const label = m.mood.charAt(0).toUpperCase() + m.mood.slice(1);
      grid[label] = grid[label] ?? {};
      grid[label][day] = (grid[label][day] ?? 0) + 1;
    });
    return grid;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moodEntries, recentCycles, cycleLength]);

  const medicationSummary = useMemo(() => {
    const byName: Record<string, Set<string>> = {};
    medicationLogs.forEach((log) => {
      if (!log.taken) return;
      byName[log.name] = byName[log.name] ?? new Set<string>();
      byName[log.name].add(log.date);
    });
    return Object.entries(byName)
      .map(([name, dates]) => ({
        name,
        dates: Array.from(dates).sort((a, b) => b.localeCompare(a)),
      }))
      .sort((a, b) => b.dates.length - a.dates.length)
      .slice(0, 8);
  }, [medicationLogs]);

  const medicationDayGrid = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {};
    medicationLogs.forEach((log) => {
      if (!log.taken) return;
      const day = dayOfCycle(log.date);
      if (!day) return;
      grid[log.name] = grid[log.name] ?? {};
      grid[log.name][day] = (grid[log.name][day] ?? 0) + 1;
    });
    return grid;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicationLogs, recentCycles, cycleLength]);

  const exportedOn = new Date().toISOString();

  function buildReportHtml(): string {
    const escape = (raw: string) =>
      raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const headerBlock = `
    <div class="brand-row">
      <div class="brand-left">
        <div class="brand-title">HEALTH REPORT</div>
        <div class="brand-tag">Prepared by Ayna</div>
      </div>
      <div class="brand-right">
        <div class="brand-url">www.ayna.health</div>
        <div class="brand-mark"></div>
      </div>
    </div>`;

    const cycleRows = cycleBars
      .map(
        ({ cycle, len, pLen, lenPct, pPct }) => `
      <div class="bar-block">
        <div class="bar-range">${escape(formatDay(cycle.start_date))}${
          cycle.end_date ? " — " + escape(formatDay(cycle.end_date)) : ""
        }</div>
        <div class="bar-track">
          <div class="bar-cycle" style="width:${lenPct}%"></div>
          <div class="bar-period" style="width:${pPct}%"><span>${pLen} days</span></div>
        </div>
        <div class="bar-length">${len} days</div>
      </div>`
      )
      .join("");

    const buildDayGridTable = (
      grid: Record<string, Record<number, number>>,
      dotClass: string,
      emptyLabel: string
    ) => {
      const labels = Object.keys(grid);
      if (!labels.length) {
        return `<div class="empty">${escape(emptyLabel)}</div>`;
      }
      const headRow = `
        <tr>
          <td class="day-label-cell day-label-head">DAY OF CYCLE</td>
          ${Array.from({ length: maxCycleDay }, (_, i) => `<td class="day-num-head">${i + 1}</td>`).join("")}
        </tr>`;
      const bodyRows = labels
        .map((label) => {
          const days = grid[label];
          const cells = Array.from({ length: maxCycleDay }, (_, i) => {
            const dayNum = i + 1;
            const count = days[dayNum];
            return `<td class="day-cell">${
              count
                ? `<span class="day-dot ${dotClass}">${count}</span>`
                : `<span class="day-dot-line"></span>`
            }</td>`;
          }).join("");
          return `<tr><td class="day-label-cell">${escape(label)}</td>${cells}</tr>`;
        })
        .join("");
      return `<table class="day-grid">${headRow}${bodyRows}</table>`;
    };

    const topSymptomGrid: Record<string, Record<number, number>> = {};
    topSymptoms.forEach(([name]) => {
      topSymptomGrid[name] = symptomDayGrid[name] ?? {};
    });

    const introText = `A cycle report prepared by Ayna based on the last ${
      recentCycles.length || REPORT_CYCLES
    } cycles you logged in the app. To make predictions more accurate and health hints more relevant, keep entering data about how you feel.`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Ayna Health Report — ${escape(profile?.full_name ?? "Patient")}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #231F29; background: #FFF; font-size: 12px; line-height: 1.5; }

  .brand-row { display: flex; align-items: center; justify-content: space-between;
               padding-bottom: 10px; border-bottom: 1px solid #F0DCE7; margin-bottom: 16px; }
  .brand-title { color: #F26F9A; font-size: 22px; font-weight: 900; letter-spacing: 0.4px; }
  .brand-tag { color: #F26F9A; font-size: 10.5px; font-weight: 600; margin-top: 2px; }
  .brand-right { display: flex; align-items: center; gap: 8px; }
  .brand-url { color: #F26F9A; font-size: 10.5px; font-weight: 700; }
  .brand-mark { width: 22px; height: 22px; border-radius: 50%;
                background: radial-gradient(circle at 30% 30%, #F8A3C0, #E53F8F); }

  .meta { font-size: 11.5px; line-height: 1.6; margin-bottom: 12px; }
  .meta-label { color: #7F7486; font-weight: 700; letter-spacing: 0.3px; }
  .meta b { color: #231F29; }

  .intro { font-size: 11px; color: #4A4351; line-height: 1.55; margin: 0 0 16px; }

  h2 { font-size: 14.5px; margin: 0 0 10px; color: #231F29; font-weight: 800; }
  section { page-break-inside: avoid; margin-bottom: 18px; }
  .page-break { page-break-before: always; }

  .kv { font-size: 11.5px; margin: 3px 0; }
  .kv-label { color: #7F7486; font-weight: 700; letter-spacing: 0.3px; }
  .kv-value { font-weight: 800; color: #231F29; }

  .bar-block { display: grid; grid-template-columns: 1fr 60px; align-items: center;
               column-gap: 10px; margin-top: 10px; }
  .bar-range { grid-column: 1 / span 2; font-size: 10px; color: #7F7486;
               font-weight: 600; margin-bottom: 3px; }
  .bar-track { position: relative; height: 14px; border-radius: 7px;
               background: #EDEDED; overflow: hidden; }
  .bar-cycle { position: absolute; left: 0; top: 0; bottom: 0;
               background: linear-gradient(90deg, #BFE6EC 0%, #6FC4D2 100%); }
  .bar-period { position: absolute; left: 0; top: 0; bottom: 0; background: #F26F9A;
                border-radius: 7px; display: flex; align-items: center; padding: 0 6px; }
  .bar-period span { color: #FFF; font-weight: 700; font-size: 9.5px; }
  .bar-length { font-size: 11px; font-weight: 800; color: #231F29; text-align: right; }

  .legend { display: flex; align-items: center; gap: 6px; font-size: 9.5px;
            color: #6C6670; margin-bottom: 10px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%;
                background: #B760E3; color: #FFF; font-weight: 800; font-size: 8px;
                display: flex; align-items: center; justify-content: center; }

  .section-sub { font-size: 10.5px; color: #7F7486; text-align: center;
                 font-weight: 800; letter-spacing: 0.4px; margin: 6px 0 6px; }

  table.day-grid { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 6px; }
  table.day-grid td, table.day-grid th { padding: 1px 0; vertical-align: middle; }
  .day-label-cell { width: 90px; font-size: 10px; color: #231F29; font-weight: 600;
                    text-align: right; padding-right: 6px; }
  .day-label-head { color: #7F7486; font-weight: 800; letter-spacing: 0.3px; }
  .day-cell { text-align: center; }
  .day-dot { display: inline-block; width: 11px; height: 11px; border-radius: 50%;
             color: #FFF; font-size: 7.5px; font-weight: 800; line-height: 11px; }
  .day-dot-line { display: inline-block; width: 11px; height: 1px; background: #ECECEC;
                  vertical-align: middle; }
  .day-dot.symptom { background: #B760E3; }
  .day-dot.flow { background: #5C7FE7; }
  .day-dot.mood { background: #F2A93B; }
  .day-dot.medication { background: #38A169; }
  .day-num-head { font-size: 7px; color: #7F7486; font-weight: 700; text-align: center; }

  .med-list { margin-top: 8px; }
  .med-row { display: flex; align-items: center; justify-content: space-between;
             border-bottom: 1px solid #F0DCE7; padding: 5px 0; font-size: 11px; }
  .med-name { font-weight: 800; color: #231F29; }
  .med-count { color: #38A169; font-weight: 900; }

  .empty { font-size: 11px; color: #7F7486; padding: 6px 0; text-align: center; }
</style>
</head>
<body>

${headerBlock}

<div class="meta">
  <div><span class="meta-label">PERIOD:</span> <b>${escape(formatDay(reportPeriod.from))} — ${escape(
      formatDay(reportPeriod.to)
    )}</b></div>
  <div><span class="meta-label">EXPORTED:</span> <b>${escape(formatDay(exportedOn))}</b></div>
  ${profile ? `<div><span class="meta-label">PATIENT:</span> <b>${escape(profile.full_name)}</b></div>` : ""}
</div>

<p class="intro">${introText}</p>

<section>
  <h2>Cycle and period length</h2>
  <div class="kv"><span class="kv-label">AVERAGE CYCLE LENGTH:</span> <span class="kv-value">${cycleLength} days</span></div>
  <div class="kv"><span class="kv-label">AVERAGE PERIOD LENGTH:</span> <span class="kv-value">${periodLength} days</span></div>
  ${cycleRows || '<div class="empty">No cycles logged yet.</div>'}
</section>

<div class="page-break"></div>

${headerBlock}

<h2>Your standard cycle with frequently entered symptoms</h2>
<p class="intro">${introText}</p>

<div class="legend">
  <div class="legend-dot">1</div>
  <div>Number of times you entered the symptom on a specific day over the last ${
    recentCycles.length || REPORT_CYCLES
  } cycles</div>
</div>

<section>
  <div class="section-sub">TOP 5 MOST LOGGED SYMPTOMS</div>
  ${buildDayGridTable(topSymptomGrid, "symptom", "No symptoms logged yet.")}
</section>

<section>
  <div class="section-sub">DISCHARGE</div>
  ${buildDayGridTable(flowDayGrid, "flow", "No flow days logged yet.")}
</section>

<section>
  <div class="section-sub">MOOD</div>
  ${buildDayGridTable(moodDayGrid, "mood", "No mood entries logged yet.")}
</section>

<section>
  <div class="section-sub">MEDICATION INTAKE</div>
  ${buildDayGridTable(medicationDayGrid, "medication", "No medication intake logged yet.")}
  <div class="med-list">
    ${
      medicationSummary.length
        ? medicationSummary
            .map(
              ({ name, dates }) =>
                `<div class="med-row"><span class="med-name">${escape(name)}</span><span class="med-count">${dates
                  .map((date) => escape(formatDay(date)))
                  .join(", ")}</span></div>`
            )
            .join("")
        : ""
    }
  </div>
</section>

</body>
</html>`;
  }

  async function handleExportPdf() {
    if (exporting) return;
    setError("");
    setExporting(true);
    try {
      const html = buildReportHtml();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const win = window.open("", "_blank", "noopener,noreferrer");
        if (!win) {
          setError("Pop-up blocked. Allow pop-ups to export the PDF.");
          return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Send health report",
          UTI: "com.adobe.pdf",
        });
      } else {
        setError(`PDF saved at ${uri}, but sharing is unavailable on this device.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.title}>Health report</Text>
      </View>

      {error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
        </GlassCard>
      ) : null}

      <GlassCard>
        <Text style={styles.brand}>HEALTH REPORT</Text>
        <Text style={styles.brandSub}>Prepared by Ayna · ayna.health</Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLine}>
            <Text style={styles.metaLabel}>PERIOD: </Text>
            {formatDay(reportPeriod.from)} — {formatDay(reportPeriod.to)}
          </Text>
          <Text style={styles.metaLine}>
            <Text style={styles.metaLabel}>EXPORTED: </Text>
            {formatDay(exportedOn)}
          </Text>
          {profile ? (
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>PATIENT: </Text>
              {profile.full_name}
            </Text>
          ) : null}
        </View>

        <Text style={styles.intro}>
          A cycle report based on the last {recentCycles.length || REPORT_CYCLES} cycles you logged
          in the app. The more data you enter, the more accurate the predictions and health hints
          become.
        </Text>
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionHeader}>Cycle and period length</Text>
        <Text style={styles.kvLine}>
          <Text style={styles.kvLabel}>AVERAGE CYCLE LENGTH: </Text>
          <Text style={styles.kvValue}>{cycleLength} days</Text>
        </Text>
        <Text style={styles.kvLine}>
          <Text style={styles.kvLabel}>AVERAGE PERIOD LENGTH: </Text>
          <Text style={styles.kvValue}>{periodLength} days</Text>
        </Text>

        {cycleBars.length === 0 ? (
          <Text style={styles.empty}>No cycles logged yet.</Text>
        ) : (
          <View style={styles.barList}>
            {cycleBars.map(({ cycle, len, pLen, lenPct, pPct }) => (
              <View key={cycle.id} style={styles.barBlock}>
                <Text style={styles.barRange}>
                  {formatDay(cycle.start_date)}
                  {cycle.end_date ? ` — ${formatDay(cycle.end_date)}` : ""}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barCycle, { width: `${lenPct}%` }]} />
                  <View style={[styles.barPeriod, { width: `${pPct}%` }]}>
                    <Text style={styles.barPeriodLabel}>{pLen}d</Text>
                  </View>
                  <Text style={styles.barLengthLabel}>{len} days</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionHeader}>Top 5 most logged symptoms</Text>
        {topSymptoms.length === 0 ? (
          <Text style={styles.empty}>No symptoms logged yet.</Text>
        ) : (
          topSymptoms.map(([name, count]) => {
            const max = topSymptoms[0][1] || 1;
            const pct = (count / max) * 100;
            return (
              <View key={name} style={styles.symptomRow}>
                <Text style={styles.symptomName}>{name}</Text>
                <View style={styles.symptomTrack}>
                  <View style={[styles.symptomFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.symptomCount}>{count}</Text>
              </View>
            );
          })
        )}
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionHeader}>Mood overview</Text>
        {moodEntries.length === 0 || !moodStats ? (
          <Text style={styles.empty}>No mood entries logged yet.</Text>
        ) : (
          <>
            <View style={styles.statGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{moodStats.total_entries}</Text>
                <Text style={styles.statBoxLabel}>entries</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{moodStats.average_energy.toFixed(1)}</Text>
                <Text style={styles.statBoxLabel}>avg energy</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{moodStats.average_stress.toFixed(1)}</Text>
                <Text style={styles.statBoxLabel}>avg stress</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{moodStats.average_sleep.toFixed(1)}</Text>
                <Text style={styles.statBoxLabel}>avg sleep</Text>
              </View>
            </View>

            {moodDistribution.entries.length ? (
              <View style={styles.moodDist}>
                {moodDistribution.entries.map(([mood, count]) => {
                  const pct = moodDistribution.total
                    ? Math.round(((count ?? 0) / moodDistribution.total) * 100)
                    : 0;
                  return (
                    <View key={mood} style={styles.moodRow}>
                      <Text style={styles.moodLabel}>{mood}</Text>
                      <View style={styles.moodTrack}>
                        <View style={[styles.moodFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.moodCount}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionHeader}>Medication intake</Text>
        {medicationSummary.length === 0 ? (
          <Text style={styles.empty}>No medication intake logged yet.</Text>
        ) : (
          <View style={styles.medicationList}>
            {medicationSummary.map(({ name, dates }) => (
              <View key={name} style={styles.medicationRow}>
                <View style={styles.medicationIcon}>
                  <Feather name="check" size={14} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medicationName}>{name}</Text>
                  <Text style={styles.medicationMeta}>
                    Taken on {dates.map((date) => formatDay(date)).join(", ")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionHeader}>Activity summary</Text>
        <View style={styles.statGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{progress?.total_cycles ?? cycles.length}</Text>
            <Text style={styles.statBoxLabel}>cycles</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>
              {progress?.total_symptoms_logged ?? symptoms.length}
            </Text>
            <Text style={styles.statBoxLabel}>symptoms</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>
              {progress?.total_mood_entries ?? moodEntries.length}
            </Text>
            <Text style={styles.statBoxLabel}>mood entries</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{progress?.completed_appointments ?? 0}</Text>
            <Text style={styles.statBoxLabel}>visits</Text>
          </View>
        </View>
      </GlassCard>

      <Pressable
        style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
        onPress={handleExportPdf}
        disabled={exporting}
        accessibilityRole="button"
        accessibilityLabel="Export report as PDF"
      >
        {exporting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Feather name="download" size={18} color="#FFFFFF" />
        )}
        <Text style={styles.exportBtnLabel}>
          {exporting ? "Preparing PDF..." : "Export as PDF"}
        </Text>
      </Pressable>

      <Text style={styles.footer}>
        This report is informational and does not replace medical advice.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 20, fontWeight: "800", color: "#231F29" },
  brand: { fontSize: 22, fontWeight: "900", color: "#E53F8F", letterSpacing: 0.5 },
  brandSub: { fontSize: 12, color: "#A94D7A", marginTop: 2 },
  metaBlock: { marginTop: 14, gap: 4 },
  metaLine: { fontSize: 13, color: "#231F29" },
  metaLabel: { fontWeight: "800", color: "#7F7486" },
  intro: { marginTop: 14, fontSize: 13, color: "#4A4351", lineHeight: 19 },
  sectionHeader: { fontSize: 16, fontWeight: "800", color: "#231F29", marginBottom: 10 },
  kvLine: { fontSize: 13, color: "#231F29", marginTop: 2 },
  kvLabel: { fontWeight: "800", color: "#7F7486" },
  kvValue: { fontWeight: "700", color: "#231F29" },
  empty: { color: "#7F7486", marginTop: 6 },
  barList: { marginTop: 14, gap: 12 },
  barBlock: { gap: 6 },
  barRange: { fontSize: 11, color: "#7F7486", fontWeight: "700" },
  barTrack: {
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F0DCE7",
    overflow: "hidden",
    justifyContent: "center",
  },
  barCycle: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#9DD9E0",
  },
  barPeriod: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#F26F9A",
    borderRadius: 9,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  barPeriodLabel: { color: "#FFFFFF", fontWeight: "800", fontSize: 11 },
  barLengthLabel: {
    position: "absolute",
    right: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "#231F29",
  },
  symptomRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  symptomName: { width: 110, fontSize: 12, color: "#231F29", fontWeight: "600" },
  symptomTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FCE4EF",
    overflow: "hidden",
  },
  symptomFill: { height: "100%", backgroundColor: "#E53F8F" },
  symptomCount: { width: 28, fontSize: 12, color: "#231F29", fontWeight: "800", textAlign: "right" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  statBox: {
    flexBasis: "47%",
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#FFF7FA",
  },
  statBoxValue: { fontSize: 20, fontWeight: "900", color: "#E53F8F" },
  statBoxLabel: { fontSize: 11, color: "#7F7486", marginTop: 2 },
  moodDist: { marginTop: 12, gap: 6 },
  moodRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  moodLabel: { width: 80, fontSize: 12, color: "#231F29", fontWeight: "600", textTransform: "capitalize" },
  moodTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FCE4EF",
    overflow: "hidden",
  },
  moodFill: { height: "100%", backgroundColor: "#A94D7A" },
  moodCount: { width: 36, fontSize: 12, color: "#231F29", fontWeight: "800", textAlign: "right" },
  medicationList: { gap: 10 },
  medicationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0DCE7",
  },
  medicationIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#38A169",
    alignItems: "center",
    justifyContent: "center",
  },
  medicationName: { fontSize: 14, color: "#231F29", fontWeight: "800" },
  medicationMeta: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  footer: { fontSize: 11, color: "#7F7486", textAlign: "center", marginTop: 8 },
  error: { color: "#C9184A" },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#E53F8F",
    marginTop: 4,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnLabel: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
