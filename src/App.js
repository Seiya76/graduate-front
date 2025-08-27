import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import config from './aws-exports.js';

Amplify.configure(config);

const client = generateClient();

// GraphQLクエリを直接定義
const GET_USER = `
  query GetUser($userId: ID!) {
    getUser(userId: $userId) {
      userId
      createdAt
      email
      emailVerified
      nickname
      status
      updatedAt
    }
  }
`;

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
    }
  }
`;

// ルーム関連のGraphQLクエリ
const GET_USER_ROOMS = `
  query GetUserRooms($userId: ID!, $limit: Int, $nextToken: String) {
    getUserRooms(userId: $userId, limit: $limit, nextToken: $nextToken) {
      items {
        roomId
        roomName
        roomType
        createdBy
        lastMessage
        lastMessageAt
        memberCount
        updatedAt
      }
      nextToken
    }
  }
`;

const CREATE_GROUP_ROOM = `
  mutation CreateGroupRoom($input: CreateGroupRoomInput!) {
    createGroupRoom(input: $input) {
      roomId
      roomName
      roomType
      createdBy
      createdAt
      memberCount
      updatedAt
    }
  }
`;

const CREATE_DIRECT_ROOM = `
  mutation CreateDirectRoom($targetUserId: ID!, $createdBy: ID!) {
    createDirectRoom(targetUserId: $targetUserId, createdBy: $createdBy) {
      roomId
      roomName
      roomType
      createdBy
      createdAt
      memberCount
      updatedAt
    }
  }
`;

// ユーザー検索クエリ
const SEARCH_USERS = `
  query SearchUsers($searchTerm: String!, $limit: Int) {
    searchUsers(searchTerm: $searchTerm, limit: $limit) {
      items {
        userId
        nickname
        email
        status
      }
    }
  }
