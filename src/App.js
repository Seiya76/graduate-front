import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { Amplify, Auth, API } from 'aws-amplify';
import config from './aws-exports.js';
import { getCurrentUser } from './graphql/queries';

Amplify.configure(config);

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut, currentUserData }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
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

  // ユーザー名の取得（DynamoDBデータを優先）
  const getUserDisplayName = () => {
    if (currentUserData?.nickname) return currentUserData.nickname;
    if (user?.username) return user.username;
    if (user?.attributes?.email) return user.attributes.email.split('@')[0];
    return "ユーザー";
  };

  // アバター用の文字を取得
  const getUserAvatar = () => {
    const name = getUserDisplayName();
    return name.substring(0, 2).toUpperCase();
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: messages.length + 1,
        sender: getUserDisplayName(),
        content: newMessage,
        time: new Date().toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: true,
        avatar: getUserAvatar()
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

        {/* ユーザー情報表示 */}
        <div className="user-info-section">
          <div className="current-user-info">
            <div className="user-avatar large">{getUserAvatar()}</div>
            <div className="user-details">
              <div className="user-name">{getUserDisplayName()}</div>
              <div className="user-status">
                {currentUserData?.status || 'オンライン'}
                {currentUserData?.emailVerified && (
                  <span className="verified-badge" title="メール認証済み">✓</span>
                )}
              </div>
            </div>
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
  const [user, setUser] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 認証状態とユーザーデータの取得
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      // Cognito認証状態をチェック
      const currentUser = await Auth.currentAuthenticatedUser();
      console.log('Current authenticated user:', currentUser);
      setUser(currentUser);

      // DynamoDBからユーザー詳細情報を取得
      await fetchCurrentUserData();
      
    } catch (error) {
      console.log('User not authenticated:', error);
      setUser(null);
      setCurrentUserData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentUserData = async () => {
    try {
      const result = await API.graphql({
        query: getCurrentUser,
        authMode: 'AMAZON_COGNITO_USER_POOLS'
      });

      console.log('GraphQL result:', result);
      setCurrentUserData(result.data.getCurrentUser);
      
    } catch (error) {
      console.error('Error fetching user data from DynamoDB:', error);
      setError(error);
    }
  };

  const signIn = () => {
    Auth.federatedSignIn()
      .then(() => {
        console.log('Sign in initiated');
        // 認証後の状態チェックはAuth.onAuthStateChangeで処理される
      })
      .catch(err => {
        console.error('Sign in error:', err);
        setError(err);
      });
  };

  const signOut = async () => {
    try {
      await Auth.signOut();
      setUser(null);
      setCurrentUserData(null);
      
      // カスタムログアウトURLへリダイレクト
      const clientId = "5buno8gs9brj93apmu9tvqqp77";
      const logoutUri = "https://main.d3rgq9lalaa9gb.amplifyapp.com";
      const cognitoDomain = "https://ap-northeast-1ncffaodbj.auth.ap-northeast-1.amazoncognito.com";
      window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
      
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // 認証状態の変更を監視
  useEffect(() => {
    const unsubscribe = Auth.onAuthStateChange((authState, authUser) => {
      console.log('Auth state changed:', authState, authUser);
      
      if (authState === 'signedIn') {
        setUser(authUser);
        fetchCurrentUserData();
      } else if (authState === 'signedOut') {
        setUser(null);
        setCurrentUserData(null);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div>読み込み中...</div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="error-screen">
        <div className="error-message">
          エラーが発生しました: {error.message}
        </div>
        <button onClick={checkAuthState} className="retry-btn">
          再試行
        </button>
      </div>
    );
  }

  // 認証済みの場合はチャット画面を表示
  if (user) {
    return (
      <ChatScreen 
        user={user} 
        currentUserData={currentUserData}
        onSignOut={signOut} 
      />
    );
  }

  // 未認証の場合はログイン画面を表示
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h1>G00gleChat</h1>
        <div className="auth-buttons">
          <button 
            onClick={signIn} 
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