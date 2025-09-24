import { useState, useEffect, useCallback, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';
import { sendMessage as sendMessageMutation } from '../graphql/mutations';
import { getRecentMessages } from '../graphql/queries';
import { onMessageSent } from '../graphql/subscriptions';

const client = generateClient();

export const useMessages = (roomId, currentUser) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  // メッセージ取得
  const fetchMessages = useCallback(async () => {
    if (!roomId) return;

    setIsLoading(true);
    setMessages([]);
    setError(null);

    try {
      const result = await client.graphql({
        query: getRecentMessages,
        variables: { roomId },
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

        // 初回読み込み時は最下部にスクロール
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }, 100);
      }
    } catch (err) {
      console.error("メッセージ取得エラー:", err);
      setError("メッセージの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [roomId, currentUser?.userId]);

  // メッセージ送信（楽観的UI更新付き）
  const sendMessage = useCallback(async (content) => {
    if (
      !content.trim() ||
      !roomId ||
      !currentUser?.userId ||
      isSending
    ) {
      return;
    }

    const messageContent = content.trim();
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // 楽観的UI更新
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

    // 即座にUIに反映
    setMessages((prev) => [...prev, optimisticMessage]);
    setIsSending(true);

    // スクロール
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      await client.graphql({
        query: sendMessageMutation,
        variables: {
          input: {
            roomId: roomId,
            userId: currentUser.userId,
            nickname: currentUser.nickname || currentUser.email || "ユーザー",
            content: messageContent,
          },
        },
        authMode: "apiKey",
      });

      // サブスクリプション経由で実際のメッセージが届く
    } catch (err) {
      console.error("メッセージ送信エラー:", err);

      // エラー時は楽観的更新を取り消し
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));

      let errorMessage = "メッセージの送信に失敗しました";
      if (err.errors && err.errors.length > 0) {
        errorMessage += ": " + err.errors[0].message;
      }

      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  }, [roomId, currentUser, isSending]);

  // メッセージサブスクリプション
  useEffect(() => {
    if (!roomId || !currentUser?.userId) {
      return;
    }

    // 既存のサブスクリプションをクリーンアップ
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    try {
      subscriptionRef.current = client
        .graphql({
          query: onMessageSent,
          variables: { roomId },
          authMode: "apiKey",
        })
        .subscribe({
          next: (eventData) => {
            if (eventData.value?.data?.onMessageSent) {
              const newMsg = eventData.value.data.onMessageSent;

              // メッセージを処理
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
                // 楽観的更新のメッセージを削除（自分のメッセージの場合）
                const filtered = formattedMessage.isOwn
                  ? prevMessages.filter((msg) => !msg.isOptimistic)
                  : prevMessages;

                // 重複チェック
                const exists = filtered.some(
                  (msg) => msg.messageId === formattedMessage.messageId
                );
                if (exists) return filtered;

                // 新しいメッセージを追加
                const updated = [...filtered, formattedMessage];

                // 自動スクロール
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({
                    behavior: "smooth",
                  });
                }, 100);

                return updated;
              });

              // 他のユーザーからのメッセージの場合は通知
              if (newMsg.userId !== currentUser.userId && document.hidden) {
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification(`${newMsg.nickname || "新着メッセージ"}`, {
                    body: newMsg.content,
                    icon: "/chat-icon.png",
                    tag: newMsg.messageId,
                    renotify: false,
                  });
                }
              }
            }
          },
          error: (error) => {
            console.error("Subscription error:", error);
            setError("リアルタイム接続でエラーが発生しました");
          },
        });
    } catch (error) {
      console.error("Failed to setup subscription:", error);
      setError("サブスクリプションの設定に失敗しました");
    }

    // クリーンアップ
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [roomId, currentUser?.userId]);

  // ルーム変更時のメッセージ取得
  useEffect(() => {
    if (roomId && currentUser?.userId) {
      fetchMessages();
    } else {
      setMessages([]);
      setError(null);
    }
  }, [roomId, currentUser?.userId, fetchMessages]);

  // エラー自動クリア
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    messagesEndRef,
  };
};