import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { useAuth } from "@/context/AuthContext";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { ConnectionStatus } from "@/services/chatSocket";
import type { ChatMessage, ChatSession } from "@/types/api";
import { formatDateTime } from "@/utils/format";

const QUICK_REPLIES = ["I have a question", "Period concerns", "Book appointment"];

type LocalMessage = ChatMessage & { client_id?: string; pending?: boolean };

type IncomingEnvelope =
  | { type: "system"; event: string; session_id: string }
  | ({ type: "message" } & ChatMessage & { client_id?: string })
  | { type: "pong" }
  | Record<string, unknown>;

function newClientId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function PatientChatScreen() {
  const { accessToken, user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 60);
  }, []);

  const socketUrl = useMemo(
    () => (accessToken ? api.makePatientChatSocket(accessToken) : null),
    [accessToken]
  );

  const handleIncoming = useCallback(
    (raw: unknown) => {
      const evt = raw as IncomingEnvelope;
      if (!evt || typeof evt !== "object") return;

      if ((evt as { type?: string }).type === "system") {
        const sysSessionId = (evt as { session_id?: string }).session_id;
        if (sysSessionId) setSessionId(sysSessionId);
        return;
      }

      if ((evt as { type?: string }).type !== "message") return;
      const incoming = evt as ChatMessage & { client_id?: string };
      if (!incoming.id || !incoming.session_id) return;

      setSessionId(incoming.session_id);
      setMessages((current) => {
        if (incoming.client_id) {
          const idx = current.findIndex((m) => m.client_id === incoming.client_id);
          if (idx !== -1) {
            const next = current.slice();
            next[idx] = { ...incoming, client_id: incoming.client_id, pending: false };
            return next;
          }
        }
        // Avoid duplicates if we somehow already have this server id
        if (current.some((m) => m.id === incoming.id)) return current;
        return [...current, { ...incoming, pending: false }];
      });
    },
    []
  );

  const { status, send: socketSend } = useChatSocket({ url: socketUrl, onMessage: handleIncoming });

  useEffect(() => {
    if (!accessToken || !sessionId) return;
    void api
      .patientMessages(accessToken, sessionId)
      .then((history) => {
        setMessages((current) => {
          const pending = current.filter((m) => m.pending);
          const ids = new Set(history.map((m) => m.id));
          const merged: LocalMessage[] = [...history];
          for (const p of pending) if (!ids.has(p.id)) merged.push(p);
          return merged;
        });
      })
      .catch(() => undefined);
  }, [accessToken, sessionId]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const nextSessions = await api.patientSessions(accessToken);
      setSessions(nextSessions);
      if (nextSessions[0]) setSessionId(nextSessions[0].id);
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open chat";
      setError(message);
    }
  }, [accessToken]);
  useFocusReload(load);

  function send(content?: string) {
    const body = (content ?? input).trim();
    if (!body || !user?.id) return;
    const client_id = newClientId();
    const optimistic: LocalMessage = {
      id: client_id,
      client_id,
      session_id: sessionId ?? "",
      sender_id: user.id,
      content: body,
      sent_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((cur) => [...cur, optimistic]);
    socketSend({ type: "message", content: body, client_id, sent_at: optimistic.sent_at });
    setInput("");
  }

  const activeSession = sessions.find((s) => s.id === sessionId) ?? sessions[0];

  return (
    <AppScreen scroll={false} style={styles.flexFill}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flexFill}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleBox}>
            <Text style={styles.title}>Chat support</Text>
            <Text style={styles.subtitle}>
              {activeSession ? `Status: ${activeSession.status}` : "Send a message to start"}
            </Text>
          </View>
          <ConnectionPill status={status} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          onContentSizeChange={() => scrollToBottom(false)}
          showsVerticalScrollIndicator={false}
        >
          {messages.length ? (
            messages.map((message) => {
              const mine = message.sender_id === user?.id;
              return (
                <View
                  key={message.client_id ?? message.id}
                  style={[
                    styles.bubbleWrap,
                    { alignItems: mine ? "flex-end" : "flex-start" },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.bubbleMine : styles.bubbleOther,
                      message.pending && styles.bubblePending,
                    ]}
                  >
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {message.content}
                    </Text>
                  </View>
                  <Text style={styles.bubbleTime}>
                    {message.pending ? "Sending…" : formatDateTime(message.sent_at)}
                  </Text>
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
        </ScrollView>

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
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const { color, label } = pillFor(status);
  return (
    <View style={[styles.pill, { backgroundColor: color + "22", borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function pillFor(status: ConnectionStatus): { color: string; label: string } {
  switch (status) {
    case "open":
      return { color: "#8AAF2B", label: "Online" };
    case "connecting":
    case "reconnecting":
      return { color: "#D9A441", label: "Reconnecting…" };
    case "offline":
      return { color: "#E25555", label: "Offline" };
    default:
      return { color: "#B0A8B9", label: "Idle" };
  }
}

const styles = StyleSheet.create({
  flexFill: { flex: 1, gap: 12, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleBox: {},
  title: { fontSize: 22, fontWeight: "800", color: "#231F29" },
  subtitle: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: "700" },
  thread: { flex: 1 },
  threadContent: { gap: 10, paddingVertical: 8, flexGrow: 1 },
  bubbleWrap: { maxWidth: "100%" },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: { backgroundColor: "#E53F8F", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 4 },
  bubblePending: { opacity: 0.6 },
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
  error: { color: "#E25555" },
});