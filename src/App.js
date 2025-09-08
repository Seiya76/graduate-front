import React, { useState, useEffect, useCallback, useRef } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { events } from 'aws-amplify/data';
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
  getRoomMessages
} from './graphql/queries';

Amplify.configure(config);

const client = generateClient();

// Event API設定 - 直接指定（デバッグ用）
const EVENT_API_CONFIG = {
  httpEndpoint: '66lku7arcfg6nnekcrhd2rrmdi.appsync-api.ap-northeast-1.amazonaws.com',
  realtimeEndpoint: '66lku7arcfg6nnekcrhd2rrmdi.appsync-realtime-api.ap-northeast-1.amazonaws.com',
  apiKey: 'da2-lkibi63orzdgvk4a4wgd22j4zm'
};

// デバッグ用：設定値をコンソールに出力
console.log('Event API Config:', EVENT_API_CONFIG);

// Event API WebSocket接続クラス
class EventAPISubscriber {
  constructor(httpEndpoint, realtimeEndpoint, apiKey) {
    this.httpEndpoint = httpEndpoint;
    this.realtimeEndpoint = realtimeEndpoint;
    this.apiKey = apiKey;
    this.ws = null;
    this.messageHandlers = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000;
    this.isConnected = false;
  }
  
  connect() {
    try {
      const headerInfo = {
        host: this.httpEndpoint,
        "x-api-key": this.apiKey,
      };
      
      const encodedHeaderInfo = btoa(JSON.stringify(headerInfo))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      
      this.ws = new WebSocket(
        `wss://${this.realtimeEndpoint}/event/realtime`,
        ["aws-appsync-event-ws", `header-${encodedHeaderInfo}`]
      );
      
      this.ws.onopen = () => {
        console.log("Event API WebSocket connection opened");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // チャネルにサブスクライブ
        const subscribeMessage = {
          "type": "subscribe",
          "id": this.generateUUID(),
          "channel": "/default/channel",
          "authorization": {
            "host": this.httpEndpoint,
            "x-api-key": this.apiKey,
          }
        };
        
        console.log("Sending subscribe message:", subscribeMessage);
        this.ws.send(JSON.stringify(subscribeMessage));
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Event API message received:", data);
          
          this.messageHandlers.forEach(handler => {
            try {
              handler(data);
            } catch (err) {
              console.error("Message handler error:", err);
            }
          });
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error("Event API WebSocket error:", error);
        this.isConnected = false;
      };
      
      this.ws.onclose = (event) => {
        console.log("Event API WebSocket connection closed:", event);
        this.isConnected = false;
        
        // 自動再接続
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            console.log(`Attempting to reconnect... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            this.reconnectAttempts++;
            this.connect();
          }, this.reconnectInterval * Math.pow(2, this.reconnectAttempts));
        }
      };
      
    } catch (error) {
      console.error("Error connecting to Event API:", error);
    }
  }
  
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
  
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// getUserByEmailクエリが不足している場合は追加定義
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
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [nextToken, setNextToken] = useState(null);

  // Event API用のstate
  const [isEventApiConnected, setIsEventApiConnected] = useState(false);
  const [eventApiError, setEventApiError] = useState(null);

  // リアルタイム機能用のref
  const eventSubscriberRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 選択されたルームのID取得
  const selectedRoomId = React.useMemo(() => {
    if (selectedSpace === "ホーム") return null;
    
    const groupRoom = userRooms.find(room => room.roomName === selectedSpace && room.roomType === 'group');
    if (groupRoom) return groupRoom.roomId;
    
    const directRoom = userRooms.find(room => room.roomName === selectedSpace && room.roomType === 'direct');
    if (directRoom) return directRoom.roomId;
    
    return null;
  }, [selectedSpace, userRooms]);

  // メッセージリストの最下部にスクロール
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  // Event API接続の初期化
  useEffect(() => {
    if (!currentUser?.userId) return;

    console.log("Initializing Event API connection...");
    const subscriber = new EventAPISubscriber(
      EVENT_API_CONFIG.httpEndpoint,
      EVENT_API_CONFIG.realtimeEndpoint,
      EVENT_API_CONFIG.apiKey
    );

    eventSubscriberRef.current = subscriber;

    subscriber.onMessage((data) => {
      console.log("Event API data received:", data);
      
      switch (data.type) {
        case "connection_ack":
          console.log("Event API WebSocket connection established");
          setIsEventApiConnected(true);
          setEventApiError(null);
          break;
          
        case "subscribe_success":
          console.log("Event API subscription successful");
          break;
          
        case "data":
          try {
            const eventData = JSON.parse(data.event);
            console.log("Parsed event data:", eventData);
            
            // メッセージイベントの処理
            if (eventData.id && eventData.roomId && eventData.content) {
              // 現在表示中のルームのメッセージのみ処理
              if (eventData.roomId === selectedRoomId) {
                const newMessage = {
                  id: eventData.id,
                  messageId: eventData.id,
                  sender: eventData.user?.nickname || eventData.user?.email || '不明なユーザー',
                  content: eventData.content,
                  time: new Date(eventData.createdAt).toLocaleTimeString('ja-JP', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }),
                  isOwn: eventData.userId === currentUser?.userId,
                  avatar: (eventData.user?.nickname || eventData.user?.email || 'UN').substring(0, 2).toUpperCase(),
                  userId: eventData.userId,
                  createdAt: eventData.createdAt
                };
                
                setMessages(prevMessages => {
                  // 重複チェック
                  const exists = prevMessages.some(msg => msg.messageId === newMessage.messageId);
                  if (exists) return prevMessages;
                  
                  // 新しいメッセージを追加
                  const updatedMessages = [...prevMessages, newMessage];
                  
                  // 自動スクロール（自分のメッセージまたは新規メッセージの場合）
                  if (newMessage.isOwn) {
                    setTimeout(() => scrollToBottom(), 100);
                  }
                  
                  return updatedMessages;
                });
              }
              
              // ルーム一覧の lastMessage を更新
              setUserRooms(prevRooms => 
                prevRooms.map(room => 
                  room.roomId === eventData.roomId 
                    ? { 
                        ...room, 
                        lastMessage: eventData.content.substring(0, 50),
                        lastMessageAt: eventData.createdAt 
                      }
                    : room
                )
              );
            }
          } catch (error) {
            console.error("Error processing event data:", error);
          }
          break;
          
        case "ka":
          // Keep-alive メッセージ
          console.log("Event API keep-alive received");
          break;
          
        default:
          console.log("Unknown Event API message type:", data.type);
          break;
      }
    });

    subscriber.connect();

    return () => {
      console.log("Cleaning up Event API connection");
      subscriber.disconnect();
      setIsEventApiConnected(false);
    };
  }, [currentUser?.userId, selectedRoomId, scrollToBottom]);

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
          nickname: user.profile.name || user.profile.preferred_username,
          email: email,
          status: 'active'
        };
        setCurrentUser(fallbackUser);
        
      } catch (error) {
        console.error('Error fetching current user:', error);
        
        // エラーの場合もOIDC情報をフォールバック
        const fallbackUser = {
          userId: user.profile.sub,
          nickname: user.profile.name || user.profile.preferred_username,
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

  // メッセージ取得
  const fetchMessages = useCallback(async (roomId, isLoadMore = false) => {
    if (!roomId) return;
    
    if (!isLoadMore) {
      setIsLoadingMessages(true);
      setMessages([]);
      setNextToken(null);
    }
    setMessageError(null);
    
    try {
      console.log('Fetching messages for room:', roomId);
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
      
      if (result.data?.getRoomMessages?.items) {
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
          if (fetchedMessages.length > 0) {
            scrollToBottom();
          }
        }
        
        setHasMoreMessages(result.data.getRoomMessages.hasMore || false);
        setNextToken(result.data.getRoomMessages.nextToken || null);
      }
    } catch (err) {
      console.error('メッセージ取得エラー:', err);
      setMessageError('メッセージの取得に失敗しました');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [currentUser?.userId, nextToken, scrollToBottom]);

  // メッセージ送信
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedRoomId || !currentUser?.userId || isSendingMessage) {
      return;
    }

    // バリデーション
    if (newMessage.length > 2000) {
      alert('メッセージが長すぎます（2000文字以内）');
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage(""); // すぐに入力をクリア
    setIsSendingMessage(true);
    setMessageError(null);
    
    // 楽観的UI更新（即座に画面に表示）
    const tempMessage = {
      id: 'temp-' + Date.now(),
      messageId: 'temp-' + Date.now(),
      sender: currentUser.nickname || currentUser.email || '自分',
      content: messageContent,
      time: new Date().toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      isOwn: true,
      avatar: (currentUser.nickname || currentUser.email || 'ME').substring(0, 2).toUpperCase(),
      userId: currentUser.userId,
      createdAt: new Date().toISOString(),
      isOptimistic: true // 楽観的更新のフラグ
    };
    
    setMessages(prevMessages => [...prevMessages, tempMessage]);
    scrollToBottom();
    
    try {
      console.log('Sending message to room:', selectedRoomId);
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
      
      console.log('メッセージ送信成功:', result.data?.sendMessage);
      
      // 楽観的更新メッセージを削除（Event APIから正式な通知が来るため）
      setTimeout(() => {
        setMessages(prevMessages => 
          prevMessages.filter(msg => msg.messageId !== tempMessage.messageId)
        );
      }, 2000);
      
    } catch (err) {
      console.error('メッセージ送信エラー:', err);
      
      // エラー時は楽観的更新を取り消し
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.messageId !== tempMessage.messageId)
      );
      
      let errorMessage = 'メッセージの送信に失敗しました';
      if (err.errors && err.errors.length > 0) {
        errorMessage += ': ' + err.errors[0].message;
      } else if (err.message) {
        errorMessage += ': ' + err.message;
      }
      
      setMessageError(errorMessage);
      setNewMessage(messageContent); // エラーの場合は入力を復元
      alert(errorMessage);
    } finally {
      setIsSendingMessage(false);
    }
  }, [newMessage, selectedRoomId, currentUser, isSendingMessage, scrollToBottom]);

  // キーボードイベントハンドラー
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // 古いメッセージを読み込む
  const loadMoreMessages = useCallback(() => {
    if (!hasMoreMessages || isLoadingMessages || !selectedRoomId) return;
    fetchMessages(selectedRoomId, true);
  }, [hasMoreMessages, isLoadingMessages, selectedRoomId, fetchMessages]);

  // ルーム変更時にメッセージを取得
  useEffect(() => {
    if (selectedRoomId && currentUser?.userId) {
      fetchMessages(selectedRoomId);
    } else {
      setMessages([]);
      setMessageError(null);
    }
  }, [selectedRoomId, currentUser?.userId, fetchMessages]);

  // エラー自動クリア
  useEffect(() => {
    if (messageError) {
      const timer = setTimeout(() => setMessageError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [messageError]);

  // 修正版: ユーザーフィルタリング処理
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
        // 現在のユーザーを除外するのみ（statusフィルタリングを削除）
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

  // DM用検索も同様に修正
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
        // 現在のユーザーを除外するのみ
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
    }, 500); // 500ms後に検索実行

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
    }, 500); // 500ms後に検索実行

    return () => clearTimeout(timer);
  }, [dmSearchTerm, currentUser]);

  // グループルーム作成（改善版）
  const createGroupRoom_func = async () => {
    if (!newRoomName.trim() || !currentUser?.userId) return;

    setIsRoomCreationLoading(true);

    try {
      console.log('Creating room:', newRoomName, selectedUsers);
      
      // Lambda関数による一括メンバー追加でルーム作成
      const result = await client.graphql({
        query: createGroupRoom,
        variables: {
          input: {
            roomName: newRoomName.trim(),
            memberUserIds: selectedUsers, // Lambda関数が一括処理
            createdBy: currentUser.userId
          }
        },
        authMode: 'apiKey'
      });

      if (result.data.createGroupRoom) {
        console.log('Room created successfully:', result.data.createGroupRoom);
        const createdRoom = result.data.createGroupRoom;
        
        // UIを更新
        const newRoom = {
          ...createdRoom,
          lastMessage: createdRoom.lastMessage || "未入力",
          lastMessageAt: createdRoom.lastMessageAt || createdRoom.createdAt
        };
        setUserRooms(prev => [newRoom, ...prev]);
        
        // フォームをリセット
        resetModal();
        
        // 成功メッセージ（実際のメンバー数を表示）
        const totalMembers = createdRoom.memberCount;
        alert(`ルーム「${newRoomName}」を作成しました。（${totalMembers}人のメンバー）`);
        
        // 作成したルームを選択
        setSelectedSpace(createdRoom.roomName);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      
      // エラーの詳細を表示
      let errorMessage = 'ルーム作成でエラーが発生しました。';
      if (error.errors && error.errors.length > 0) {
        errorMessage += '\n' + error.errors.map(e => e.message).join('\n');
      } else if (error.message) {
        errorMessage += '\n' + error.message;
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
        // ルーム一覧を更新
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
    return currentUser?.nickname || user.profile.name || user.profile.email.split('@')[0];
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

        {/* Event API接続状態 */}
        <div className="connection-status">
          <div className={`connection-indicator ${isEventApiConnected ? 'connected' : 'disconnected'}`}>
            <span className={`status-dot ${isEventApiConnected ? 'online' : 'offline'}`}></span>
            <span className="status-text">
              {isEventApiConnected ? 'リアルタイム接続中' : 'オフライン'}
            </span>
          </div>
          {eventApiError && (
            <div className="connection-error">
              <span className="error-icon">⚠️</span>
              <span className="error-text">接続エラー</span>
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

        {/* ルーム作成モーダル（改善版） */}
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
                
                {/* ユーザー検索セクション */}
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
                  
                  {/* 検索結果表示 */}
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
                              {user.status && (
                                <div className="user-status">{user.status}</div>
                              )}
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
                  
                  {/* 検索結果なしの場合 */}
                  {modalSearchTerm && modalSearchResults.length === 0 && !isModalSearching && (
                    <div className="no-results">
                      「{modalSearchTerm}」に該当するユーザーが見つかりませんでした
                    </div>
                  )}
                </div>

                {/* 選択されたメンバーのプレビュー */}
                {selectedUsers.length > 0 && (
                  <div className="selected-users-section">
                    <h4>選択されたメンバー ({selectedUsers.length}人):</h4>
                    <div className="selected-users-preview">
                      <div className="member-count-preview">
                        総メンバー数: {selectedUsers.length + 1}人 (あなた + {selectedUsers.length}人)
                      </div>
                      <div className="selected-users-list">
                        {selectedUsers.map(userId => {
                          const user = modalSearchResults.find(u => u.userId === userId);
                          return user ? (
                            <div key={userId} className="selected-user-item">
                              <div className="user-avatar-small">
                                {(user.nickname || user.email).substring(0, 2).toUpperCase()}
                              </div>
                              <span className="selected-user-name">
                                {user.nickname || user.email}
                              </span>
                              <button
                                className="remove-user-btn"
                                onClick={() => toggleUserSelection(userId)}
                                disabled={isRoomCreationLoading}
                                title="削除"
                              >×</button>
                            </div>
                          ) : null;
                        })}
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
               `${groupRooms.find(r => r.roomName === selectedSpace)?.memberCount || directRooms.find(r => r.roomName === selectedSpace)?.memberCount || 0}人のメンバー`}
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
        <div className="messages-container">
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
                    <strong>{isEventApiConnected ? '接続中' : '切断中'}</strong>
                    <span>リアルタイム通信</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 初回読み込み表示 */}
                {isLoadingMessages && messages.length === 0 && (
                  <div className="loading-message">
                    <div className="loading-spinner"></div>
                    <div>メッセージを読み込み中...</div>
                  </div>
                )}
                
                {/* 古いメッセージ読み込み */}
                {hasMoreMessages && messages.length > 0 && (
                  <div className="load-more-container">
                    <button 
                      className="load-more-btn" 
                      onClick={loadMoreMessages}
                      disabled={isLoadingMessages}
                    >
                      {isLoadingMessages ? '読み込み中...' : '過去のメッセージを読み込む'}
                    </button>
                  </div>
                )}
                
                {/* メッセージリスト */}
                {messages.map((message, index) => {
                  const showAvatar = index === 0 || messages[index - 1].userId !== message.userId;
                  const isLastFromUser = index === messages.length - 1 || messages[index + 1]?.userId !== message.userId;
                  
                  return (
                    <div 
                      key={message.messageId || message.id} 
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
                        {message.isOptimistic && (
                          <div className="message-status">送信中...</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
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
            {!isEventApiConnected && (
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