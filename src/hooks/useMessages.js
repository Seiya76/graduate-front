import { useState, useEffect, useCallback, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';
import { sendMessage as sendMessageMutation } from '../graphql/mutations';
import { getRoomMessages } from '../graphql/queries';
import { onNewMessage, onMessageDeleted } from '../graphql/subscriptions';

const client = generateClient();

export const useMessages = (selectedRoomId, currentUser) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextToken, setNextToken] = useState(null);
  
  const subscriptionsRef = useRef([]);
  const messagesEndRef = useRef(null);

  // メッセージリストの最下部にスクロール
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // メッセージ取得
  const fetchMessages = useCallback(async (roomId, isLoadMore = false) => {
    if (!roomId) return;
    
    if (!isLoadMore) {
      setIsLoading(true);
      setMessages([]);
      setNextToken(null);
    }
    setError(null);
    
    try {
      const result = await client.graphql({
        query: getRoomMessages,
        variables: {
          roomId: roomId,
          limit: 50,
          nextToken: isLoadMore ? nextToken : null,
          sortDirection: 'ASC'
        },
        authMode: 'apiKey'
      });
      
      if (result.data.getRoomMessages?.items) {
        const fetchedMessages = result.data.getRoomMessages.items.map(msg => ({
          id: msg.messageId,
          messageId: msg.messageId,
          sender: msg.user?.nickname || msg.user?.email || '不明なユーザー',
          content: msg.content,
          time: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          isOwn: msg.userId === currentUser?.userId,
          avatar: (msg.user?.nickname || msg.user?.email || 'UN').substring(0, 2).toUpperCase(),
          userId: msg.userId,
          createdAt: msg.createdAt
        }));
        
        if (isLoadMore) {
          setMessages(prevMessages => [...fetchedMessages, ...prevMessages]);
        } else {
          setMessages(fetchedMessages);
        }
        
        setHasMore(result.data.getRoomMessages.hasMore || false);
        setNextToken(result.data.getRoomMessages.nextToken || null);
        
        // 新しいメッセージ読み込み時は最下部にスクロール
        if (!isLoadMore && fetchedMessages.length > 0) {
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch (err) {
      console.error('メッセージ取得エラー:', err);
      setError('メッセージの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoomId, currentUser?.userId, nextToken, scrollToBottom]);

  // メッセージ送信
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedRoomId || !currentUser?.userId || isSending) {
      return;
    }

    // バリデーション
    if (newMessage.length > 2000) {
      alert('メッセージが長すぎます（2000文字以内）');
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage(""); // すぐに入力をクリア
    setIsSending(true);
    setError(null);
    
    try {
      const result = await client.graphql({
        query: sendMessageMutation,
        variables: {
          input: {
            roomId: selectedRoomId,
            userId: currentUser.userId,
            content: messageContent,
            messageType: 'TEXT'
          }
        },
        authMode: 'apiKey'
      });
      
      console.log('メッセージ送信成功:', result.data.sendMessage);
      
      // 送信成功後は subscription で新しいメッセージを受信するので
      // ここでは messages を直接更新しない
      
    } catch (err) {
      console.error('メッセージ送信エラー:', err);
      
      let errorMessage = 'メッセージの送信に失敗しました';
      if (err.errors && err.errors.length > 0) {
        errorMessage += ': ' + err.errors[0].message;
      } else if (err.message) {
        errorMessage += ': ' + err.message;
      }
      
      setError(errorMessage);
      
      // エラーの場合は入力を復元
      setNewMessage(messageContent);
      
      // エラーをユーザーに表示
      alert(errorMessage);
    } finally {
      setIsSending(false);
    }
  }, [newMessage, selectedRoomId, currentUser, isSending]);

  // キーボードイベントハンドラー
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // 古いメッセージを読み込む（スクロール上部）
  const loadMoreMessages = useCallback(() => {
    if (!hasMore || isLoading || !selectedRoomId) return;
    fetchMessages(selectedRoomId, true);
  }, [hasMore, isLoading, selectedRoomId, fetchMessages]);

  // サブスクリプション設定
  useEffect(() => {
    if (!selectedRoomId) return;

    // 既存のサブスクリプションをクリーンアップ
    subscriptionsRef.current.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    subscriptionsRef.current = [];

    // 新しいメッセージのサブスクリプション
    const setupNewMessageSubscription = async () => {
      try {
        const subscription = client.graphql({
          query: onNewMessage,
          variables: { roomId: selectedRoomId },
          authMode: 'apiKey'
        }).subscribe({
          next: (response) => {
            console.log('新しいメッセージを受信:', response);
            const newMsg = response.data.onNewMessage;
            if (newMsg) {
              const formattedMessage = {
                id: newMsg.messageId,
                messageId: newMsg.messageId,
                sender: newMsg.user?.nickname || newMsg.user?.email || '不明なユーザー',
                content: newMsg.content,
                time: new Date(newMsg.createdAt).toLocaleTimeString('ja-JP', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }),
                isOwn: newMsg.userId === currentUser?.userId,
                avatar: (newMsg.user?.nickname || newMsg.user?.email || 'UN').substring(0, 2).toUpperCase(),
                userId: newMsg.userId,
                createdAt: newMsg.createdAt
              };
              
              setMessages(prevMessages => {
                // 重複チェック
                const exists = prevMessages.some(msg => msg.messageId === formattedMessage.messageId);
                if (!exists) {
                  const updatedMessages = [...prevMessages, formattedMessage];
                  // 新しいメッセージが追加されたら最下部にスクロール
                  setTimeout(scrollToBottom, 100);
                  return updatedMessages;
                }
                return prevMessages;
              });
            }
          },
          error: (err) => {
            console.error('メッセージサブスクリプションエラー:', err);
            setError('リアルタイム通信でエラーが発生しました');
          }
        });
        
        subscriptionsRef.current.push(subscription);
      } catch (err) {
        console.error('サブスクリプション設定エラー:', err);
      }
    };

    // メッセージ削除のサブスクリプション
    const setupDeleteSubscription = async () => {
      try {
        const subscription = client.graphql({
          query: onMessageDeleted,
          variables: { roomId: selectedRoomId },
          authMode: 'apiKey'
        }).subscribe({
          next: (response) => {
            console.log('メッセージ削除を受信:', response);
            const deletedMsg = response.data.onMessageDeleted;
            if (deletedMsg && deletedMsg.success) {
              setMessages(prevMessages => 
                prevMessages.filter(msg => msg.messageId !== deletedMsg.messageId)
              );
            }
          },
          error: (err) => {
            console.error('削除サブスクリプションエラー:', err);
          }
        });
        
        subscriptionsRef.current.push(subscription);
      } catch (err) {
        console.error('削除サブスクリプション設定エラー:', err);
      }
    };

    setupNewMessageSubscription();
    setupDeleteSubscription();

    return () => {
      subscriptionsRef.current.forEach(sub => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
      subscriptionsRef.current = [];
    };
  }, [selectedRoomId, currentUser?.userId, scrollToBottom]);

  // ルーム変更時にメッセージを取得
  useEffect(() => {
    if (selectedRoomId) {
      fetchMessages(selectedRoomId);
    } else {
      setMessages([]);
      setError(null);
    }
  }, [selectedRoomId, fetchMessages]);

  // エラー自動クリア
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    handleKeyPress,
    isLoading,
    isSending,
    error,
    hasMore,
    loadMoreMessages,
    fetchMessages: () => fetchMessages(selectedRoomId),
    messagesEndRef,
    scrollToBottom
  };
};