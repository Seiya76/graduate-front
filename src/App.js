import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";

// ===== ここに追加 =====
import { generateClient } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import config from './aws-exports';

// Amplify設定
Amplify.configure(config);

// AppSync接続テスト（一時的なテスト用）
const testAppSyncConnection = async () => {
  try {
    console.log('🔧 設定情報:', {
      endpoint: config.API.GraphQL.endpoint,
      region: config.API.GraphQL.region,
      authMode: config.API.GraphQL.defaultAuthMode,
      userPoolId: config.Auth?.userPoolId,
      clientId: config.Auth?.userPoolWebClientId
    });

    // 基本的な接続テスト
    const basicTest = await fetch(config.API.GraphQL.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ __typename }'
      })
    });
    
    console.log('🌐 基本接続テスト:', {
      status: basicTest.status,
      statusText: basicTest.statusText,
      ok: basicTest.ok
    });
    
    if (basicTest.status === 401) {
      console.log('✅ 認証が必要（正常）- AppSync エンドポイント接続OK');
    } else if (basicTest.ok) {
      console.log('✅ AppSync エンドポイント接続OK');
    } else {
      console.log('❌ AppSync エンドポイント接続NG');
    }

    return true;
  } catch (error) {
    console.error('❌ AppSync設定エラー:', error);
    return false;
  }
};

// OIDC認証テスト
const testWithOIDCAuth = async (oidcUser) => {
  try {
    console.log('🔐 OIDC認証情報テスト:', {
      hasUser: !!oidcUser,
      hasIdToken: !!oidcUser?.id_token,
      hasAccessToken: !!oidcUser?.access_token,
      userId: oidcUser?.profile?.sub,
      email: oidcUser?.profile?.email
    });

    if (!oidcUser || !oidcUser.id_token) {
      console.warn('⚠️ OIDC認証情報が不完全');
      return false;
    }

    // 認証付きクライアント作成
    const client = generateClient({
      authMode: 'userPool',
      authToken: oidcUser.id_token
    });

    console.log('✅ 認証付きクライアント作成完了');

    // 簡単なGraphQLテスト
    const testQuery = `query TestAuth { __typename }`;
    const result = await client.graphql({
      query: testQuery
    });
    
    console.log('✅ 認証付きGraphQLテスト成功:', result);
    return true;
    
  } catch (error) {
    console.error('❌ OIDC認証テストエラー:', error);
    return false;
  }
};
// ===== 追加終了 =====

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
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

  // ===== ここに追加 =====
  // AppSync接続テスト（ユーザーログイン後）
  useEffect(() => {
    if (user) {
      console.log('👤 ユーザーログイン完了、AppSyncテスト開始');
      
      // 基本接続テスト
      testAppSyncConnection().then(basicResult => {
        console.log('📊 基本接続テスト結果:', basicResult);
        
        // OIDC認証テスト
        testWithOIDCAuth(user).then(authResult => {
          console.log('🔐 認証テスト結果:', authResult);
        });
      });
    }
  }, [user]);
  // ===== 追加終了 =====

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

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: messages.length + 1,
        sender: user.profile.name || user.profile.email.split('@')[0],
        content: newMessage,
        time: new Date().toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: true,
        avatar: user.profile.name ? user.profile.name.substring(0, 2).toUpperCase() : user.profile.email.substring(0, 2).toUpperCase()
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
      {/* ===== デバッグ情報表示（一時的） ===== */}
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: '#e8f5e8',
        color: '#2e7d32',
        padding: '10px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 1000,
        maxWidth: '300px'
      }}>
        <div><strong>🔧 AppSync接続テスト</strong></div>
        <div>ユーザーID: {user?.profile?.sub}</div>
        <div>Email: {user?.profile?.email}</div>
        <div>Token有無: {user?.id_token ? '✅' : '❌'}</div>
        <div style={{ fontSize: '10px', marginTop: '5px' }}>
          ブラウザのコンソール(F12)でテスト結果を確認してください
        </div>
      </div>
      {/* ===== デバッグ情報終了 ===== */}

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

  // ===== ここに追加 =====
  // アプリ起動時の基本テスト
  useEffect(() => {
    console.log('🚀 アプリ起動 - AppSync基本設定テスト');
    testAppSyncConnection();
  }, []);
  // ===== 追加終了 =====

  const signOutRedirect = () => {
    const clientId = "8pua3oe15pci4ci7m0misd8eu";
    const logoutUri = "https://main.d3rgq9lalaa9gb.amplifyapp.com/";
    const cognitoDomain =
      "https://ap-northeast-1u9yhtfywo.auth.ap-northeast-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
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