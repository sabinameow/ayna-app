import { api } from "@/api/client";
import type { NotificationItem, UnreadCount } from "@/types/api";

export const notificationsApi = {
  list: (token: string, unreadOnly = false, limit = 50) =>
    api.notifications(token).then((items) =>
      unreadOnly ? items.filter((item) => !item.is_read).slice(0, limit) : items.slice(0, limit)
    ),
  unreadCount: (token: string) => api.unreadNotifications(token),
  markAsRead: (token: string, notificationId: string) =>
    api.markNotificationRead(token, notificationId),
  markAllAsRead: (token: string) => api.markAllNotificationsRead(token),
  updateDeviceToken: (token: string, deviceToken: string | null) =>
    api.updateDeviceToken(token, deviceToken),
};

export type { NotificationItem, UnreadCount };
