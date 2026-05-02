import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { palette } from "@/theme";
import type { Article } from "@/types/api";

type ArticleRoute = RouteProp<{ Article: { article: Article } }, "Article">;

export function ArticleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ArticleRoute>();
  const { accessToken } = useAuth();
  const [article, setArticle] = useState<Article>(route.params.article);
  const [loading, setLoading] = useState(!route.params.article.content);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken || article.content) return;
    let cancelled = false;
    setLoading(true);
    api
      .article(accessToken, article.id)
      .then((full) => {
        if (!cancelled) setArticle(full);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load article");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, article.id, article.content]);

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
        <Text style={styles.title} numberOfLines={2}>
          Article
        </Text>
      </View>

      <GlassCard>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <Text style={styles.articleMeta}>5 min read</Text>
        {article.summary ? (
          <Text style={styles.articleSummary}>{article.summary}</Text>
        ) : null}
      </GlassCard>

      {loading ? (
        <GlassCard>
          <ActivityIndicator color={palette.patient} />
        </GlassCard>
      ) : article.content ? (
        <GlassCard>
          <Text style={styles.articleContent}>{article.content}</Text>
        </GlassCard>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  articleTitle: { fontSize: 18, fontWeight: "800", color: "#231F29" },
  articleMeta: { fontSize: 12, color: "#7F7486", marginTop: 6 },
  articleSummary: { fontSize: 14, color: "#4A4351", marginTop: 12, lineHeight: 20 },
  articleContent: { fontSize: 14, color: "#231F29", lineHeight: 22 },
  error: { color: "#C9184A", fontSize: 13 },
});