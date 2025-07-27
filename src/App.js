import React, { useState, useEffect, useCallback } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { generateClient } from 'aws-amplify/api';

// GraphQL imports
import { createUser, createChannel, createMessage, joinChannel } from './graphql/mutations';
import { getUser, getUserChannels, listMessages } from './graphql/queries';
import { onCreateMessage } from './graphql/subscriptions';

// AppSync client setup
const client = generateClient({
  authMode: 'userPool'
});

// AppSync統合ユーティリティ
const AppSyncService = {
  // ユーザー作成
  async createUser(userInput) {
    try {
      const response = await client.graphql({
        query: createUser,
        variables: { input: userInput }
      });
      return response.data.createUser;
    } catch (error) {
      console.error('❌ ユーザー作成エラー:', error);
      throw error;
    }
  },

  // ユーザー取得
  async getUser(userId) {
    try {
      const response = await client.graphql({
        query: getUser,
        variables: { userId }
      });
      return response.data.getUser;
    } catch (error) {
      console.error('❌ ユーザー取得エラー:', error);
      return null;
    }
  },

  // チャンネル作成
  async createChannel(channelInput) {
    try {
      const response = await client.graphql({
        query: createChannel,
        variables: { input: channelInput }
      });
      return response.data.createChannel;
    } catch (error) {
      console.error('❌ チャンネル作成エラー:', error);
      throw error;
    }
  },

  // チャンネル参加
  async joinChannel(channelId) {
    try {
      const response = await client.graphql({
        query: joinChannel,
        variables: { channelId }
      });
      return response.data.joinChannel;
    } catch (error) {
      console.error('❌ チャンネル参加エラー:', error);
      throw error;
    }
  },

  // ユーザーチャンネル取得
  async getUserChannels(userId) {
    try {
      const response = await client.graphql({
        query: getUserChannels,
        variables: { userId }
      });
      return response.data.getUserChannels || [];
    } catch (error) {
      console.error('❌ ユーザーチャンネル取得エラー:', error);
      return [];
    }
  },

  // メッセージ送信
  async sendMessage(messageInput) {
    try {
      const response = await client.graphql({
        query: createMessage,
        variables: { input: messageInput }
      });
      return response.data.createMessage;
    } catch (error) {
      console.error('❌ メッセージ送信エラー:', error);
      throw error;
    }
  },

  // メッセージ取得
  async getMessages(channelId, limit = 50) {
    try {
      const response = await client.graphql({
        query: listMessages,
        variables: { channelId, limit }
      });
      return response.data.listMessages.items || [];
    } catch (error) {
      console.error('❌ メッセージ取得エラー:', error);
      return [];
    }
  },

  // メッセージサブスクリプション
  subscribeToMessages(channelId, onMessage, onError = console.error) {
    try {
      const subscription = client.graphql({
        query: onCreateMessage,
        variables: { channelId }
      }).subscribe({
        next: ({ data }) => {
          if (data.onCreateMessage) {
            onMessage(data.onCreateMessage);
          }
        },
        error: onError
      });

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error('❌ サブスクリプションエラー:', error);
      return () => {};
    }
  }
};

