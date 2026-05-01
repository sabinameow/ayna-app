import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { notificationsApi } from "@/api/notifications";
import { useAuth } from "@/context/AuthContext";
import type { NotificationItem } from "@/types/api";

type NotificationsContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);
const POLL_INTERVAL_MS = 30_000;

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshUnread = useCallback(async () => {
    if (!accessToken) {
      setUnreadCount(0);
      return;
    }
    try {
      const result = await notificationsApi.unreadCount(accessToken);
      setUnreadCount(result.unread);
    } catch {
      // Keep the last known badge count if notifications fail temporarily.
    }
  }, [accessToken]);

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const [nextItems, unread] = await Promise.all([
        notificationsApi.list(accessToken),
        notificationsApi.unreadCount(accessToken),
      ]);
      setItems(nextItems);
      setUnreadCount(unread.unread);
    } catch {
      // Silent fail: notifications are a supporting surface, not a boot blocker.
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!accessToken) return;
      const updated = await notificationsApi.markAsRead(accessToken, notificationId);
      setItems((current) => {
        const wasUnread = current.find((item) => item.id === notificationId && !item.is_read);
        if (wasUnread) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return current.map((item) => (item.id === notificationId ? updated : item));
      });
    },
    [accessToken]
  );

  const markAllAsRead = useCallback(async () => {
    if (!accessToken) return;
    await notificationsApi.markAllAsRead(accessToken);
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  }, [accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!accessToken) return undefined;
    const timer = setInterval(() => {
      void refreshUnread();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [accessToken, refreshUnread]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unreadCount,
      loading,
      refresh,
      refreshUnread,
      markAsRead,
      markAllAsRead,
    }),
    [items, unreadCount, loading, refresh, refreshUnread, markAsRead, markAllAsRead]
  );

  return React.createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return value;
}
