// App.js の修正版 - GraphQL Subscriptionを完全に削除してEvent APIのみ使用

import React, { useState, useEffect, useCallback, useRef } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import config from './aws-exports.js';

// Event APIクライアントをインポート
import { getEventAPIClient } from './eventApiClient.js';

// GraphQLクエリをインポート（Subscriptionは除く）
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

// ⚠️ Subscriptionのインポートを削除
// import { 
//   onRoomUpdate,
//   onNewMessage,
//   onMessageDeleted
// } from './graphql/subscriptions';

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

function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [currentUser, setCurrentUser] = useState(null);
  const [userRooms, setUserRooms] = useState([]);
  
  // モーダル関連のstate
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState([]);
  const [isModalSearching, setIsModalSearching] = useState(false);
  
  // ダイレクトメッセージ関連のstate
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
  
  // Event API関連のstate
  const [isEventApiConnected, setIsEventApiConnected] = useState(false);
  const [eventApiError, setEventApiError] = useState(null);

  // ref
  const eventApiSubscriptionsRef = useRef([]);
  const messagesEndRef = useRef(null);

  // Event APIクライアント
  const eventApiClient = getEventAPIClient();

  // 選択されたルームのID取得
  const selectedRoomId = React.useMemo(() => {
    if (selectedSpace === "ホーム") return null;
    
    const groupRoom = userRooms.find(room => room.roomName === selectedSpace && room.roomType === 'group');
    if (groupRoom) return groupRoom.roomId;
    
    const directRoom = userRooms.find(room => room.roomName === selectedSpace && room.roomType === 'direct');
    if (directRoom) return directRoom.roomId;
    
    return null;
  }, [selectedSpace, userRooms]);

  // 自動スクロール
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  // ユーザー情報取得
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const oidcSub = user.profile.sub;
        const email = user.profile.email;
        
        console.log('Fetching user info for:', { oidcSub, email });
        
        let result = null;
        
        try {
          result = await client.graphql({
            query: getUser,
            variables: { userId: oidcSub },
            authMode: 'apiKey'
          });
          
          if (result.data.getUser) {
            console.log('User found:', result.data.getUser);
            setCurrentUser(result.data.getUser);
            return;
          }
        } catch (userIdError) {
          console.log('User not found by userId, trying email...');
        }
        
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
            console.log('User not found by email');
          }
        }
        
        // フォールバック
        const fallbackUser = {
          userId: oidcSub,
          nickname: user.profile.name || user.profile.preferred_username,
          email: email,
          status: 'active'
        };
        console.log('Using fallback user:', fallbackUser);
        setCurrentUser(fallbackUser);
        
      } catch (error) {
        console.error('Error fetching current user:', error);
        setCurrentUser({
          userId: user.profile.sub,
          nickname: user.profile.name || user.profile.preferred_username,
          email: user.profile.email,
          status: 'active'
        });
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

  // Event APIサブスクリプション設定（GraphQL Subscriptionを完全に置き換え）
  useEffect(() => {
    // 既存のEvent APIサブスクリプションをクリーンアップ
    eventApiSubscriptionsRef.current.forEach(subscriptionId => {
      eventApiClient.unsubscribe(subscriptionId);
    });
    eventApiSubscriptionsRef.current = [];

    if (!selectedRoomId || !currentUser?.userId) {
      setIsEventApiConnected(false);
      return;
    }

    try {
      console.log('Setting up Event API subscriptions for room:', selectedRoomId);

      // リアルタイムメッセージのサブスクリプション
      const messageSubscriptionId = eventApiClient.subscribeToRoomMessages(selectedRoomId, (realtimeMessage) => {
        console.log('New message from Event API:', realtimeMessage);
        
        // 既存のメッセージからユーザー情報を推定
        const existingMessage = messages.find(msg => msg.userId === realtimeMessage.userId);
        const userInfo = existingMessage || { sender: '不明なユーザー', avatar: 'UN' };
        
        const formattedMessage = {
          id: realtimeMessage.messageId,
          messageId: realtimeMessage.messageId,
          sender: userInfo.sender,
          content: realtimeMessage.content,
          time: new Date(realtimeMessage.createdAt || realtimeMessage.timestamp).toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          isOwn: realtimeMessage.userId === currentUser?.userId,
          avatar: userInfo.avatar,
          userId: realtimeMessage.userId,
          createdAt: realtimeMessage.createdAt || realtimeMessage.timestamp
        };
        
        setMessages(prevMessages => {
          // 重複チェック
          const exists = prevMessages.some(msg => msg.messageId === formattedMessage.messageId);
          if (!exists) {
            scrollToBottom();
            return [...prevMessages, formattedMessage];
          }
          return prevMessages;
        });
        
        setIsEventApiConnected(true);
        setEventApiError(null);
      });

      eventApiSubscriptionsRef.current.push(messageSubscriptionId);

      // ルーム更新のサブスクリプション
      const roomUpdateSubscriptionId = eventApiClient.subscribeToRoomUpdates((roomUpdateEvent) => {
        console.log('Room update from Event API:', roomUpdateEvent);
        
        setUserRooms(prevRooms => 
          prevRooms.map(room => 
            room.roomId === roomUpdateEvent.roomId
              ? {
                  ...room,
                  lastMessage: roomUpdateEvent.content,
                  lastMessageAt: roomUpdateEvent.timestamp
                }
              : room
          )
        );
      });

      eventApiSubscriptionsRef.current.push(roomUpdateSubscriptionId);
      
    } catch (error) {
      console.error('Event API subscription setup error:', error);
      setEventApiError('リアルタイム接続でエラーが発生しました');
    }

    return () => {
      eventApiSubscriptionsRef.current.forEach(subscriptionId => {
        eventApiClient.unsubscribe(subscriptionId);
      });
      eventApiSubscriptionsRef.current = [];
    };
  }, [selectedRoomId, currentUser?.userId, eventApiClient, messages, scrollToBottom]);

  // Event API接続状態監視
  useEffect(() => {
    const checkConnection = () => {
      const state = eventApiClient.getConnectionState();
      setIsEventApiConnected(state === 'connected');
      
      if (state === 'connected') {
        setEventApiError(null);
      }
    };

    const interval = setInterval(checkConnection, 2000);
    checkConnection(); // 初回実行
    
    return () => clearInterval(interval);
  }, [eventApiClient]);

  // メッセージ送信
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedRoomId || !currentUser?.userId || isSendingMessage) {
      return;
    }

    if (newMessage.length > 2000) {
      alert('メッセージが長すぎます（2000文字以内）');
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage("");
    setIsSendingMessage(true);
    setMessageError(null);
    
    try {
      console.log('Sending message via GraphQL API to room:', selectedRoomId);
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
      
      console.log('Message sent successfully:', result.data?.sendMessage);
      
    } catch (err) {
      console.error('メッセージ送信エラー:', err);
      
      let errorMessage = 'メッセージの送信に失敗しました';
      if (err.errors && err.errors.length > 0) {
        errorMessage += ': ' + err.errors[0].message;
      } else if (err.message) {
        errorMessage += ': ' + err.message;
      }
      
      setMessageError(errorMessage);
      setNewMessage(messageContent);
      alert(errorMessage);
    } finally {
      setIsSendingMessage(false);
    }
  }, [newMessage, selectedRoomId, currentUser, isSendingMessage]);

  // ルーム変更時のメッセージ取得
  useEffect(() => {
    if (selectedRoomId && currentUser?.userId) {
      fetchMessages(selectedRoomId);
    } else {
      setMessages([]);
      setMessageError(null);
    }
  }, [selectedRoomId, currentUser?.userId, fetchMessages]);

  // その他の関数は既存のものをそのまま使用
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const loadMoreMessages = useCallback(() => {
    if (!hasMoreMessages || isLoadingMessages || !selectedRoomId) return;
    fetchMessages(selectedRoomId, true);
  }, [hasMoreMessages, isLoadingMessages, selectedRoomId, fetchMessages]);

  const searchUsersForModal = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setModalSearchResults([]);
      return;
    }

    setIsModalSearching(true);
    try {
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
        setModalSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setModalSearchResults([]);
    } finally {
      setIsModalSearching(false);
    }
  };

  const searchUsersForDM = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setDmSearchResults([]);
      return;
    }

    setIsDmSearching(true);
    try {
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
        setDmSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error('Error searching users for DM:', error);
      setDmSearchResults([]);
    } finally {
      setIsDmSearching(false);
    }
  };

  // デバウンス処理
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

  const createGroupRoom_func = async () => {
    if (!newRoomName.trim() || !currentUser?.userId) return;

    setIsRoomCreationLoading(true);
    try {
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
        const createdRoom = result.data.createGroupRoom;
        const newRoom = {
          ...createdRoom,
          lastMessage: createdRoom.lastMessage || "未入力",
          lastMessageAt: createdRoom.lastMessageAt || createdRoom.createdAt
        };
        setUserRooms(prev => [newRoom, ...prev]);
        resetModal();
        alert(`ルーム「${newRoomName}」を作成しました。`);
        setSelectedSpace(createdRoom.roomName);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      alert('ルーム作成でエラーが発生しました: ' + (error.message || 'Unknown error'));
    } finally {
      setIsRoomCreationLoading(false);
    }
  };

  const createDirectRoom_func = async (targetUserId) => {
    if (!currentUser?.userId || !targetUserId) return;

    try {
      const result = await client.graphql({
        query: createDirectRoom,
        variables: {
          targetUserId: targetUserId,
          createdBy: currentUser.userId
        },
        authMode: 'apiKey'
      });

      if (result.data.createDirectRoom) {
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
      alert('ダイレクトルーム作成でエラーが発生しました');
    }
  };

  const getDisplayName = () => {
    return currentUser?.nickname || user.profile.name || user.profile.email.split('@')[0];
  };

  const getDisplayAvatar = () => {
    const name = getDisplayName();
    return name.substring(0, 2).toUpperCase();
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const resetModal = () => {
    setIsCreatingRoom(false);
    setIsRoomCreationLoading(false);
    setModalSearchTerm("");
    setModalSearchResults([]);
    setSelectedUsers([]);
    setNewRoomName("");
  };

  const groupRooms = userRooms.filter(room => room.roomType === 'group');
  const directRooms = userRooms.filter(room => room.roomType === 'direct');

  // 🔥 ここから先は既存のJSX return部分と同じ
  // （提供済みのUIコードを使用）
  
  return (
    <div className="chat-app">
      {/* 既存のUI部分はそのまま使用 */}
      {/* ... */}
    </div>
  );
}

// 残りの部分は既存のコードと同じ
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

  if (auth.isAuthenticated) {
    return <ChatScreen user={auth.user} onSignOut={signOutRedirect} />;
  }

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