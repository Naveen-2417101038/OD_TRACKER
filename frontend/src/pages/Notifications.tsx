import React, { useState, useEffect } from 'react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, clearAllNotifications } from '../data/mockData';
import { NotificationItem } from '../types/types';
import { Card } from '../components/Card';
import { Bell, Check, Trash2, CheckSquare, RefreshCw, Clock } from 'lucide-react';
import { useToast } from '../components/Toast';

export const Notifications: React.FC = () => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadNotifications = () => {
    setNotifications(getNotifications());
  };

  useEffect(() => {
    loadNotifications();
    
    // Refresh when events happen
    window.addEventListener('odStateUpdated', loadNotifications);
    return () => window.removeEventListener('odStateUpdated', loadNotifications);
  }, []);

  const handleMarkAsRead = (id: string) => {
    markNotificationAsRead(id);
    loadNotifications();
    // Dispatch custom event to sync layout header
    window.dispatchEvent(new CustomEvent('odStateUpdated'));
    showToast('Alert marked as read', 'info');
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    loadNotifications();
    window.dispatchEvent(new CustomEvent('odStateUpdated'));
    showToast('All notifications marked as read', 'success');
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all notification logs?')) {
      clearAllNotifications();
      loadNotifications();
      window.dispatchEvent(new CustomEvent('odStateUpdated'));
      showToast('Notification logs cleared', 'info');
    }
  };

  const formatTimeAgo = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-600 p-2 rounded-xl text-white">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">ERP System Alerts</h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Logs of notifications received regarding OD approvals</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <>
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <CheckSquare className="w-4 h-4 text-primary-600" />
                <span>Mark All Read</span>
              </button>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Clear All</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications List Container */}
      <Card>
        {notifications.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-semibold space-y-2">
            <Bell className="w-12 h-12 mx-auto text-slate-200" />
            <p className="text-sm">You have clean notification inbox.</p>
            <p className="text-xs font-medium text-slate-400">Any status changes will show up here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => {
              return (
                <div 
                  key={notif.id}
                  className={`py-4 flex items-start gap-4 transition-colors first:pt-0 last:pb-0 ${
                    !notif.read ? 'bg-primary-50/20 px-3 rounded-2xl border border-primary-100/30' : ''
                  }`}
                >
                  {/* Status dot icon */}
                  <div className={`mt-1 flex-shrink-0 w-3 h-3 rounded-full ${
                    notif.type === 'success' ? 'bg-emerald-500' :
                    notif.type === 'error' ? 'bg-rose-500' :
                    notif.type === 'warning' ? 'bg-amber-500' : 'bg-primary-500'
                  }`} />

                  {/* Body */}
                  <div className="flex-1 space-y-1">
                    <p className={`text-xs md:text-sm text-slate-700 ${!notif.read ? 'font-bold' : 'font-medium'}`}>
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatTimeAgo(notif.timestamp)}</span>
                      <span>•</span>
                      <span>{new Date(notif.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {!notif.read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="flex-shrink-0 flex items-center justify-center gap-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-600 transition-colors shadow-sm"
                      title="Mark as read"
                    >
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Mark Read</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

    </div>
  );
};
