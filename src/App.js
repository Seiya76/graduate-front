// src/App.js - モダンなReact Web + Amplify v6実装
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { generateClient } from 'aws-amplify/api';
import './App.css';

// GraphQL operations
import { 
  createUser, 
  createChannel, 
  createMessage, 
  joinChannel 
} from './graphql/mutations';
import { 
  getUser, 
  getUserChannels, 
  listMessages,
  getChannel 
} from './graphql/queries';
import { 
  onCreateMessage 
} from './graphql/subscriptions';

// AppSync client setup
const client = generateClient({
  authMode: 'userPool'
});

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState(new Map());

  // ユーザー初期化
  const initializeUser = useCallback(async () => {
    try {
      setLoading(true);
      const userId = user.profile.sub;
      
      console.log('🔄 ユーザー初期化開始:', userId);

      // 既存ユーザーの確認
      const userData = await client.graphql({
        query: getUser,
        variables: { userId }
      });
      
      if (userData.data.getUser) {
        setCurrentUser(userData.data.getUser);
        console.log('👋 既存ユーザー:', userData.data.getUser);
      } else {
        // 新規ユーザーの作成
        const newUser = await client.graphql({
          query: createUser,
          variables: {
            input: {
              username: user.profile.name || user.profile.email.split('@')[0],
              displayName: user.profile.name || user.profile.email.split('@')[0]
            }
          }
        });
        setCurrentUser(newUser.data.createUser);
        console.log('✨ 新規ユーザー作成:', newUser.data.createUser);
      }
      
      // ユーザーのチャンネル一覧を取得
      await loadUserChannels(userId);
      
    } catch (error) {
      console.error('❌ ユーザー初期化エラー:', error);
      // エラーでも継続
      setCurrentUser({
        userId: user.profile.sub,
        username: user.profile.name || user.profile.email.split('@')[0],
        email: user.profile.email
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ユーザーチャンネル読み込み
  const loadUserChannels = async (userId = user.profile.sub) => {
    try {
      const userChannelsData = await client.graphql({
        query: getUserChannels,
        variables: { userId }
      });
      
      if (!userChannelsData.data.getUserChannels || userChannelsData.data.getUserChannels.length === 0) {
        await createDefaultChannels();
      } else {
        // 既存チャンネルを設定
        const channelList = userChannelsData.data.getUserChannels.map(uc => ({
          channelId: uc.channelId,
          name: `Channel ${uc.channelId.slice(-6)}`,
          description: "既存チャンネル",
          icon: "home"
        }));
        setChannels(channelList);
        if (channelList.length > 0) {
          setSelectedSpace(channelList[0]);
        }
      }
    } catch (error) {
      console.error('❌ チャンネル読み込みエラー:', error);
      await createDefaultChannels();
    }
  };

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
      for (const channel of defaultChannels) {
        const newChannel = await client.graphql({
          query: createChannel,
          variables: {
            input: {
              name: channel.name,
              description: channel.description
            }
          }
        });
        
        // チャンネルに参加
        await client.graphql({
          query: joinChannel,
          variables: {
            channelId: newChannel.data.createChannel.channelId
          }
        });
        
        createdChannels.push({
          ...newChannel.data.createChannel,
          icon: channel.icon
        });
      }
      
      setChannels(createdChannels);
      if (createdChannels.length > 0) {
        setSelectedSpace(createdChannels[0]);
      }
    } catch (error) {
      console.error('❌ デフォルトチャンネル作成エラー:', error);
    }
  };

  // メッセージ読み込み
  const loadMessages = useCallback(async () => {
    if (!selectedSpace) return;
    
    try {
      const messagesData = await client.graphql({
        query: listMessages,
        variables: { 
          channelId: selectedSpace.channelId,
          limit: 50
        }
      });
      
      const messageList = messagesData.data.listMessages.items.map(msg => ({
        id: msg.messageId,
        sender: msg.username,
        content: msg.content,
        time: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: msg.userId === currentUser?.userId,
        avatar: msg.username.substring(0, 2).toUpperCase()
      })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      setMessages(messageList);
    } catch (error) {
      console.error('❌ メッセージ読み込みエラー:', error);
      setMessages([]);
    }
  }, [selectedSpace, currentUser]);

  // サブスクリプション管理
  const manageSubscription = useCallback(() => {
    if (!selectedSpace || !currentUser) return;

    // 既存のサブスクリプションをクリーンアップ
    subscriptions.forEach(unsubscribe => unsubscribe());
    setSubscriptions(new Map());

    try {
      const subscription = client.graphql({
        query: onCreateMessage,
        variables: { channelId: selectedSpace.channelId }
      }).subscribe({
        next: ({ data }) => {
          if (data.onCreateMessage) {
            const newMsg = data.onCreateMessage;
            const messageItem = {
              id: newMsg.messageId,
              sender: newMsg.username,
              content: newMsg.content,
              time: new Date(newMsg.createdAt).toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }),
              isOwn: newMsg.userId === currentUser.userId,
              avatar: newMsg.username.substring(0, 2).toUpperCase()
            };
            
            setMessages(prev => {
              // 重複チェック
              const exists = prev.some(msg => msg.id === messageItem.id);
              if (exists) return prev;
              return [...prev, messageItem];
            });
          }
        },
        error: error => console.error('❌ サブスクリプションエラー:', error)
      });

      setSubscriptions(new Map().set(selectedSpace.channelId, () => subscription.unsubscribe()));
    } catch (error) {
      console.error('❌ サブスクリプション設定エラー:', error);
    }
  }, [selectedSpace, currentUser, subscriptions]);

  // メッセージ送信
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSpace || !currentUser) return;

    try {
      await client.graphql({
        query: createMessage,
        variables: {
          input: {
            channelId: selectedSpace.channelId,
            content: newMessage.trim()
          }
        }
      });
      setNewMessage("");
    } catch (error) {
      console.error('❌ メッセージ送信エラー:', error);
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
    manageSubscription();
    // クリーンアップ
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [manageSubscription]);

  const recentChats = [
    { name: "田中太郎", lastMessage: "資料の件、確認しました", time: "11:54", avatar: "TT" },
    { name: "佐藤花子", lastMessage: "会議の時間を変更できますか？", time: "11:30", avatar: "SH" },
    { name: "鈴木一郎", lastMessage: "今日はお疲れ様でした", time: "昨日", avatar: "SI" },
    { name: "山田美咲", lastMessage: "新しいデザインはいかがですか？", time: "昨日", avatar: "YM" }
  ];

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div>初期化中...</div>
      </div>
    );
  }

  return (
    <div className="chat-app">
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
            <div className="nav-group-header">チャンネル</div>
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
                <div className="chat-subtitle">{selectedSpace.description}</div>
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
          </>
        ) : (
          <div className="welcome-screen">
            <div className="welcome-content">
              <h2>チャットアプリへようこそ！</h2>
              <p>左側からチャンネルを選択してください</p>
              <div className="welcome-icon">💬</div>
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
    const cognitoDomain = "https://ap-northeast-1u9yhtfywo.auth.ap-northeast-1.amazoncognito.com";
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