import React, { useState, useEffect, useCallback, useRef } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import config from './aws-exports.js';

// GraphQLクエリをインポート
import { 
  createGroupRoom, 
  createDirectRoom, 
  joinRoom,
  sendMessage as sendMessageMutation
} from './graphql/mutations';

import { 
  getCurrentUser,
  getUser, 
  searchUsers, 
  getUserRooms, 
  getRoom,
  getRecentMessages,
  getMessagesPaginated  // 標準のページネーションクエリを使用
} from './graphql/queries';

import {
  onMessageSent,
  onRoomUpdate
} from './graphql/subscriptions';

Amplify.configure(config);

const client = generateClient();

// getUserByEmailクエリ
const GET_USER_BY_EMAIL = `
  query GetUserByEmail($email: String!) {
    getUserByEmail(email: $email) {
      userId
      createdAt
      email
      emailVerified
      nickname
      status
      updatedAt
      __typename
    }
  }
`;

// メッセージ履歴管理クラス
class MessageHistoryManager {
  constructor(roomId, currentUserId, client) {
    this.roomId = roomId;
    this.currentUserId = currentUserId;
    this.client = client;
    this.messages = [];
    this.nextToken = null;
    this.hasMoreMessages = true;
    this.isLoading = false;
    this.oldestMessageReached = false;
    this.listeners = [];
  }

  // リスナーを追加
  addListener(listener) {
    this.listeners.push(listener);
  }

