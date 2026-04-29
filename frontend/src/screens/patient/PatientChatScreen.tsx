import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { ChatMessage, ChatSession } from "@/types/api";
import { formatDateTime } from "@/utils/format";

const QUICK_REPLIES = ["I have a question", "Period concerns", "Book appointment"];

export function PatientChatScreen() {
  const { accessToken, user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [premiumLocked, setPremiumLocked] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    connect();
    return () => socketRef.current?.close();
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !sessionId) return;
    void api.patientMessages(accessToken, sessionId).then(setMessages).catch(() => undefined);
  }, [accessToken, sessionId]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const nextSessions = await api.patientSessions(accessToken);
      setSessions(nextSessions);
      if (nextSessions[0]) setSessionId(nextSessions[0].id);
      setPremiumLocked(false);
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open chat";
      setPremiumLocked(message.toLowerCase().includes("subscription"));
      setError(message);
    }
  }, [accessToken]);
  useFocusReload(load);

  function connect() {
    if (!accessToken) return;
    const socket = new WebSocket(api.makePatientChatSocket(accessToken));
    socket.onmessage = (event) => {
      const incoming = JSON.parse(event.data) as ChatMessage;
      setMessages((current) => [...current, incoming]);
      setSessionId(incoming.session_id);
    };
    socket.onerror = () => setError("Live chat connection failed");
    socketRef.current = socket;
  }

  function send(content?: string) {
    const body = (content ?? input).trim();
    if (!socketRef.current || !body) return;
    socketRef.current.send(JSON.stringify({ content: body }));
    setInput("");
  }

  if (premiumLocked) {
    return (
      <AppScreen>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Chat</Text>
        </View>
        <GlassCard style={styles.lockedCard}>
          <View style={styles.lockIcon}>
            <Feather name="lock" size={24} color="#E53F8F" />
          </View>
          <Text style={styles.lockedTitle}>Premium feature</Text>
          <Text style={styles.lockedText}>
            Live chat with a manager unlocks with an active subscription.
          </Text>
        </GlassCard>
      </AppScreen>
    );
  }

  const activeSession = sessions.find((s) => s.id === sessionId) ?? sessions[0];

  return (
    <AppScreen scroll={false}>
      <View style={styles.headerRow}>
        <View style={styles.titleBox}>
          <Text style={styles.title}>Chat support</Text>
          <Text style={styles.subtitle}>
            {activeSession ? `Status: ${activeSession.status}` : "Send a message to start"}
          </Text>
        </View>
        <View style={styles.statusDot} />
      </View>

      <View style={styles.thread}>
        {messages.length ? (
          messages.map((message) => {
            const mine = message.sender_id === user?.id;
            return (
              <View
                key={message.id}
                style={[
                  styles.bubbleWrap,
                  { alignItems: mine ? "flex-end" : "flex-start" },
                ]}
              >
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                    {message.content}
                  </Text>
                </View>
                <Text style={styles.bubbleTime}>{formatDateTime(message.sent_at)}</Text>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyBubble}>
              <Feather name="message-circle" size={28} color="#E53F8F" />
            </View>
            <Text style={styles.emptyText}>Start a conversation with your care team</Text>
          </View>
        )}
      </View>

      {/* Quick replies */}
      <View style={styles.quickRow}>
        {QUICK_REPLIES.map((q) => (
          <Pressable key={q} style={styles.quickChip} onPress={() => send(q)}>
            <Text style={styles.quickText}>{q}</Text>
          </Pressable>
        ))}
      </View>

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#B0A8B9"
          style={styles.composerInput}
        />
        <Pressable
          onPress={() => send()}
          disabled={!input.trim()}
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
        >
          <Feather name="send" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleBox: {},
  title: { fontSize: 22, fontWeight: "800", color: "#231F29" },
  subtitle: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#8AAF2B" },
  thread: { flex: 1, gap: 10, paddingVertical: 8 },
  bubbleWrap: { maxWidth: "100%" },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: { backgroundColor: "#E53F8F", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 4 },
  bubbleText: { color: "#231F29", fontSize: 14 },
  bubbleTextMine: { color: "#FFFFFF" },
  bubbleTime: { fontSize: 10, color: "#B0A8B9", marginTop: 2, marginHorizontal: 4 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: "#7F7486", fontSize: 13 },
  quickRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FCE4EF",
  },
  quickText: { color: "#A11D5C", fontSize: 12, fontWeight: "700" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#E53F8F",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  composerInput: { flex: 1, color: "#231F29", fontSize: 14, minHeight: 36 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E53F8F",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#F8B6CF" },
  lockedCard: { alignItems: "center", gap: 12, paddingVertical: 24 },
  lockIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedTitle: { fontSize: 18, fontWeight: "800", color: "#231F29" },
  lockedText: { color: "#7F7486", textAlign: "center", lineHeight: 20 },
  error: { color: "#E25555" },
});
