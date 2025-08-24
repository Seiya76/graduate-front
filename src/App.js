import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { Amplify, API, Auth } from 'aws-amplify';
import config from './aws-exports.js';
import { getCurrentUser, getUser } from './graphql/queries';

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
    // 1. DynamoDBのnicknameを優先
    if (currentUserData?.nickname) return currentUserData.nickname;
    
    // 2. OIDC profileのnameを使用
    if (user.profile.name) return user.profile.name;
    
    // 3. emailのローカル部分を使用
    if (user.profile.email) return user.profile.email.split('@')[0];
    
    // 4. フォールバック
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
                <span className="status-text">
                  {currentUserData?.status || 'オンライン'}
                </span>
                {currentUserData?.emailVerified && (
                  <span className="verified-badge" title="メール認証済み">✓</span>
                )}
              </div>
              {currentUserData ? (
                <div className="user-email">{currentUserData.email}</div>
              ) : (
                <div className="user-email">{user.profile.email}</div>
              )}
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
  const auth = useAuth();
  const [currentUserData, setCurrentUserData] = useState(null);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [userDataError, setUserDataError] = useState(null);

  // 認証完了後にDynamoDBからユーザーデータを取得
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      fetchCurrentUserData();
    } else {
      setCurrentUserData(null);
      setUserDataError(null);
    }
  }, [auth.isAuthenticated, auth.user]);

  const fetchCurrentUserData = async () => {
    try {
      setIsLoadingUserData(true);
      setUserDataError(null);

      // OIDCトークンを使用してAmplify Authに認証情報を設定
      if (auth.user?.access_token) {
        // アクセストークンをAmplifyに設定
        const credentials = await Auth.federatedSignIn(
          'cognito-idp',
          {
            token: auth.user.access_token,
            expires_at: auth.user.expires_at
          },
          auth.user
        );
        console.log('Amplify credentials set:', credentials);
      }

      // CognitoのsubIdを使用してDynamoDBからユーザー情報を取得
      const userId = auth.user.profile.sub;
      console.log('Fetching user data for userId:', userId);

      const result = await API.graphql({
        query: getUser,
        variables: { userId: userId },
        authMode: 'AMAZON_COGNITO_USER_POOLS'
      });

      console.log('GraphQL result:', result);
      setCurrentUserData(result.data.getUser);

    } catch (error) {
      console.error('Error fetching user data from DynamoDB:', error);
      setUserDataError(error);
      
      // エラーログの詳細を出力
      if (error.errors) {
        console.error('GraphQL errors:', error.errors);
      }
    } finally {
      setIsLoadingUserData(false);
    }
  };

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
        <div>認証情報を読み込み中...</div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="error-screen">
        <div className="error-message">
          認証エラーが発生しました: {auth.error.message}
        </div>
        <button onClick={() => window.location.reload()} className="retry-btn">
          再読み込み
        </button>
      </div>
    );
  }

  // 認証済みの場合はチャット画面を表示
  if (auth.isAuthenticated) {
    return (
      <div>
        {/* ユーザーデータの読み込み状態を表示 */}
        {isLoadingUserData && (
          <div className="user-data-loading">
            <small>ユーザー情報を読み込み中...</small>
          </div>
        )}
        
        {/* ユーザーデータ取得エラーの表示（アプリは続行） */}
        {userDataError && !currentUserData && (
          <div className="user-data-error">
            <small>
              ユーザー詳細情報の取得に失敗しました
              <button onClick={fetchCurrentUserData} className="retry-small-btn">
                再試行
              </button>
            </small>
          </div>
        )}

        <ChatScreen 
          user={auth.user} 
          currentUserData={currentUserData}
          onSignOut={signOutRedirect} 
        />
      </div>
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