  // リスナーを削除
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // 状態変更を通知
  notify() {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  // 現在の状態を取得
  getState() {
    return {
      messages: [...this.messages],
      hasMoreMessages: this.hasMoreMessages,
      isLoading: this.isLoading,
      oldestMessageReached: this.oldestMessageReached,
      nextToken: this.nextToken
    };
  }

  // メッセージをフォーマット
  formatMessage(msg) {
    return {
      id: msg.messageId,
      messageId: msg.messageId,
      sender: msg.nickname || '不明なユーザー',
      content: msg.content,
      time: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      date: new Date(msg.createdAt).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }),
      isOwn: msg.userId === this.currentUserId,
      avatar: (msg.nickname || 'UN').substring(0, 2).toUpperCase(),
      userId: msg.userId,
      createdAt: msg.createdAt
    };
  }

  // 初回メッセージ読み込み
  async loadInitialMessages(limit = 50) {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.messages = [];
    this.nextToken = null;
    this.hasMoreMessages = true;
    this.oldestMessageReached = false;
    this.notify();

    try {
      console.log('Loading initial messages for room:', this.roomId);
      
      // まずgetRecentMessagesを試す（元のコードで動いていた方法）
      let result;
      let fetchedMessages = [];
      
      try {
        result = await this.client.graphql({
          query: getRecentMessages,
          variables: { roomId: this.roomId },
          authMode: 'apiKey'
        });
        
        if (result.data?.getRecentMessages) {
          fetchedMessages = result.data.getRecentMessages.map(msg => this.formatMessage(msg));
          // getRecentMessagesはページネーション非対応なので、最初の読み込みのみ
          this.hasMoreMessages = false;
          this.oldestMessageReached = true;
          console.log(`Loaded ${fetchedMessages.length} recent messages (no pagination)`);
        }
      } catch (recentError) {
        console.warn('getRecentMessages failed, trying getMessagesPaginated:', recentError);
        
        // getRecentMessagesが失敗した場合、getMessagesPaginatedを試す
        try {
          result = await this.client.graphql({
            query: getMessagesPaginated,
            variables: { 
              roomId: this.roomId,
              limit: limit
            },
            authMode: 'apiKey'
          });
          
          if (result.data?.getMessagesPaginated) {
            fetchedMessages = result.data.getMessagesPaginated.items.map(msg => 
              this.formatMessage(msg)
            );
            
            this.nextToken = result.data.getMessagesPaginated.nextToken;
            this.hasMoreMessages = !!result.data.getMessagesPaginated.nextToken;
            
            console.log(`Loaded ${fetchedMessages.length} paginated messages`);
          }
        } catch (paginatedError) {
          console.error('Both message queries failed:', {
            recentError,
            paginatedError
          });
          throw paginatedError;
        }
      }
      
      if (fetchedMessages.length > 0) {
        // メッセージを時系列順（古い→新しい）にソート
        fetchedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        this.messages = fetchedMessages;
      }
      
    } catch (err) {
      console.error('Error loading initial messages:', err);
      
      // より詳細なエラー情報を提供
      let errorMessage = 'メッセージの取得に失敗しました';
      if (err.errors && err.errors.length > 0) {
        errorMessage += ': ' + err.errors.map(e => e.message).join(', ');
      } else if (err.message) {
        errorMessage += ': ' + err.message;
      }
      
      throw new Error(errorMessage);
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  // 過去のメッセージを読み込み（無限スクロール用）
  async loadMoreMessages(limit = 30) {
    if (this.isLoading || !this.hasMoreMessages || !this.nextToken) {
      return false;
    }
    
    this.isLoading = true;
    this.notify();

    try {
      console.log('Loading more messages with token:', this.nextToken);
      
      const result = await this.client.graphql({
        query: getMessagesPaginated,
        variables: { 
          roomId: this.roomId,
          limit: limit,
          nextToken: this.nextToken
        },
        authMode: 'apiKey'
      });
      
      if (result.data?.getMessagesPaginated?.items) {
        const olderMessages = result.data.getMessagesPaginated.items.map(msg => 
          this.formatMessage(msg)
        );
        
        // 古いメッセージを時系列順にソート
        olderMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        // 既存のメッセージの前に追加（時系列順を維持）
        this.messages = [...olderMessages, ...this.messages];
        
        // 次のトークンを更新
        const nextToken = result.data.getMessagesPaginated.nextToken;
        this.nextToken = nextToken;
        this.hasMoreMessages = !!nextToken;
        
        if (!nextToken) {
          this.oldestMessageReached = true;
        }
        
        console.log(`Loaded ${olderMessages.length} more messages`);
        return olderMessages.length;
      }
      return 0;
    } catch (err) {
      console.error('Error loading more messages:', err);
      throw new Error('過去のメッセージの取得に失敗しました: ' + (err.message || 'Unknown error'));
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  // 新しいメッセージを追加
  addMessage(message) {
    const formattedMessage = typeof message.messageId !== 'undefined' 
      ? this.formatMessage(message)
      : message; // 既にフォーマット済みの場合

    // 重複チェック
    const exists = this.messages.some(msg => msg.messageId === formattedMessage.messageId);
    if (exists) return false;
    
    // 新しいメッセージを追加（時系列順を維持）
    this.messages = [...this.messages, formattedMessage];
    this.notify();
    return true;
  }

  // 楽観的メッセージを削除
  removeOptimisticMessage(messageId) {
    this.messages = this.messages.filter(msg => msg.id !== messageId);
    this.notify();
  }

  // 楽観的メッセージをフィルター
  filterOptimisticMessages() {
    this.messages = this.messages.filter(msg => !msg.isOptimistic);
    this.notify();
  }

  // クリーンアップ
  cleanup() {
    this.messages = [];
    this.nextToken = null;
    this.hasMoreMessages = true;
    this.isLoading = false;
    this.oldestMessageReached = false;
    this.listeners = [];
  }
}

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [currentUser, setCurrentUser] = useState(null);
  const [userRooms, setUserRooms] = useState([]);
  
  // ルーム作成モーダル用のstate
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState([]);
  const [isModalSearching, setIsModalSearching] = useState(false);
  
  // ダイレクトメッセージ用のstate
  const [dmSearchTerm, setDmSearchTerm] = useState("");
  const [dmSearchResults, setDmSearchResults] = useState([]);
  const [isDmSearching, setIsDmSearching] = useState(false);
  
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isRoomCreationLoading, setIsRoomCreationLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  // メッセージ機能用のstate
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState(null);

  // メッセージ履歴用のstate
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [oldestMessageReached, setOldestMessageReached] = useState(false);

  // リアルタイム接続用のstate
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Subscription用のref
  const messageSubscriptionRef = useRef(null);
  const roomSubscriptionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const previousScrollHeight = useRef(0);
  
  // MessageHistoryManager用のref
  const messageHistoryManagerRef = useRef(null);

  // 選択されたルームのID取得
  const selectedRoomId = React.useMemo(() => {
    if (selectedSpace === "ホーム") return null;
    
    const room = userRooms.find(room => room.roomName === selectedSpace);
    return room?.roomId || null;
  }, [selectedSpace, userRooms]);

  // MessageHistoryManagerの初期化
  useEffect(() => {
    if (selectedRoomId && currentUser?.userId) {
      // 既存のマネージャーをクリーンアップ
      if (messageHistoryManagerRef.current) {
        messageHistoryManagerRef.current.cleanup();
      }
      
      // 新しいマネージャーを作成
      messageHistoryManagerRef.current = new MessageHistoryManager(
        selectedRoomId,
        currentUser.userId,
        client
      );
      
      // 状態変更リスナーを追加
      messageHistoryManagerRef.current.addListener((state) => {
        setMessages(state.messages);
        setHasMoreMessages(state.hasMoreMessages);
        setIsLoadingMessages(state.isLoading);
        setIsLoadingMoreMessages(state.isLoading);
        setOldestMessageReached(state.oldestMessageReached);
      });
      
      // 初回メッセージ読み込み
      messageHistoryManagerRef.current.loadInitialMessages()
        .then(() => {
          // 初回読み込み時は最下部にスクロール
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          }, 100);
        })
        .catch((error) => {
          console.error('Initial message load error:', error);
          setMessageError(error.message);
        });
    } else {
      // ルームが選択されていない場合はクリーンアップ
      if (messageHistoryManagerRef.current) {
        messageHistoryManagerRef.current.cleanup();
        messageHistoryManagerRef.current = null;
      }
      setMessages([]);
      setMessageError(null);
      setHasMoreMessages(true);
      setIsLoadingMessages(false);
      setIsLoadingMoreMessages(false);
      setOldestMessageReached(false);
    }
  }, [selectedRoomId, currentUser?.userId]);

  // AppSyncからユーザー情報を取得
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const oidcSub = user.profile.sub;
        const email = user.profile.email;
        
        console.log('OIDC sub:', oidcSub);
        console.log('OIDC email:', email);
        
        let result = null;
        
        // まずuserIdで検索を試す
        try {
          result = await client.graphql({
            query: getUser,
            variables: { userId: oidcSub },
            authMode: 'apiKey'
          });
          
          if (result.data.getUser) {
            console.log('User found by userId:', result.data.getUser);
            setCurrentUser(result.data.getUser);
            return;
          }
        } catch (userIdError) {
          console.log('User not found by userId, trying email...');
        }
        
        // userIdで見つからない場合、emailで検索
        if (email) {
          try {
            result = await client.graphql({
              query: GET_USER_BY_EMAIL,
              variables: { email: email },
              authMode: 'apiKey'
            });
            
            if (result.data.getUserByEmail) {
              console.log('User found by email:', result.data.getUserByEmail);
              setCurrentUser(result.data.getUserByEmail);
              return;
            }
          } catch (emailError) {
            console.log('User not found by email either');
          }
        }
        
        // DynamoDBにデータがない場合はOIDC情報をフォールバック
        console.log('Using OIDC profile as fallback');
        const fallbackUser = {
          userId: oidcSub,
          nickname: user.profile.name || user.profile.preferred_username || email?.split('@')[0],
          email: email,
          status: 'active'
        };
        setCurrentUser(fallbackUser);
        
      } catch (error) {
        console.error('Error fetching current user:', error);
        
        // エラーの場合もOIDC情報をフォールバック
        const fallbackUser = {
          userId: user.profile.sub,
          nickname: user.profile.name || user.profile.preferred_username || user.profile.email?.split('@')[0],
          email: user.profile.email,
          status: 'active'
        };
        setCurrentUser(fallbackUser);
      }
    };

    if (user?.profile?.sub) {
      fetchCurrentUser();
    }
  }, [user]);

  // ユーザーのルーム一覧を取得
  useEffect(() => {
    const fetchUserRooms = async () => {
      if (!currentUser?.userId) return;

      try {
        console.log('Fetching rooms for user:', currentUser.userId);
        const result = await client.graphql({
          query: getUserRooms,
          variables: { 
            userId: currentUser.userId,
            limit: 50 
          },
          authMode: 'apiKey'
        });

        if (result.data.getUserRooms?.items) {
          console.log('User rooms:', result.data.getUserRooms.items);
          setUserRooms(result.data.getUserRooms.items);
        }
      } catch (error) {
        console.error('Error fetching user rooms:', error);
      }
    };

    if (currentUser?.userId) {
      fetchUserRooms();
    }
  }, [currentUser]);

  // メッセージサブスクリプションのセットアップ
  useEffect(() => {
    if (!selectedRoomId || !currentUser?.userId) {
      return;
    }

    console.log('Setting up message subscription for room:', selectedRoomId);
    
    // 既存のサブスクリプションをクリーンアップ
    if (messageSubscriptionRef.current) {
      messageSubscriptionRef.current.unsubscribe();
    }

    try {
      messageSubscriptionRef.current = client.graphql({
        query: onMessageSent,
        variables: { roomId: selectedRoomId },
        authMode: 'apiKey'
      }).subscribe({
        next: (eventData) => {
          console.log('Message received via subscription:', eventData);
          
          if (eventData.value?.data?.onMessageSent) {
            const newMsg = eventData.value.data.onMessageSent;
            
            // MessageHistoryManagerを使用してメッセージを追加
            if (messageHistoryManagerRef.current) {
              const isOwn = newMsg.userId === currentUser.userId;
              
              // 自分のメッセージの場合は楽観的更新のメッセージを削除
              if (isOwn) {
                messageHistoryManagerRef.current.filterOptimisticMessages();
              }
              
              const added = messageHistoryManagerRef.current.addMessage(newMsg);
              
              // 自動スクロール（最下部に近い場合のみ）
              if (added && messagesContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
                const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
                
                if (isNearBottom || isOwn) {
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }
              }
              
              // 他のユーザーからのメッセージの場合は通知
              if (!isOwn && document.hidden) {
                showNotification(newMsg);
              }
            }
          }
        },
        error: (error) => {
          console.error('Subscription error:', error);
          setConnectionError('リアルタイム接続でエラーが発生しました');
          setIsConnected(false);
        },
        complete: () => {
          console.log('Subscription connected successfully');
          setIsConnected(true);
          setConnectionError(null);
        }
      });
      
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to setup subscription:', error);
      setIsConnected(false);
      setConnectionError('サブスクリプションの設定に失敗しました');
    }

    // クリーンアップ
    return () => {
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
      }
    };
  }, [selectedRoomId, currentUser?.userId]);

  // ルーム更新のサブスクリプション
  useEffect(() => {
    if (!currentUser?.userId) return;

    console.log('Setting up room update subscription');
    
    try {
      roomSubscriptionRef.current = client.graphql({
        query: onRoomUpdate,
        variables: { userId: currentUser.userId },
        authMode: 'apiKey'
      }).subscribe({
        next: (eventData) => {
          console.log('Room update received:', eventData);
          
          if (eventData.value?.data?.onRoomUpdate) {
            const updatedRoom = eventData.value.data.onRoomUpdate;
            
            // ルーム一覧を更新
            setUserRooms(prevRooms => {
              const existingIndex = prevRooms.findIndex(r => r.roomId === updatedRoom.roomId);
              
              if (existingIndex >= 0) {
                // 既存のルームを更新
                const updated = [...prevRooms];
                updated[existingIndex] = updatedRoom;
                return updated;
              } else {
                // 新しいルームを追加
                return [updatedRoom, ...prevRooms];
              }
            });
          }
        },
        error: (error) => {
          console.error('Room subscription error:', error);
        }
      });
    } catch (error) {
      console.error('Failed to setup room subscription:', error);
    }

    return () => {
      if (roomSubscriptionRef.current) {
        roomSubscriptionRef.current.unsubscribe();
      }
    };
  }, [currentUser?.userId]);

  // 通知を表示
  const showNotification = (message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${message.nickname || '新着メッセージ'}`, {
        body: message.content,
        icon: '/chat-icon.png',
        tag: message.messageId,
        renotify: false
      });
    }
  };

  // 通知権限リクエスト
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 過去のメッセージを取得（無限スクロール用）
  const loadMoreMessages = useCallback(async () => {
    if (!messageHistoryManagerRef.current) return;
    
    try {
      // スクロール位置を保存
      if (messagesContainerRef.current) {
        previousScrollHeight.current = messagesContainerRef.current.scrollHeight;
      }
      
      const loadedCount = await messageHistoryManagerRef.current.loadMoreMessages();
      
      // スクロール位置を維持
      if (loadedCount > 0 && messagesContainerRef.current && previousScrollHeight.current) {
        setTimeout(() => {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          const scrollDiff = newScrollHeight - previousScrollHeight.current;
          messagesContainerRef.current.scrollTop += scrollDiff;
        }, 50);
      }
    } catch (error) {
      console.error('Load more messages error:', error);
      setMessageError(error.message);
    }
  }, []);

  // スクロールイベントハンドラー（無限スクロール用）
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || !messageHistoryManagerRef.current) return;
    
    const { scrollTop } = messagesContainerRef.current;
    const { hasMoreMessages, isLoading } = messageHistoryManagerRef.current.getState();
    
    // 上部に近づいたら過去のメッセージを読み込む
    if (scrollTop < 100 && hasMoreMessages && !isLoading) {
      loadMoreMessages();
    }
  }, [loadMoreMessages]);

  // スクロールイベントのセットアップ
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // メッセージ送信（楽観的UI更新付き）
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedRoomId || !currentUser?.userId || isSendingMessage) {
      return;
    }

    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    // 楽観的UI更新
    const optimisticMessage = {
      id: tempId,
      messageId: tempId,
      sender: currentUser.nickname || currentUser.email || '自分',
      content: messageContent,
      time: now.toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      date: now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }),
      isOwn: true,
      avatar: (currentUser.nickname || currentUser.email || 'ME').substring(0, 2).toUpperCase(),
      userId: currentUser.userId,
      createdAt: now.toISOString(),
      isOptimistic: true
    };
    
    // 即座にUIに反映
    if (messageHistoryManagerRef.current) {
      messageHistoryManagerRef.current.addMessage(optimisticMessage);
    }
    
    setNewMessage("");
    setIsSendingMessage(true);
    
    // スクロール
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    
    try {
      console.log('Sending message to room:', selectedRoomId);
      
      const result = await client.graphql({
        query: sendMessageMutation,
        variables: {
          input: {
            roomId: selectedRoomId,
            userId: currentUser.userId,
            nickname: currentUser.nickname || currentUser.email || 'ユーザー',
            content: messageContent
          }
        },
        authMode: 'apiKey'
      });
      
      console.log('メッセージ送信成功:', result.data?.sendMessage);
      
      // サブスクリプション経由で実際のメッセージが届く
      
    } catch (err) {
      console.error('メッセージ送信エラー:', err);
      
      // エラー時は楽観的更新を取り消し
      if (messageHistoryManagerRef.current) {
        messageHistoryManagerRef.current.removeOptimisticMessage(tempId);
      }
      setNewMessage(messageContent); // エラーの場合は入力を復元
      
      let errorMessage = 'メッセージの送信に失敗しました';
      if (err.errors && err.errors.length > 0) {
        errorMessage += ': ' + err.errors[0].message;
      }
      
      setMessageError(errorMessage);
    } finally {
      setIsSendingMessage(false);
    }
  }, [newMessage, selectedRoomId, currentUser, isSendingMessage]);

  // 日付区切りを表示するヘルパー関数
  const shouldShowDateSeparator = (currentMsg, previousMsg) => {
    if (!previousMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const previousDate = new Date(previousMsg.createdAt).toDateString();
    return currentDate !== previousDate;
  };

  // 日付フォーマットヘルパー
  const formatDateSeparator = (date) => {
    const msgDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (msgDate.toDateString() === today.toDateString()) {
      return '今日';
    } else if (msgDate.toDateString() === yesterday.toDateString()) {
      return '昨日';
    } else {
      return msgDate.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    }
  };

  // キーボードイベントハンドラー
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // ユーザー検索（モーダル用）
  const searchUsersForModal = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setModalSearchResults([]);
      return;
    }

    setIsModalSearching(true);
    try {
      console.log('Searching users for modal:', searchTerm);
      const result = await client.graphql({
        query: searchUsers,
        variables: { 
          searchTerm: searchTerm.trim(),
          limit: 50
        },
        authMode: 'apiKey'
      });

      if (result.data.searchUsers?.items) {
        const filteredUsers = result.data.searchUsers.items
          .filter(u => u.userId !== currentUser?.userId);
        
        console.log('Modal search results:', filteredUsers);
        setModalSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error('Error searching users for modal:', error);
      setModalSearchResults([]);
    } finally {
      setIsModalSearching(false);
    }
  };

  // DM用検索
  const searchUsersForDM = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setDmSearchResults([]);
      return;
    }

    setIsDmSearching(true);
    try {
      console.log('Searching users for DM:', searchTerm);
      const result = await client.graphql({
        query: searchUsers,
        variables: { 
          searchTerm: searchTerm.trim(),
          limit: 20 
        },
        authMode: 'apiKey'
      });

      if (result.data.searchUsers?.items) {
        const filteredUsers = result.data.searchUsers.items.filter(
          u => u.userId !== currentUser?.userId
        );
        console.log('DM search results:', filteredUsers);
        setDmSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error('Error searching users for DM:', error);
      setDmSearchResults([]);
    } finally {
      setIsDmSearching(false);
    }
  };

  // モーダル検索のデバウンス処理
  useEffect(() => {
    const timer = setTimeout(() => {
      if (modalSearchTerm) {
        searchUsersForModal(modalSearchTerm);
      } else {
        setModalSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [modalSearchTerm, currentUser]);

  // DM検索のデバウンス処理
  useEffect(() => {
    const timer = setTimeout(() => {
      if (dmSearchTerm) {
        searchUsersForDM(dmSearchTerm);
      } else {
        setDmSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [dmSearchTerm, currentUser]);

  // グループルーム作成
  const createGroupRoom_func = async () => {
    if (!newRoomName.trim() || !currentUser?.userId) return;

    setIsRoomCreationLoading(true);

    try {
      console.log('Creating room:', newRoomName, selectedUsers);
      
      const result = await client.graphql({
        query: createGroupRoom,
        variables: {
          input: {
            roomName: newRoomName.trim(),
            memberUserIds: selectedUsers,
            createdBy: currentUser.userId
          }
        },
        authMode: 'apiKey'
      });

      if (result.data.createGroupRoom) {
        console.log('Room created successfully:', result.data.createGroupRoom);
        const createdRoom = result.data.createGroupRoom;
        
        const newRoom = {
          ...createdRoom,
          lastMessage: createdRoom.lastMessage || "未入力",
          lastMessageAt: createdRoom.lastMessageAt || createdRoom.createdAt
        };
        setUserRooms(prev => [newRoom, ...prev]);
        
        resetModal();
        
        alert(`ルーム「${newRoomName}」を作成しました。（${createdRoom.memberCount}人のメンバー）`);
        
        setSelectedSpace(createdRoom.roomName);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      
      let errorMessage = 'ルーム作成でエラーが発生しました。';
      if (error.errors && error.errors.length > 0) {
        errorMessage += '\n' + error.errors.map(e => e.message).join('\n');
      }
      
      alert(errorMessage);
    } finally {
      setIsRoomCreationLoading(false);
    }
  };

  // ダイレクトルーム作成
  const createDirectRoom_func = async (targetUserId) => {
    if (!currentUser?.userId || !targetUserId) return;

    try {
      console.log('Creating direct room with:', targetUserId);
      const result = await client.graphql({
        query: createDirectRoom,
        variables: {
          targetUserId: targetUserId,
          createdBy: currentUser.userId
        },
        authMode: 'apiKey'
      });

      if (result.data.createDirectRoom) {
        console.log('Direct room created:', result.data.createDirectRoom);
        const newRoom = {
          ...result.data.createDirectRoom,
          lastMessage: result.data.createDirectRoom.lastMessage || "未入力",
          lastMessageAt: result.data.createDirectRoom.lastMessageAt || result.data.createDirectRoom.createdAt
        };
        setUserRooms(prev => [newRoom, ...prev]);
        setSelectedSpace(result.data.createDirectRoom.roomName);
      }
    } catch (error) {
      console.error('Error creating direct room:', error);
      alert('ダイレクトルーム作成でエラーが発生しました: ' + error.message);
    }
  };

  // 表示名の取得
  const getDisplayName = () => {
    return currentUser?.nickname || user.profile.name || user.profile.email?.split('@')[0] || 'ユーザー';
  };

  const getDisplayAvatar = () => {
    const name = getDisplayName();
    return name.substring(0, 2).toUpperCase();
  };

  // ユーザー選択のトグル
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // モーダルリセット関数
  const resetModal = () => {
    setIsCreatingRoom(false);
    setIsRoomCreationLoading(false);
    setModalSearchTerm("");
    setModalSearchResults([]);
    setSelectedUsers([]);
    setNewRoomName("");
  };

  // エラー自動クリア
  useEffect(() => {
    if (messageError) {
      const timer = setTimeout(() => setMessageError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [messageError]);

  // グループルームとダイレクトルームの分類
  const groupRooms = userRooms.filter(room => room.roomType === 'group');
  const directRooms = userRooms.filter(room => room.roomType === 'direct');

  return (
    <div className="chat-app">
      {/* サイドバー */}
      <div className="sidebar">
        {/* ヘッダー */}
        <div className="sidebar-header">
          <div className="app-title">
            <span className="chat-icon">Chat</span>
          </div>
          <div className="header-actions">
            <button className="icon-btn search-btn" title="検索"></button>
            <button className="icon-btn signout-btn" onClick={onSignOut} title="サインアウト"></button>
          </div>
        </div>

        {/* 接続状態 */}
        <div className="connection-status">
          <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
            <span className="status-text">
              {isConnected ? 'リアルタイム接続中' : 'オフライン'}
            </span>
          </div>
          {connectionError && (
            <div className="connection-error">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{connectionError}</span>
            </div>
          )}
        </div>

        {/* 新しいチャット */}
        <div className="new-chat-section">
          <button className="new-chat-btn" onClick={() => setIsCreatingRoom(true)}>
            <span className="plus-icon">+</span>
            新しいチャット
          </button>
        </div>

        {/* ルーム作成モーダル */}
        {isCreatingRoom && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>新しいグループルームを作成</h3>
                <button onClick={resetModal} disabled={isRoomCreationLoading}>×</button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  placeholder="ルーム名"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="room-name-input"
                  disabled={isRoomCreationLoading}
                />
                
                <div className="user-search-section">
                  <h4>メンバーを検索して追加:</h4>
                  <div className="search-container">
                    <input
                      type="text"
                      placeholder="名前またはメールアドレスで検索"
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="user-search-input"
                      disabled={isRoomCreationLoading}
                    />
                    {isModalSearching && <div className="search-loading">検索中...</div>}
                  </div>
                  
                  {modalSearchResults.length > 0 && (
                    <div className="search-results">
                      <div className="search-results-header">
                        {modalSearchResults.length}件のユーザーが見つかりました
                      </div>
                      {modalSearchResults.map(user => (
                        <div key={user.userId} className="search-result-item">
                          <div className="user-info">
                            <div className="user-avatar-small">
                              {(user.nickname || user.email).substring(0, 2).toUpperCase()}
                            </div>
                            <div className="user-details">
                              <div className="user-name">{user.nickname || user.email}</div>
                              <div className="user-email">{user.email}</div>
                            </div>
                          </div>
                          <button
                            className={`add-user-btn ${selectedUsers.includes(user.userId) ? 'selected' : ''}`}
                            onClick={() => toggleUserSelection(user.userId)}
                            disabled={isRoomCreationLoading}
                          >
                            {selectedUsers.includes(user.userId) ? '✓ 選択済み' : '+ 追加'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {modalSearchTerm && modalSearchResults.length === 0 && !isModalSearching && (
                    <div className="no-results">
                      「{modalSearchTerm}」に該当するユーザーが見つかりませんでした
                    </div>
                  )}
                </div>

                {selectedUsers.length > 0 && (
                  <div className="selected-users-section">
                    <h4>選択されたメンバー ({selectedUsers.length}人):</h4>
                    <div className="selected-users-preview">
                      <div className="member-count-preview">
                        総メンバー数: {selectedUsers.length + 1}人 (あなた + {selectedUsers.length}人)
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={resetModal}
                  disabled={isRoomCreationLoading}
                  className="cancel-btn"
                >
                  キャンセル
                </button>
                <button 
                  onClick={createGroupRoom_func} 
                  disabled={!newRoomName.trim() || isRoomCreationLoading}
                  className="create-room-btn"
                >
                  {isRoomCreationLoading ? (
                    <>
                      <span className="loading-spinner-small"></span>
                      作成中...
                    </>
                  ) : (
                    <>
                      ルーム作成 
                      {selectedUsers.length > 0 && (
                        <span className="member-count-badge">
                          {selectedUsers.length + 1}人
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ナビゲーション */}
        <div className="nav-section">
          {/* ホーム */}
          <div className="nav-group">
            <div className="nav-group-header">ショートカット</div>
            <div 
              className={`nav-item ${selectedSpace === "ホーム" ? 'active' : ''}`}
              onClick={() => setSelectedSpace("ホーム")}
            >
              <span className="nav-icon icon-home"></span>
              <span className="nav-text">ホーム</span>
            </div>
            
            {/* グループルーム */}
            {groupRooms.map((room) => (
              <div 
                key={room.roomId}
                className={`nav-item ${selectedSpace === room.roomName ? 'active' : ''}`}
                onClick={() => setSelectedSpace(room.roomName)}
              >
                <span className="nav-icon icon-team"></span>
                <span className="nav-text">{room.roomName}</span>
                <span className="member-count">({room.memberCount})</span>
                {room.lastMessageAt && (
                  <span className="last-message-time">
                    {new Date(room.lastMessageAt).toLocaleTimeString('ja-JP', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ダイレクトメッセージ */}
          <div className="nav-group">
            <div className="nav-group-header">ダイレクト メッセージ</div>
            
            {/* 既存のダイレクトルーム */}
            {directRooms.map((room) => {
              const formatTime = (timestamp) => {
                if (!timestamp) return '';
                const date = new Date(timestamp);
                const now = new Date();
                const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                } else if (diffDays === 1) {
                  return '昨日';
                } else {
                  return `${diffDays}日前`;
                }
              };

              return (
                <div 
                  key={room.roomId} 
                  className={`nav-item dm-item ${selectedSpace === room.roomName ? 'active' : ''}`}
                  onClick={() => setSelectedSpace(room.roomName)}
                >
                  <span className="nav-icon user-avatar">
                    {room.roomName.substring(0, 2).toUpperCase()}
                  </span>
                  <div className="dm-info">
                    <span className="nav-text">{room.roomName}</span>
                    <div className="dm-preview">
                      <span className="last-message">{room.lastMessage || "未入力"}</span>
                      <span className="last-time">{formatTime(room.lastMessageAt)}</span>
                    </div>
                  </div>
                  <div className="status-indicator online"></div>
                </div>
              );
            })}

            {/* ダイレクトメッセージ作成用検索 */}
            <div className="dm-search-section">
              <input
                type="text"
                placeholder="ユーザーを検索してDM開始"
                value={dmSearchTerm}
                onChange={(e) => setDmSearchTerm(e.target.value)}
                className="dm-search-input"
              />
              
              {/* DM用検索結果 */}
              {dmSearchResults.length > 0 && dmSearchTerm && (
                <div className="dm-search-results">
                  {dmSearchResults.filter(user => 
                    !directRooms.some(room => room.roomName.includes(user.nickname || user.email))
                  ).map((user) => (
                    <div 
                      key={user.userId} 
                      className="dm-search-result-item"
                      onClick={() => {
                        createDirectRoom_func(user.userId);
                        setDmSearchTerm("");
                        setDmSearchResults([]);
                      }}
                    >
                      <span className="nav-icon user-avatar">
                        {(user.nickname || user.email).substring(0, 2).toUpperCase()}
                      </span>
                      <div className="dm-user-info">
                        <span className="dm-user-name">{user.nickname || user.email}</span>
                        <span className="dm-user-email">{user.email}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="main-content">
        {/* チャットヘッダー */}
        <div className="chat-header">
          <div className="chat-info">
            <h2 className="chat-title">{selectedSpace}</h2>
            <div className="chat-subtitle">
              {selectedSpace === "ホーム" ? "チャットルームを選択してください" : 
               `${userRooms.find(r => r.roomName === selectedSpace)?.memberCount || 0}人のメンバー`}
            </div>
          </div>
          <div className="chat-actions">
            <button className="action-btn">未読</button>
            <button className="action-btn">スレッド</button>
            <button className="icon-btn pin-btn" title="ピン留め"></button>
            
            {/* ユーザー情報表示 */}
            <div className="user-profile-display">
              <div className="user-avatar-display">{getDisplayAvatar()}</div>
              <div className="user-info-display">
                <div className="user-name-display">{getDisplayName()}</div>
                <div className="user-status-display">{currentUser?.status || 'active'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {messageError && (
          <div className="error-banner">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{messageError}</span>
            </div>
          </div>
        )}

        {/* メッセージ一覧 */}
        <div className="messages-container" ref={messagesContainerRef}>
          <div className="messages-list">
            {selectedSpace === "ホーム" ? (
              <div className="welcome-message">
                <h3>チャットへようこそ！</h3>
                <p>左側のルーム一覧からチャットルームを選択するか、新しいチャットを作成してください。</p>
                <div className="stats">
                  <div className="stat-item">
                    <strong>{groupRooms.length}</strong>
                    <span>グループルーム</span>
                  </div>
                  <div className="stat-item">
                    <strong>{directRooms.length}</strong>
                    <span>ダイレクトメッセージ</span>
                  </div>
                  <div className="stat-item">
                    <strong>{isConnected ? '接続中' : '切断中'}</strong>
                    <span>リアルタイム通信</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 過去メッセージ読み込み中表示 */}
                {isLoadingMoreMessages && (
                  <div className="loading-more-messages">
                    <div className="loading-spinner-small"></div>
                    <span>過去のメッセージを読み込み中...</span>
                  </div>
                )}
                
                {/* 最古のメッセージに到達した表示 */}
                {oldestMessageReached && messages.length > 0 && (
                  <div className="oldest-message-reached">
                    <div className="separator-line"></div>
                    <span className="separator-text">これより古いメッセージはありません</span>
                    <div className="separator-line"></div>
                  </div>
                )}
                
                {/* 初回読み込み表示 */}
                {isLoadingMessages && messages.length === 0 && (
                  <div className="loading-message">
                    <div className="loading-spinner"></div>
                    <div>メッセージを読み込み中...</div>
                  </div>
                )}
                
                {/* メッセージリスト */}
                {messages.map((message, index) => {
                  const showAvatar = index === 0 || messages[index - 1].userId !== message.userId;
                  const isLastFromUser = index === messages.length - 1 || messages[index + 1]?.userId !== message.userId;
                  const showDateSeparator = shouldShowDateSeparator(message, messages[index - 1]);
                  
                  return (
                    <React.Fragment key={message.messageId || message.id}>
                      {/* 日付区切り */}
                      {showDateSeparator && (
                        <div className="date-separator">
                          <div className="separator-line"></div>
                          <span className="separator-date">{formatDateSeparator(message.createdAt)}</span>
                          <div className="separator-line"></div>
                        </div>
                      )}
                      
                      {/* メッセージ */}
                      <div 
                        className={`message-item ${message.isOwn ? 'own-message' : ''} ${isLastFromUser ? 'last-from-user' : ''} ${message.isOptimistic ? 'optimistic' : ''}`}
                      >
                        {!message.isOwn && showAvatar && (
                          <div className="message-avatar user-avatar">{message.avatar}</div>
                        )}
                        <div className={`message-content ${!message.isOwn && !showAvatar ? 'no-avatar' : ''}`}>
                          {showAvatar && (
                            <div className="message-header">
                              <span className="sender-name">{message.sender}</span>
                              <span className="message-time">{message.time}</span>
                            </div>
                          )}
                          <div className="message-text">{message.content}</div>
                          {!showAvatar && (
                            <div className="message-time-inline">{message.time}</div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                
                {/* メッセージが空の場合 */}
                {!isLoadingMessages && messages.length === 0 && (
                  <div className="no-messages">
                    <p>まだメッセージがありません。</p>
                    <p>最初のメッセージを送信してみましょう！</p>
                  </div>
                )}
                
                {/* メッセージリストの最下部参照用 */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* メッセージ入力 */}
        {selectedSpace !== "ホーム" && selectedRoomId && (
          <div className="message-input-area">
            <div className="input-container">
              <button className="attach-btn" title="ファイル添付">📎</button>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`${selectedSpace}にメッセージを送信`}
                className="message-input"
                rows="1"
                disabled={isSendingMessage}
              />
              <div className="input-actions">
                <button className="icon-btn emoji-btn" title="絵文字">😊</button>
                <button 
                  onClick={sendMessage} 
                  className={`send-btn ${newMessage.trim() && !isSendingMessage ? 'active' : ''}`}
                  disabled={!newMessage.trim() || isSendingMessage}
                  title={isSendingMessage ? "送信中..." : "送信"}
                >
                  {isSendingMessage ? (
                    <span className="loading-spinner-small"></span>
                  ) : (
                    "📤"
                  )}
                </button>
              </div>
            </div>
            
            {/* 送信状態表示 */}
            {isSendingMessage && (
              <div className="sending-indicator">
                メッセージを送信中...
              </div>
            )}
            
            {/* リアルタイム接続状態表示 */}
            {!isConnected && (
              <div className="connection-warning">
                リアルタイム通信が切断されています。メッセージは送信できますが、リアルタイム更新が受信できません。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = "5buno8gs9brj93apmu9tvqqp77";
    const logoutUri = "https://main.d3rgq9lalaa9gb.amplifyapp.com";
    const cognitoDomain = "https://ap-northeast-1ncffaodbj.auth.ap-northeast-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div>読み込み中...</div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="error-screen">
        <div className="error-message">
          エラーが発生しました: {auth.error.message}
        </div>
      </div>
    );
  }

  // 認証済みの場合はチャット画面を表示
  if (auth.isAuthenticated) {
    return <ChatScreen user={auth.user} onSignOut={signOutRedirect} />;
  }

  // 未認証の場合はログイン画面を表示
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h1>G00gleChat</h1>
        <div className="auth-buttons">
          <button 
            onClick={() => auth.signinRedirect()} 
            className="signin-btn"
          >
            サインイン
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;