import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, Check, Clock, Calendar, AlertTriangle,
  Info, DollarSign, Users, Settings, Trash2, MessageSquare,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface Notification {
  id: string;
  source: 'audit' | 'message';
  rawId: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
  ts: number;
  storeRead: boolean;
  category: 'booking' | 'payment' | 'system' | 'staff' | 'guest' | 'message';
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  readIds: string[];
  onMarkRead: (n: Notification) => void;
  onMarkAllRead: () => void;
  onDismiss: (n: Notification) => void;
}

const readKey = (uid: string) => `aquri.notif.read.${uid}`;
const dismissedKey = (uid: string) => `aquri.notif.dismissed.${uid}`;

function loadIds(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode) — the bell just forgets between reloads.
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function typeForAction(action: string): Notification['type'] {
  if (/(error|fail)/i.test(action)) return 'error';
  if (/(delete|remove|refund|deactivate)/i.test(action)) return 'warning';
  if (/(create|add|issue|complete|activate)/i.test(action)) return 'success';
  return 'info';
}

const CATEGORY_BY_ENTITY: Record<string, Notification['category']> = {
  booking: 'booking',
  invoice: 'payment',
  payment: 'payment',
  guest: 'guest',
  user: 'staff',
};

const NotificationDropdown = ({
  isOpen, onClose, notifications, readIds, onMarkRead, onMarkAllRead, onDismiss,
}: NotificationDropdownProps) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const isRead = (n: Notification) => n.source === 'message' ? n.storeRead : readIds.includes(n.id);
  const unreadCount = notifications.filter(n => !isRead(n)).length;

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !isRead(n));
    return notifications;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isRead derives from readIds, already a dep
  }, [notifications, filter, readIds]);

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <Check className="w-4 h-4 text-success" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-danger" />;
      default: return <Info className="w-4 h-4 text-info" />;
    }
  };

  const getCategoryIcon = (category: Notification['category']) => {
    switch (category) {
      case 'booking': return <Calendar className="w-4 h-4" />;
      case 'payment': return <DollarSign className="w-4 h-4" />;
      case 'staff': return <Users className="w-4 h-4" />;
      case 'guest': return <Users className="w-4 h-4" />;
      case 'message': return <MessageSquare className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-12 w-96 max-h-[500px] bg-card border border-border rounded-xl shadow-overlay z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkAllRead}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                  <button onClick={onClose} aria-label="Close notifications" className="p-1 hover:bg-muted rounded">
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    filter === 'unread' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[350px] overflow-y-auto scrollbar-thin">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredNotifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`group p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                        !isRead(notification) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => onMarkRead(notification)}
                    >
                      <div className="flex gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          notification.type === 'success' ? 'bg-success/15' :
                          notification.type === 'warning' ? 'bg-warning/15' :
                          notification.type === 'error' ? 'bg-danger/15' :
                          'bg-info/15'
                        }`}>
                          {getTypeIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h4 className={`text-sm font-medium ${!isRead(notification) ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {notification.title}
                              </h4>
                              {!isRead(notification) && (
                                <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                              )}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDismiss(notification); }}
                              aria-label={`Dismiss notification: ${notification.title}`}
                              className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {notification.time}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {getCategoryIcon(notification.category)}
                              {notification.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Notification Bell with Badge
export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const me = useAppStore((s) => s.user);
  const auditLogs = useAppStore((s) => s.auditLogs);
  const messages = useAppStore((s) => s.messages);
  const markMessageRead = useAppStore((s) => s.markMessageRead);
  const meId = me?.id ?? '';

  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    setReadIds(loadIds(readKey(meId)));
    setDismissedIds(loadIds(dismissedKey(meId)));
  }, [meId]);

  const notifications = useMemo(() => {
    const fromAudit: Notification[] = auditLogs.slice(0, 30).map((log) => ({
      id: `audit:${log.id}`,
      source: 'audit',
      rawId: log.id,
      type: typeForAction(log.action),
      title: log.entityName || log.entityType,
      message: log.details,
      time: relativeTime(log.timestamp),
      ts: Date.parse(log.timestamp) || 0,
      storeRead: false,
      category: CATEGORY_BY_ENTITY[log.entityType] ?? 'system',
    }));

    const forMe = messages.filter(
      (m) => m.senderId !== meId && (!m.channelId || m.channelId === meId),
    );
    const fromMessages: Notification[] = forMe.slice(0, 20).map((m) => ({
      id: `msg:${m.id}`,
      source: 'message',
      rawId: m.id,
      type: m.type === 'alert' ? 'warning' : 'info',
      title: `Message from ${m.senderName}`,
      message: m.content,
      time: relativeTime(m.timestamp),
      ts: Date.parse(m.timestamp) || 0,
      storeRead: m.read,
      category: 'message',
    }));

    return [...fromAudit, ...fromMessages]
      .filter((n) => !dismissedIds.includes(n.id))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 40);
  }, [auditLogs, messages, meId, dismissedIds]);

  const unreadCount = notifications.filter((n) =>
    n.source === 'message' ? !n.storeRead : !readIds.includes(n.id),
  ).length;

  const handleMarkRead = (n: Notification) => {
    if (n.source === 'message') {
      if (!n.storeRead) markMessageRead(n.rawId);
      return;
    }
    if (!readIds.includes(n.id)) {
      const next = [...readIds, n.id];
      setReadIds(next);
      saveIds(readKey(meId), next);
    }
  };

  const handleMarkAllRead = () => {
    for (const n of notifications) {
      if (n.source === 'message' && !n.storeRead) markMessageRead(n.rawId);
    }
    const auditIds = notifications.filter((n) => n.source === 'audit').map((n) => n.id);
    const next = Array.from(new Set([...readIds, ...auditIds]));
    setReadIds(next);
    saveIds(readKey(meId), next);
  };

  const handleDismiss = (n: Notification) => {
    const next = [...dismissedIds, n.id];
    setDismissedIds(next);
    saveIds(dismissedKey(meId), next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        className="relative p-1.5 hover:bg-muted rounded-lg transition-colors"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-medium" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        notifications={notifications}
        readIds={readIds}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onDismiss={handleDismiss}
      />
    </div>
  );
};

export default NotificationBell;
