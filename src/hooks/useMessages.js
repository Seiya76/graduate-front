import { useState, useRef, useEffect, useCallback } from "react";
import { sendMessage as sendMessageMutation } from "../graphql/mutations";
import { getRecentMessages } from "../graphql/queries";
import { onMessageSent } from "../graphql/subscriptions";
import { client } from "../awsClient"; // Amplify client を共通化

export function useMessages(currentUser, selectedRoomId) {
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  // ✅ メッセージ取得
  const fetchMessages = useCallback(async () => {
    if (!selectedRoomId) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.graphql({
        query: getRecentMessages,
        variables: { roomId: selectedRoomId },
        authMode: "apiKey",
      });

      if (result.data?.getRecentMessages) {
        const fetched = result.data.getRecentMessages.map((msg) => ({
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
        setMessages(fetched);
      }
    } catch (err) {
      console.error("メッセージ取得エラー:", err);
      setError("メッセージの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoomId, currentUser]);

  // ✅ メッセージ送信
  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || !selectedRoomId || !currentUser?.userId) return;

      setIsSending(true);
      const tempId = `temp-${Date.now()}`;

      const optimistic = {
        id: tempId,
        messageId: tempId,
        sender: currentUser.nickname || currentUser.email || "自分",
        content,
        time: new Date().toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isOwn: true,
        avatar: (currentUser.nickname || "ME").substring(0, 2).toUpperCase(),
        userId: currentUser.userId,
        createdAt: new Date().toISOString(),
        isOptimistic: true,
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        await client.graphql({
          query: sendMessageMutation,
          variables: {
            input: {
              roomId: selectedRoomId,
              userId: currentUser.userId,
              nickname: currentUser.nickname || currentUser.email,
              content,
            },
          },
          authMode: "apiKey",
        });
        // 実際のメッセージはサブスクリプションから流入
      } catch (err) {
        console.error("送信エラー:", err);
        setError("メッセージ送信に失敗しました");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } finally {
        setIsSending(false);
      }
    },
    [selectedRoomId, currentUser]
  );

  // ✅ サブスクリプションで新着メッセージを受信
  useEffect(() => {
    if (!selectedRoomId || !currentUser?.userId) return;

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    const subscription = client
      .graphql({
        query: onMessageSent,
        variables: { roomId: selectedRoomId },
        authMode: "apiKey",
      })
      .subscribe({
        next: (eventData) => {
          const newMsg = eventData.value?.data?.onMessageSent;
          if (!newMsg) return;

          const formatted = {
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

          setMessages((prev) => {
            const exists = prev.some((m) => m.messageId === formatted.messageId);
            if (exists) return prev;
            return [...prev.filter((m) => !m.isOptimistic), formatted];
          });

          // スクロール自動移動
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        },
        error: (err) => {
          console.error("サブスクリプションエラー:", err);
          setError("リアルタイム接続に失敗しました");
        },
      });

    subscriptionRef.current = subscription;
    return () => subscription.unsubscribe();
  }, [selectedRoomId, currentUser]);

  // ✅ ルーム変更時にメッセージをロード
  useEffect(() => {
    if (selectedRoomId && currentUser?.userId) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [selectedRoomId, currentUser, fetchMessages]);

  return {
    messages,
    sendMessage,
    isSending,
    isLoading,
    error,
    messagesEndRef,
  };
}
