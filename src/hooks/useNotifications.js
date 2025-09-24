import { useEffect } from 'react';

export const useNotifications = () => {
  // 通知権限リクエスト
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // 通知を表示する関数
  const showNotification = (message) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`${message.nickname || "新着メッセージ"}`, {
        body: message.content,
        icon: "/chat-icon.png",
        tag: message.messageId,
        renotify: false,
      });
    }
  };

  // 通知権限の状態を取得
  const getNotificationPermission = () => {
    if ("Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  };

  // 通知権限を手動でリクエスト
  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return "unsupported";
  };

  return {
    showNotification,
    getNotificationPermission,
    requestNotificationPermission,
  };
};