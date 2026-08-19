export type NotificationEventKind = "entry" | "comment" | "letter";

export interface NotificationChannelPrefs {
  inApp: boolean;
  feishu: boolean;
}

export interface NotificationPreferences {
  commentMergeMinutes: number;
  events: Record<NotificationEventKind, NotificationChannelPrefs>;
}

export interface NotificationPreferencesPublic extends NotificationPreferences {}

const DEFAULT_EVENTS: NotificationPreferences["events"] = {
  entry: { inApp: true, feishu: false },
  comment: { inApp: true, feishu: false },
  letter: { inApp: true, feishu: false },
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  commentMergeMinutes: 5,
  events: DEFAULT_EVENTS,
};

export function parseNotificationPreferences(
  raw: string | undefined
): NotificationPreferences {
  if (!raw?.trim()) return { ...DEFAULT_NOTIFICATION_PREFERENCES, events: { ...DEFAULT_EVENTS } };
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    const events = { ...DEFAULT_EVENTS };
    for (const key of Object.keys(DEFAULT_EVENTS) as NotificationEventKind[]) {
      const channel = parsed.events?.[key];
      if (channel) {
        events[key] = {
          inApp: channel.inApp !== false,
          feishu: Boolean(channel.feishu),
        };
      }
    }
    const merge =
      typeof parsed.commentMergeMinutes === "number" &&
      parsed.commentMergeMinutes >= 0
        ? parsed.commentMergeMinutes
        : DEFAULT_NOTIFICATION_PREFERENCES.commentMergeMinutes;
    return { commentMergeMinutes: merge, events };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, events: { ...DEFAULT_EVENTS } };
  }
}

export function serializeNotificationPreferences(
  prefs: NotificationPreferences
): string {
  return JSON.stringify(prefs);
}
