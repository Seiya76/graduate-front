import { useState, useEffect, useRef, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getRecentMessages } from '../graphql/queries';
import { sendMessage as sendMessageMutation } from '../graphql/mutations';
import { onMessageSent } from '../graphql/subscriptions';

const client = generateClient();

export const useMessages = (selectedRoomId, currentUser) => {
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  const messageSubscriptionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // メッセージ取得
  const fetchMessages = async () => {
    if (!selectedRoomId) return;

    setIsLoadingMessages(true);
    setMessages([]);
    setMessageError(null);

    try {
      const result = await client.graphql({
        query: getRecentMessages,
        variables: { roomId: selectedRoomId },
        authMode: "apiKey",
      });

      if (result.data?.getRecentMessages) {
        const fetchedMessages = result.data.getRecentMessages.map((msg) => ({
          id: msg.messageId,
          messageId: msg.messageId,
          sender: msg.nickname || "不明なユーザー",
          content: msg.content,
          time: new Date(msg.createdAt).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isOwn: msg.userId === currentUser?.userId,
          avatar: (msg.nickname || "UN").substring(0, 2).toUpperCase(),
          userId: msg.userId,
          createdAt: msg.createdAt,
        }));

        setMessages(fetchedMessages);
        
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }, 100);
      }
    } catch (err) {
      console.error("メッセージ取得エラー:", err);
      setMessageError("メッセージの取得に失敗しました");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // メッセージ送信
  const sendMessage = useCallback(async (messageContent) => {
    if (!messageContent.trim() || !selectedRoomId || !currentUser?.userId || isSendingMessage) {
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // UI更新
    const optimisticMessage = {
      id: tempId,
      messageId: tempId,
      sender: currentUser.nickname || currentUser.email || "自分",
      content: messageContent,
      time: new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isOwn: true,
      avatar: (currentUser.nickname || currentUser.email || "ME")
        .substring(0, 2)
        .toUpperCase(),
      userId: currentUser.userId,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setIsSendingMessage(true);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      await client.graphql({
        query: sendMessageMutation,
        variables: {
          input: {
            roomId: selectedRoomId,
            userId: currentUser.userId,
            nickname: currentUser.nickname || currentUser.email || "ユーザー",
            content: messageContent,
          },
        },
        authMode: "apiKey",
      });

      return true; // 送信成功
    } catch (err) {
      console.error("メッセージ送信エラー:", err);
      
      // エラー時は楽観的更新を取り消し
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      
      let errorMessage = "メッセージの送信に失敗しました";
      if (err.errors && err.errors.length > 0) {
        errorMessage += ": " + err.errors[0].message;
      }
      setMessageError(errorMessage);
      
      return false; // 送信失敗
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedRoomId, currentUser, isSendingMessage]);

  // サブスクリプションのセットアップ
  useEffect(() => {
    if (!selectedRoomId || !currentUser?.userId) {
      return;
    }

    if (messageSubscriptionRef.current) {
      messageSubscriptionRef.current.unsubscribe();
    }

    try {
      messageSubscriptionRef.current = client
        .graphql({
          query: onMessageSent,
          variables: { roomId: selectedRoomId },
          authMode: "apiKey",
        })
        .subscribe({
          next: (eventData) => {
            if (eventData.value?.data?.onMessageSent) {
              const newMsg = eventData.value.data.onMessageSent;

              const formattedMessage = {
                id: newMsg.messageId,
                messageId: newMsg.messageId,
                sender: newMsg.nickname || "不明なユーザー",
                content: newMsg.content,
                time: new Date(newMsg.createdAt).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                isOwn: newMsg.userId === currentUser.userId,
                avatar: (newMsg.nickname || "UN").substring(0, 2).toUpperCase(),
                userId: newMsg.userId,
                createdAt: newMsg.createdAt,
              };

              setMessages((prevMessages) => {
                const filtered = formattedMessage.isOwn
                  ? prevMessages.filter((msg) => !msg.isOptimistic)
                  : prevMessages;

                const exists = filtered.some(
                  (msg) => msg.messageId === formattedMessage.messageId
                );
                if (exists) return filtered;

                const updated = [...filtered, formattedMessage];

                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);

                return updated;
              });

              // 通知
              if (newMsg.userId !== currentUser.userId && document.hidden) {
                showNotification(newMsg);
              }
            }
          },
          error: (error) => {
            console.error("Subscription error:", error);
            setConnectionError("リアルタイム接続でエラーが発生しました");
            setIsConnected(false);
          },
          complete: () => {
            setIsConnected(true);
            setConnectionError(null);
          },
        });

      setIsConnected(true);
    } catch (error) {
      console.error("Failed to setup subscription:", error);
      setIsConnected(false);
      setConnectionError("サブスクリプションの設定に失敗しました");
    }

    return () => {
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
      }
    };
  }, [selectedRoomId, currentUser?.userId]);

  // メッセージ取得（ルーム変更時）
  useEffect(() => {
    if (selectedRoomId && currentUser?.userId) {
      fetchMessages();
    } else {
      setMessages([]);
      setMessageError(null);
    }
  }, [selectedRoomId, currentUser?.userId]);

  // エラー自動クリア
  useEffect(() => {
    if (messageError) {
      const timer = setTimeout(() => setMessageError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [messageError]);

  return {
    messages,
    messagesEndRef,
    isLoadingMessages,
    isSendingMessage,
    messageError,
    isConnected,
    connectionError,
    sendMessage,
    fetchMessages,
  };
};

// 通知を表示
function showNotification(message) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`${message.nickname || "新着メッセージ"}`, {
      body: message.content,
      icon: "/chat-icon.png",
      tag: message.messageId,
      renotify: false,
    });
  }
}