import { useState, useEffect, useCallback, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';
import { 
  sendMessage, 
  getRoomMessages, 
  deleteMessage,
  onNewMessage,
  onMessageDeleted 
} from '../graphql/messageOperations';

const client = generateClient();

export const useMessages = (selectedRoom, currentUser) => {
  // State管理
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextToken, setNextToken] = useState(null);
  const [error, setError] = useState(null);
  
  // Subscription参照
  const newMessageSubscription = useRef(null);
  const deleteMessageSubscription = useRef(null);

  // メッセージフォーマット関数
  const formatMessage = useCallback((msg) => ({
    id: msg.messageId,
    messageId: msg.messageId,
    roomId: msg.roomId,
    content: msg.content,
    messageType: msg.messageType,
    createdAt: msg.createdAt,
    sender: msg.user?.nickname || msg.user?.email || 'Unknown User',
    avatar: (msg.user?.nickname || msg.user?.email || 'U').substring(0, 2).toUpperCase(),
    time: formatMessageTime(msg.createdAt),
    isOwn: msg.userId === currentUser?.userId,
    userId: msg.userId,
    user: msg.user
  }), [currentUser?.userId]);

  // メッセージ読み込み
  const loadMessages = useCallback(async (roomId, isInitial = false, loadMore = false) => {
    if (!roomId || loading) return;

    setLoading(true);
    if (isInitial) {
      setError(null);
    }

    try {
      console.log(`Loading messages for room: ${roomId}`);
      
      const result = await client.graphql({
        query: getRoomMessages,
        variables: {
          roomId,
          limit: 50,
          nextToken: loadMore ? nextToken : null,
          sortDirection: 'DESC'
        }
      });

      const messageData = result.data.getRoomMessages;
      const formattedMessages = messageData.items.map(formatMessage);

      if (isInitial) {
        // 初回読み込み - 新しい順を古い順に変換して表示
        setMessages(formattedMessages.reverse());
      } else if (loadMore) {
        // 追加読み込み - 既存メッセージの前に追加
        setMessages(prev => [...formattedMessages.reverse(), ...prev]);
      }

      setNextToken(messageData.nextToken);
      setHasMore(messageData.hasMore);

      console.log(`Loaded ${formattedMessages.length} messages`);
    } catch (err) {
      console.error('メッセージ読み込みエラー:', err);
      setError('メッセージの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [loading, nextToken, formatMessage]);

  // メッセージ送信
  const sendMessageHandler = useCallback(async (content, messageType = 'TEXT') => {
    if (!content.trim() || !selectedRoom?.roomId || !currentUser?.userId || sending) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      console.log(`Sending message to room: ${selectedRoom.roomId}`);
      
      const result = await client.graphql({
        query: sendMessage,
        variables: {
          input: {
            roomId: selectedRoom.roomId,
            content: content.trim(),
            messageType
          }
        }
      });

      const sentMessage = result.data.sendMessage;
      console.log('Message sent successfully:', sentMessage.messageId);
      
      // 送信されたメッセージを即座にUIに追加
      const formattedMessage = formatMessage(sentMessage);
      setMessages(prev => [...prev, formattedMessage]);
      setNewMessage('');

    } catch (err) {
      console.error('メッセージ送信エラー:', err);
      let errorMessage = 'メッセージの送信に失敗しました';
      
      if (err.errors && err.errors.length > 0) {
        errorMessage = err.errors[0].message;
      }
      
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  }, [selectedRoom?.roomId, currentUser?.userId, sending, formatMessage]);

  // メッセージ削除
  const deleteMessageHandler = useCallback(async (messageId) => {
    if (!messageId || !currentUser?.userId) return;

    try {
      console.log(`Deleting message: ${messageId}`);
      
      const result = await client.graphql({
        query: deleteMessage,
        variables: { messageId }
      });

      const deleteResult = result.data.deleteMessage;
      
      if (deleteResult.success) {
        // UIから即座に削除
        setMessages(prev => prev.filter(msg => msg.messageId !== messageId));
        console.log('Message deleted successfully');
      } else {
        console.error('Delete failed:', deleteResult.message);
        setError(deleteResult.message);
      }
    } catch (err) {
      console.error('メッセージ削除エラー:', err);
      setError('メッセージの削除に失敗しました');
    }
  }, [currentUser?.userId]);

  // 追加メッセージ読み込み
  const loadMoreMessages = useCallback(() => {
    if (hasMore && !loading && nextToken && selectedRoom?.roomId) {
      loadMessages(selectedRoom.roomId, false, true);
    }
  }, [hasMore, loading, nextToken, selectedRoom?.roomId, loadMessages]);

  // キーボード入力ハンドラー
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageHandler(newMessage);
    }
  }, [newMessage, sendMessageHandler]);

  // リアルタイム購読設定
  useEffect(() => {
    if (!selectedRoom?.roomId) {
      // Subscriptionクリーンアップ
      if (newMessageSubscription.current) {
        newMessageSubscription.current.unsubscribe();
        newMessageSubscription.current = null;
      }
      if (deleteMessageSubscription.current) {
        deleteMessageSubscription.current.unsubscribe();
        deleteMessageSubscription.current = null;
      }
      return;
    }

    console.log(`Setting up subscriptions for room: ${selectedRoom.roomId}`);

    // 新着メッセージ購読
    newMessageSubscription.current = client.graphql({
      query: onNewMessage,
      variables: { roomId: selectedRoom.roomId }
    }).subscribe({
      next: ({ data }) => {
        const newMsg = data.onNewMessage;
        
        // 自分が送信したメッセージはスキップ（既にUIに追加済み）
        if (newMsg.userId === currentUser?.userId) {
          console.log('Skipping own message from subscription');
          return;
        }

        console.log('New message received via subscription:', newMsg.messageId);

        const formattedMessage = formatMessage(newMsg);

        setMessages(prev => {
          // 重複チェック
          if (prev.some(msg => msg.messageId === formattedMessage.messageId)) {
            console.log('Duplicate message detected, skipping');
            return prev;
          }
          return [...prev, formattedMessage];
        });
      },
      error: (err) => {
        console.error('新着メッセージ購読エラー:', err);
      }
    });

    // メッセージ削除購読
    deleteMessageSubscription.current = client.graphql({
      query: onMessageDeleted,
      variables: { roomId: selectedRoom.roomId }
    }).subscribe({
      next: ({ data }) => {
        const deletedMsg = data.onMessageDeleted;
        console.log('Message deletion received via subscription:', deletedMsg.messageId);
        
        if (deletedMsg.success) {
          setMessages(prev => prev.filter(msg => msg.messageId !== deletedMsg.messageId));
        }
      },
      error: (err) => {
        console.error('削除購読エラー:', err);
      }
    });

    // クリーンアップ
    return () => {
      console.log('Cleaning up subscriptions');
      if (newMessageSubscription.current) {
        newMessageSubscription.current.unsubscribe();
        newMessageSubscription.current = null;
      }
      if (deleteMessageSubscription.current) {
        deleteMessageSubscription.current.unsubscribe();
        deleteMessageSubscription.current = null;
      }
    };
  }, [selectedRoom?.roomId, currentUser?.userId, formatMessage]);

  // ルーム変更時の初期化
  useEffect(() => {
    if (selectedRoom?.roomId) {
      console.log(`Room changed to: ${selectedRoom.roomId}`);
      setMessages([]);
      setNextToken(null);
      setHasMore(true);
      setError(null);
      loadMessages(selectedRoom.roomId, true);
    } else {
      console.log('No room selected, clearing messages');
      setMessages([]);
      setError(null);
    }
  }, [selectedRoom?.roomId, loadMessages]);

  return {
    messages,
    newMessage,
    setNewMessage,
    sendMessage: sendMessageHandler,
    deleteMessage: deleteMessageHandler,
    handleKeyPress,
    loading,
    sending,
    error,
    hasMore,
    loadMoreMessages,
    clearError: () => setError(null)
  };
};

// ユーティリティ関数
function formatMessageTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  
  // 1分未満
  if (diff < 60000) {
    return '今';
  }
  
  // 1時間未満
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分前`;
  }
  
  // 今日
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // 昨日
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨日 ${date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  }
  
  // それより前
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}