`;

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [currentUser, setCurrentUser] = useState(null);
  const [userRooms, setUserRooms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "システム",
      content: "チャットへようこそ！",
      time: "10:00",
      isOwn: false,
      avatar: "SY"
    },
    {
      id: 2,
      sender: "田中太郎",
      content: "おはようございます！今日もよろしくお願いします。",
      time: "10:15",
      isOwn: false,
      avatar: "TT"
    },
    {
      id: 3,
      sender: "佐藤花子",
      content: "プロジェクトの進捗はいかがでしょうか？",
      time: "10:30",
      isOwn: false,
      avatar: "SH"
    }
  ]);
  const [newMessage, setNewMessage] = useState("");

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
            query: GET_USER,
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
          query: GET_USER_ROOMS,
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

  // ユーザー検索機能
  const searchUsers = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Searching users:', searchTerm);
      const result = await client.graphql({
        query: SEARCH_USERS,
        variables: { 
          searchTerm: searchTerm.trim(),
          limit: 20 
        },
        authMode: 'apiKey'
      });

      if (result.data.searchUsers?.items) {
        // 現在のユーザーを除外
        const filteredUsers = result.data.searchUsers.items.filter(
          u => u.userId !== currentUser?.userId
        );
        console.log('Search results:', filteredUsers);
        setSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 検索のデバウンス処理
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchUsers(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 500); // 500ms後に検索実行

    return () => clearTimeout(timer);
  }, [searchTerm, currentUser]);

  // グループルーム作成
  const createGroupRoom = async () => {
    if (!newRoomName.trim() || !currentUser?.userId) return;

    try {
      console.log('Creating room:', newRoomName, selectedUsers);
      const result = await client.graphql({
        query: CREATE_GROUP_ROOM,
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
        console.log('Room created:', result.data.createGroupRoom);
        // ルーム一覧を更新
        const newRoom = {
          ...result.data.createGroupRoom,
          lastMessage: "未入力",
          lastMessageAt: result.data.createGroupRoom.createdAt
        };
        setUserRooms(prev => [newRoom, ...prev]);
        
        // フォームをリセット
        setNewRoomName("");
        setSelectedUsers([]);
        setIsCreatingRoom(false);
        setSearchTerm("");
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      alert('ルーム作成でエラーが発生しました: ' + error.message);
    }
  };

  // ダイレクトルーム作成
  const createDirectRoom = async (targetUserId) => {
    if (!currentUser?.userId || !targetUserId) return;

    try {
      console.log('Creating direct room with:', targetUserId);
      const result = await client.graphql({
        query: CREATE_DIRECT_ROOM,
        variables: {
          targetUserId: targetUserId,
          createdBy: currentUser.userId
        },
        authMode: 'userPool'
      });

      if (result.data.createDirectRoom) {
        console.log('Direct room created:', result.data.createDirectRoom);
        // ルーム一覧を更新
        const newRoom = {
          ...result.data.createDirectRoom,
          lastMessage: "未入力",
          lastMessageAt: result.data.createDirectRoom.createdAt
        };
        setUserRooms(prev => [newRoom, ...prev]);
      }
    } catch (error) {
      console.error('Error creating direct room:', error);
      alert('ダイレクトルーム作成でエラーが発生しました: ' + error.message);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const displayName = currentUser?.nickname || user.profile.name || user.profile.email.split('@')[0];
      const message = {
        id: messages.length + 1,
        sender: displayName,
        content: newMessage,
        time: new Date().toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: true,
        avatar: displayName.substring(0, 2).toUpperCase()
      };
      setMessages([...messages, message]);
      setNewMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
                <button onClick={() => {
                  setIsCreatingRoom(false);
                  setSearchTerm("");
                  setSearchResults([]);
                  setSelectedUsers([]);
                  setNewRoomName("");
                }}>×</button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  placeholder="ルーム名"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="room-name-input"
                />
                
                {/* ユーザー検索 */}
                <div className="user-search-section">
                  <h4>メンバーを検索して追加:</h4>
                  <div className="search-container">
                    <input
                      type="text"
                      placeholder="名前またはメールアドレスで検索"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="user-search-input"
                    />
                    {isSearching && <div className="search-loading">検索中...</div>}
                  </div>
                  
                  {/* 検索結果 */}
                  {searchResults.length > 0 && (
                    <div className="search-results">
                      {searchResults.map(user => (
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
                          >
                            {selectedUsers.includes(user.userId) ? '削除' : '追加'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {searchTerm && searchResults.length === 0 && !isSearching && (
                    <div className="no-results">該当するユーザーが見つかりませんでした</div>
                  )}
                </div>

                {/* 選択されたユーザー一覧 */}
                {selectedUsers.length > 0 && (
                  <div className="selected-users-section">
                    <h4>選択されたメンバー ({selectedUsers.length}人):</h4>
                    <div className="selected-users-list">
                      {selectedUsers.map(userId => {
                        const user = searchResults.find(u => u.userId === userId);
                        return user ? (
                          <div key={userId} className="selected-user-item">
                            <div className="user-avatar-small">
                              {(user.nickname || user.email).substring(0, 2).toUpperCase()}
                            </div>
                            <span>{user.nickname || user.email}</span>
                            <button
                              className="remove-user-btn"
                              onClick={() => toggleUserSelection(userId)}
                            >×</button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button onClick={() => {
                  setIsCreatingRoom(false);
                  setSearchTerm("");
                  setSearchResults([]);
                  setSelectedUsers([]);
                  setNewRoomName("");
                }}>キャンセル</button>
                <button 
                  onClick={createGroupRoom} 
                  disabled={!newRoomName.trim()}
                  className="create-room-btn"
                >
                  作成 {selectedUsers.length > 0 && `(${selectedUsers.length + 1}人)`}
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
                  className="nav-item dm-item"
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="dm-search-input"
              />
              
              {/* DM用検索結果 */}
              {searchResults.length > 0 && searchTerm && (
                <div className="dm-search-results">
                  {searchResults.filter(user => 
                    !directRooms.some(room => room.roomName.includes(user.nickname || user.email))
                  ).map((user) => (
                    <div 
                      key={user.userId} 
                      className="dm-search-result-item"
                      onClick={() => {
                        createDirectRoom(user.userId);
                        setSearchTerm("");
                        setSearchResults([]);
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
                    <strong>{searchResults.length}</strong>
                    <span>検索結果のユーザー</span>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`message-item ${message.isOwn ? 'own-message' : ''}`}
                >
                  {!message.isOwn && (
                    <div className="message-avatar user-avatar">{message.avatar}</div>
                  )}
                  <div className="message-content">
                    <div className="message-header">
                      <span className="sender-name">{message.sender}</span>
                      <span className="message-time">{message.time}</span>
                    </div>
                    <div className="message-text">{message.content}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* メッセージ入力 */}
        {selectedSpace !== "ホーム" && (
          <div className="message-input-area">
            <div className="input-container">
              <button className="attach-btn" title="ファイル添付"></button>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`${selectedSpace}にメッセージを送信`}
                className="message-input"
                rows="1"
              />
              <div className="input-actions">
                <button className="icon-btn emoji-btn" title="絵文字"></button>
                <button 
                  onClick={sendMessage} 
                  className={`send-btn ${newMessage.trim() ? 'active' : ''}`}
                  disabled={!newMessage.trim()}
                  title="送信"
                >
                </button>
              </div>
            </div>
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