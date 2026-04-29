import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { ChatMessage, ChatSession } from "@/types/api";
import { formatDateTime, truncateId } from "@/utils/format";

type SessionTab = "open" | "closed" | "all";

// ── Session list item ─────────────────────────────────────────────────────────
function SessionCard({
  session,
  active,
  onPress,
}: {
  session: ChatSession;
  active: boolean;
  onPress: () => void;
}) {
  const isOpen = session.status === "active";
  return (
    <Pressable
      onPress={onPress}
      style={[sCardStyles.card, active && sCardStyles.cardActive]}
    >
      <View style={[sCardStyles.dot, isOpen ? sCardStyles.dotOpen : sCardStyles.dotClosed]} />
      <View style={{ flex: 1 }}>
        <Text style={sCardStyles.id}>Session {truncateId(session.id)}</Text>
        <Text style={sCardStyles.meta}>{formatDateTime(session.created_at)}</Text>
        {session.summary ? (
          <Text style={sCardStyles.summary} numberOfLines={1}>
            {session.summary}
          </Text>
        ) : null}
      </View>
      <View
        style={[sCardStyles.badge, isOpen ? sCardStyles.badgeOpen : sCardStyles.badgeClosed]}
      >
        <Text
          style={[
            sCardStyles.badgeText,
            isOpen ? sCardStyles.badgeTextOpen : sCardStyles.badgeTextClosed,
          ]}
        >
          {isOpen ? "Open" : "Closed"}
        </Text>
      </View>
    </Pressable>
  );
}

const sCardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE8C7",
    backgroundColor: "#FAFAFA",
    marginBottom: 10,
  },
  cardActive: { backgroundColor: "#F7FBEE", borderColor: "#8AAF2B" },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  dotOpen: { backgroundColor: "#8AAF2B" },
  dotClosed: { backgroundColor: "#B0A8B9" },
  id: { fontWeight: "700", color: "#231F29", fontSize: 14 },
  meta: { color: "#6E7760", fontSize: 12, marginTop: 2 },
  summary: { color: "#6E7760", fontSize: 12, marginTop: 4, fontStyle: "italic" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeOpen: { backgroundColor: "#EEF7D8" },
  badgeClosed: { backgroundColor: "#F2F4F8" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeTextOpen: { color: "#557417" },
  badgeTextClosed: { color: "#7F7486" },
});

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  message,
  isManager,
}: {
  message: ChatMessage;
  isManager: boolean;
}) {
  return (
    <View style={[bubbleStyles.row, isManager && bubbleStyles.rowRight]}>
      <View style={[bubbleStyles.bubble, isManager ? bubbleStyles.managerBubble : bubbleStyles.patientBubble]}>
        <Text style={[bubbleStyles.text, isManager && bubbleStyles.textManager]}>
          {message.content}
        </Text>
        <Text style={[bubbleStyles.time, isManager && bubbleStyles.timeManager]}>
          {formatDateTime(message.sent_at)}
        </Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  row: { marginBottom: 8 },
  rowRight: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 18,
  },
  patientBubble: { backgroundColor: "#F2F4F8", borderBottomLeftRadius: 4 },
  managerBubble: { backgroundColor: "#8AAF2B", borderBottomRightRadius: 4 },
  text: { color: "#231F29", fontSize: 14, lineHeight: 20 },
  textManager: { color: "#FFF" },
  time: { fontSize: 10, color: "#7F7486", marginTop: 4 },
  timeManager: { color: "rgba(255,255,255,0.7)" },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export function ManagerChatsScreen() {
  const { accessToken, user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selected, setSelected] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionTab, setSessionTab] = useState<SessionTab>("open");
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const loadSessions = useCallback(() => {
    if (!accessToken) return;
    void api
      .managerSessions(accessToken)
      .then((list) => setSessions(list))
      .catch(() => undefined);
  }, [accessToken]);
  useFocusReload(loadSessions);

  useEffect(() => {
    if (!accessToken || !selected) return;
    void api.managerMessages(accessToken, selected.id).then((msgs) => {
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    });
    socketRef.current?.close();
    const socket = new WebSocket(api.makeManagerChatSocket(accessToken, selected.id));
    socket.onmessage = (event) => {
      const incoming = JSON.parse(event.data) as ChatMessage;
      setMessages((prev) => [...prev, incoming]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    };
    socketRef.current = socket;
    return () => socket.close();
  }, [accessToken, selected]);

  function send() {
    if (!socketRef.current || !input.trim()) return;
    socketRef.current.send(JSON.stringify({ content: input.trim() }));
    setInput("");
  }

  async function closeSession() {
    if (!accessToken || !selected) return;
    const closed = await api.closeManagerSession(accessToken, selected.id);
    setSelected(closed);
    const next = await api.managerSessions(accessToken);
    setSessions(next);
  }

  const filteredSessions = sessions.filter((s) => {
    if (sessionTab === "open") return s.status === "active";
    if (sessionTab === "closed") return s.status === "closed";
    return true;
  });

  const openCount = sessions.filter((s) => s.status === "active").length;
  const closedCount = sessions.filter((s) => s.status === "closed").length;

  // ── Thread view ─────────────────────────────────────────────────────────
  if (selected) {
    const isOpen = selected.status === "active";
    return (
      <AppScreen scroll={false} style={styles.threadContainer}>
        {/* Patient info bar */}
        <View style={styles.threadHeader}>
          <Pressable onPress={() => setSelected(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color="#8AAF2B" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.threadTitle}>Session {truncateId(selected.id)}</Text>
            <Text style={styles.threadMeta}>Started {formatDateTime(selected.created_at)}</Text>
          </View>
          <View
            style={[
              styles.statusChip,
              isOpen ? styles.statusChipOpen : styles.statusChipClosed,
            ]}
          >
            <Text style={[styles.statusChipText, isOpen ? styles.statusChipTextOpen : styles.statusChipTextClosed]}>
              {isOpen ? "Open" : "Closed"}
            </Text>
          </View>
        </View>

        {/* AI summary (if closed) */}
        {selected.summary ? (
          <GlassCard style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Feather name="zap" size={14} color="#4F6715" />
              <Text style={styles.summaryTitle}>AI summary</Text>
            </View>
            <Text style={styles.summaryBody}>{selected.summary}</Text>
          </GlassCard>
        ) : null}

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messageArea}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <Text style={styles.noMessages}>No messages yet in this session.</Text>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isManager={msg.sender_id === user?.id}
            />
          ))}
        </ScrollView>

        {/* Composer */}
        {isOpen ? (
          <View style={styles.composer}>
            <View style={styles.quickReplies}>
              {["Offer a slot", "Confirm booking", "Ask for details"].map((reply) => (
                <Pressable
                  key={reply}
                  onPress={() => setInput(reply)}
                  style={styles.quickReply}
                >
                  <Text style={styles.quickReplyText}>{reply}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Reply to patient..."
                placeholderTextColor="#A0A88F"
                style={styles.input}
                multiline
              />
              <Pressable
                onPress={send}
                disabled={!input.trim()}
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              >
                <Feather name="send" size={18} color="#FFF" />
              </Pressable>
            </View>
            <Pressable onPress={closeSession} style={styles.closeBtn}>
              <Feather name="check-circle" size={14} color="#557417" />
              <Text style={styles.closeBtnText}>Close and summarize session</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.closedBanner}>
            <Feather name="lock" size={14} color="#7F7486" />
            <Text style={styles.closedText}>This session is closed.</Text>
          </View>
        )}
      </AppScreen>
    );
  }

  // ── Session list ─────────────────────────────────────────────────────────
  return (
    <AppScreen>
      <View style={styles.listHeader}>
        <Text style={styles.screenTitle}>Chats</Text>
        <Text style={styles.screenSubtitle}>Patient support and handoff to doctors</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(
          [
            { key: "open" as SessionTab, label: "Open", count: openCount },
            { key: "closed" as SessionTab, label: "Closed", count: closedCount },
            { key: "all" as SessionTab, label: "All", count: sessions.length },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setSessionTab(tab.key)}
            style={[styles.tab, sessionTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, sessionTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.tabBadge, sessionTab === tab.key && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, sessionTab === tab.key && styles.tabBadgeTextActive]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {filteredSessions.length ? (
        filteredSessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            active={false}
            onPress={() => {
              setSelected(s);
              setMessages([]);
            }}
          />
        ))
      ) : (
        <GlassCard>
          <Text style={styles.empty}>
            {sessionTab === "open"
              ? "No open chat sessions."
              : sessionTab === "closed"
              ? "No closed sessions."
              : "No sessions yet."}
          </Text>
        </GlassCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  threadContainer: { gap: 0, paddingBottom: 16, flex: 1 },
  listHeader: { marginBottom: 16 },
  screenTitle: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  screenSubtitle: { fontSize: 13, color: "#7F7486", marginTop: 4 },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F2F4F8",
  },
  tabActive: { backgroundColor: "#8AAF2B" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#7F7486" },
  tabTextActive: { color: "#FFF" },
  tabBadge: { backgroundColor: "#DDE8C7", borderRadius: 999, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: "rgba(255,255,255,0.3)" },
  tabBadgeText: { fontSize: 10, fontWeight: "800", color: "#557417" },
  tabBadgeTextActive: { color: "#FFF" },
  empty: { color: "#7F7486", fontSize: 14 },
  // Thread view
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DDE8C7",
  },
  backBtn: { padding: 4 },
  threadTitle: { fontWeight: "800", color: "#231F29", fontSize: 15 },
  threadMeta: { color: "#6E7760", fontSize: 12, marginTop: 2 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusChipOpen: { backgroundColor: "#EEF7D8" },
  statusChipClosed: { backgroundColor: "#F2F4F8" },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  statusChipTextOpen: { color: "#557417" },
  statusChipTextClosed: { color: "#7F7486" },
  summaryCard: { backgroundColor: "#EEF7D8", marginBottom: 12 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  summaryTitle: { fontSize: 13, fontWeight: "700", color: "#4F6715" },
  summaryBody: { color: "#4F6715", fontSize: 13, lineHeight: 20 },
  messageArea: { flex: 1 },
  messageContent: { paddingVertical: 8, gap: 4 },
  noMessages: { color: "#7F7486", fontSize: 14, textAlign: "center", marginTop: 40 },
  composer: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DDE8C7", gap: 10 },
  quickReplies: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  quickReply: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF7D8",
    borderWidth: 1,
    borderColor: "#DDE8C7",
  },
  quickReplyText: { fontSize: 12, color: "#557417", fontWeight: "600" },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE8C7",
    backgroundColor: "#FFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#231F29",
    fontSize: 14,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#8AAF2B",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#B0A8B9" },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    paddingVertical: 8,
  },
  closeBtnText: { color: "#557417", fontWeight: "700", fontSize: 13 },
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DDE8C7",
  },
  closedText: { color: "#7F7486", fontSize: 14 },
});
