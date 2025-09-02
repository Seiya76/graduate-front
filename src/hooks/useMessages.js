import { useState, useEffect, useCallback, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';
import { sendMessage as sendMessageMutation } from '../graphql/mutations';
import { getRoomMessages } from '../graphql/queries';
import { onNewMessage, onMessageDeleted } from '../graphql/subscriptions';
import { formatMessageForDisplay, validateMessageInput, getJapaneseErrorMessage } from '../utils/messageUtils';

export const useMessages = (selectedRoomId, currentUser) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextToken, setNextToken] = useState(null);
  
  const client = generateClient();
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
    }
    setError(null);
    
    try {
      const response = await client.graphql({
        query: getRoomMessages,
        variables: {
          roomId: roomId,
          limit: 50,
          nextToken: isLoadMore ? nextToken : null,
          sortDirection: 'ASC'
        },
        authMode: 'API_KEY'
      });
      
      const fetchedMessages = response.data.getRoomMessages.items.map(msg => 
        formatMessageForDisplay(msg, currentUser?.userId)
      );
      
      if (isLoadMore) {
        setMessages(prevMessages => [...fetchedMessages, ...prevMessages]);
      } else {
        setMessages(fetchedMessages);
      }
      
      setHasMore(response.data.getRoomMessages.hasMore || false);
      setNextToken(response.data.getRoomMessages.nextToken || null);
      
      // 新しいメッセージ読み込み時は最下部にスクロール
      if (!isLoadMore) {
        setTimeout(scrollToBottom, 100);
      }
      
    } catch (err) {
      console.error('メッセージ取得エラー:', err);
      setError(getJapaneseErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoomId, currentUser?.userId, client, nextToken, scrollToBottom]);

  // メッセージ送信
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedRoomId || !currentUser?.userId || isSending) {
      return;
    }

    try {
      validateMessageInput(newMessage, selectedRoomId, currentUser.userId);
    } catch (validationError) {
      alert(validationError.message);
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage(""); // すぐに入力をクリア
    setIsSending(true);
    setError(null);
    
    try {
      const response = await client.graphql({
        query: sendMessageMutation,
        variables: {
          input: {
            roomId: selectedRoomId,
            userId: currentUser.userId,
            content: messageContent,
            messageType: 'TEXT'
          }
        },
        authMode: 'API_KEY'
      });
      
      console.log('メッセージ送信成功:', response.data.sendMessage);
      
      // 送信成功後は subscription で新しいメッセージを受信するので
      // ここでは messages を直接更新しない
      
    } catch (err) {
      console.error('メッセージ送信エラー:', err);
      const errorMessage = getJapaneseErrorMessage(err);
      setError(errorMessage);
      
      // エラーの場合は入力を復元
      setNewMessage(messageContent);
      
      // エラーをユーザーに表示
      alert(errorMessage);
    } finally {
      setIsSending(false);
    }
  }, [newMessage, selectedRoomId, currentUser, client, isSending]);

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
          authMode: 'API_KEY'
        }).subscribe({
          next: (response) => {
            const newMsg = response.data.onNewMessage;
            if (newMsg) {
              const formattedMessage = formatMessageForDisplay(newMsg, currentUser?.userId);
              
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
          authMode: 'API_KEY'
        }).subscribe({
          next: (response) => {
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
  }, [selectedRoomId, currentUser?.userId, client, scrollToBottom]);

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