// Google Chat風のチャット画面コンポーネント（AppSync対応）
function ChatScreen({ user, onSignOut }) {
  // 状態管理
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscriptions, setSubscriptions] = useState(new Map());

  // ユーザー初期化
  const initializeUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = user.profile.sub;
      console.log('👤 ユーザー初期化開始:', userId);

      // 既存ユーザーの確認
      let userData = await AppSyncService.getUser(userId);
      
      if (!userData) {
        // 新規ユーザーの作成
        console.log('🆕 新規ユーザー作成中...');
        userData = await AppSyncService.createUser({
          username: user.profile.name || user.profile.email.split('@')[0],
          displayName: user.profile.name || user.profile.email.split('@')[0]
        });
        console.log('✅ ユーザー作成完了:', userData);
      } else {
        console.log('👋 既存ユーザー:', userData);
      }

      setCurrentUser(userData);

      // ユーザーのチャンネル一覧を取得
      const userChannels = await AppSyncService.getUserChannels(userId);
      console.log('📋 ユーザーチャンネル:', userChannels);

      if (userChannels.length === 0) {
        await createDefaultChannels();
      } else {
        // 既存チャンネルをUI用に変換
        const channelList = userChannels.map(uc => ({
          channelId: uc.channelId,
          name: `Channel ${uc.channelId.slice(-6)}`,
          description: '既存チャンネル',
          icon: 'home'
        }));
        setChannels(channelList);
        if (channelList.length > 0) {
          setSelectedSpace(channelList[0]);
        }
      }

    } catch (error) {
      console.error('❌ ユーザー初期化エラー:', error);
      setError(`ユーザー初期化に失敗しました: ${error.message}`);
      // エラーでも基本的なユーザー情報は設定
      setCurrentUser({
        userId: user.profile.sub,
        username: user.profile.name || user.profile.email.split('@')[0],
        email: user.profile.email
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // デフォルトチャンネル作成
  const createDefaultChannels = async () => {
    try {
      const defaultChannels = [
        { name: "ホーム", description: "一般的な会話", icon: "home" },
        { name: "開発チーム", description: "開発に関する議論", icon: "team" },
        { name: "マーケティング", description: "マーケティング戦略", icon: "chart" },
        { name: "デザイン", description: "デザインレビュー", icon: "design" },
        { name: "プロジェクトA", description: "プロジェクトA関連", icon: "folder" }
      ];

      const createdChannels = [];
      for (const channelData of defaultChannels) {
        const channel = await AppSyncService.createChannel({
          name: channelData.name,
          description: channelData.description
        });
        
        await AppSyncService.joinChannel(channel.channelId);
        
        createdChannels.push({
          ...channel,
          icon: channelData.icon
        });
      }

      setChannels(createdChannels);
      if (createdChannels.length > 0) {
        setSelectedSpace(createdChannels[0]);
      }
    } catch (error) {
      console.error('❌ デフォルトチャンネル作成エラー:', error);
      setError(`チャンネル作成に失敗しました: ${error.message}`);
    }
  };

  // メッセージ読み込み
  const loadMessages = useCallback(async () => {
    if (!selectedSpace || !currentUser) return;

    try {
      const messageData = await AppSyncService.getMessages(selectedSpace.channelId);
      const formattedMessages = messageData.map(msg => ({
        id: msg.messageId,
        sender: msg.username,
        content: msg.content,
        time: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: msg.userId === currentUser.userId,
        avatar: msg.username.substring(0, 2).toUpperCase()
      })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('❌ メッセージ読み込みエラー:', error);
      setError(`メッセージ読み込みに失敗しました: ${error.message}`);
    }
  }, [selectedSpace, currentUser]);

  // リアルタイムメッセージ監視
  const setupMessageSubscription = useCallback(() => {
    if (!selectedSpace || !currentUser) return;

    // 既存のサブスクリプションをクリーンアップ
    subscriptions.forEach(unsubscribe => unsubscribe());
    setSubscriptions(new Map());

    const unsubscribe = AppSyncService.subscribeToMessages(
      selectedSpace.channelId,
      (newMessage) => {
        const messageItem = {
          id: newMessage.messageId,
          sender: newMessage.username,
          content: newMessage.content,
          time: new Date(newMessage.createdAt).toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          isOwn: newMessage.userId === currentUser.userId,
          avatar: newMessage.username.substring(0, 2).toUpperCase()
        };
        
        setMessages(prev => {
          // 重複チェック
          const exists = prev.some(msg => msg.id === messageItem.id);
          if (exists) return prev;
          return [...prev, messageItem];
        });
      },
      (error) => {
        console.error('❌ サブスクリプションエラー:', error);
        setError(`リアルタイム通信エラー: ${error.message}`);
      }
    );

    setSubscriptions(new Map().set(selectedSpace.channelId, unsubscribe));
  }, [selectedSpace, currentUser, subscriptions]);

  // メッセージ送信（AppSync対応）
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSpace || !currentUser) return;

    try {
      await AppSyncService.sendMessage({
        channelId: selectedSpace.channelId,
        content: newMessage.trim()
      });
      setNewMessage("");
      setError(null); // エラークリア
    } catch (error) {
      console.error('❌ メッセージ送信エラー:', error);
      setError(`メッセージ送信に失敗しました: ${error.message}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // エフェクト
  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    setupMessageSubscription();
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [setupMessageSubscription]);

  // 静的データ
  const recentChats = [
    { name: "田中太郎", lastMessage: "資料の件、確認しました", time: "11:54", avatar: "TT" },
    { name: "佐藤花子", lastMessage: "会議の時間を変更できますか？", time: "11:30", avatar: "SH" },
    { name: "鈴木一郎", lastMessage: "今日はお疲れ様でした", time: "昨日", avatar: "SI" },
    { name: "山田美咲", lastMessage: "新しいデザインはいかがですか？", time: "昨日", avatar: "YM" }
  ];

  // ローディング状態
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div>AppSyncに接続中...</div>
      </div>
    );
  }

  return (
    <div className="chat-app">
      {/* エラー表示 */}
      {error && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: '#f8d7da',
          color: '#721c24',
          padding: '10px',
          borderRadius: '4px',
          zIndex: 1000,
          maxWidth: '300px'
        }}>
          {error}
          <button 
            onClick={() => setError(null)}
            style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#721c24' }}
          >
            ×
          </button>
        </div>
      )}

      {/* サイドバー */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="app-title">
            <span className="chat-icon">Chat</span>
          </div>
          <div className="header-actions">
            <button className="icon-btn search-btn" title="検索"></button>
            <button className="icon-btn signout-btn" onClick={onSignOut} title="サインアウト"></button>
          </div>
        </div>

        <div className="new-chat-section">
          <button className="new-chat-btn" onClick={createDefaultChannels}>
            <span className="plus-icon">+</span>
            新しいチャット
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-group">
            <div className="nav-group-header">チャンネル ({channels.length})</div>
            {channels.map((space) => (
              <div 
                key={space.channelId}
                className={`nav-item ${selectedSpace?.channelId === space.channelId ? 'active' : ''}`}
                onClick={() => setSelectedSpace(space)}
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
        {selectedSpace ? (
          <>
            <div className="chat-header">
              <div className="chat-info">
                <h2 className="chat-title">{selectedSpace.name}</h2>
                <div className="chat-subtitle">
                  {selectedSpace.description} • {messages.length}件のメッセージ
                </div>
              </div>
              <div className="chat-actions">
                <button className="action-btn">未読</button>
                <button className="action-btn">スレッド</button>
                <button className="icon-btn pin-btn" title="ピン留め"></button>
              </div>
            </div>

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
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                    まだメッセージがありません。最初のメッセージを送信してみましょう！
                  </div>
                )}
              </div>
            </div>

            <div className="message-input-area">
              <div className="input-container">
                <button className="attach-btn" title="ファイル添付"></button>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`${selectedSpace.name}にメッセージを送信`}
                  className="message-input"
                  rows="1"
                  disabled={!currentUser}
                />
                <div className="input-actions">
                  <button className="icon-btn emoji-btn" title="絵文字"></button>
                  <button 
                    onClick={sendMessage} 
                    className={`send-btn ${newMessage.trim() ? 'active' : ''}`}
                    disabled={!newMessage.trim() || !currentUser}
                    title="送信"
                  >
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="welcome-screen">
            <div className="welcome-content">
              <h2>チャットアプリへようこそ！</h2>
              <p>左側からチャンネルを選択するか、新しいチャットを作成してください</p>
              <div className="welcome-icon">💬</div>
              {currentUser && (
                <div style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
                  ログイン中: {currentUser.username}
                </div>
              )}
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