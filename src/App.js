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

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [currentUser, setCurrentUser] = useState(null);
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

  const spaces = [
    { name: "ホーム", icon: "home", type: "home" },
    { name: "開発チーム", icon: "team", type: "space" },
    { name: "マーケティング", icon: "chart", type: "space" },
    { name: "デザイン", icon: "design", type: "space" },
    { name: "プロジェクトA", icon: "folder", type: "space" }
  ];

  const recentChats = [
    { name: "田中太郎", lastMessage: "資料の件、確認しました", time: "11:54", avatar: "TT" },
    { name: "佐藤花子", lastMessage: "会議の時間を変更できますか？", time: "11:30", avatar: "SH" },
    { name: "鈴木一郎", lastMessage: "今日はお疲れ様でした", time: "昨日", avatar: "SI" },
    { name: "山田美咲", lastMessage: "新しいデザインはいかがですか？", time: "昨日", avatar: "YM" }
  ];

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
          <button className="new-chat-btn">
            <span className="plus-icon">+</span>
            新しいチャット
          </button>
        </div>

        {/* ナビゲーション */}
        <div className="nav-section">
          <div className="nav-group">
            <div className="nav-group-header">ショートカット</div>
            {spaces.map((space) => (
              <div 
                key={space.name}
                className={`nav-item ${selectedSpace === space.name ? 'active' : ''}`}
                onClick={() => setSelectedSpace(space.name)}
              >
                <span className={`nav-icon icon-${space.icon}`}></span>
                <span className="nav-text">{space.name}</span>
              </div>
            ))}
          </div>

          <div className="nav-group">
            <div className="nav-group-header">ダイレクト メッセージ</div>
            {recentChats.map((chat) => (
              <div key={chat.name} className="nav-item dm-item">
                <span className="nav-icon user-avatar">{chat.avatar}</span>
                <span className="nav-text">{chat.name}</span>
                <div className="status-indicator online"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="main-content">
        {/* チャットヘッダー */}
        <div className="chat-header">
          <div className="chat-info">
            <h2 className="chat-title">{selectedSpace}</h2>
            <div className="chat-subtitle">3人のメンバー</div>
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
            {messages.map((message) => (
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
            ))}
          </div>
        </div>

        {/* メッセージ入力 */}
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