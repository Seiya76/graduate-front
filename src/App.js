// src/App.js
import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { API, graphqlOperation } from 'aws-amplify';
import { createUser, createChannel, createMessage, joinChannel } from './graphql/mutations';
import { getUser, getUserChannels, listMessages } from './graphql/queries';
import { onCreateMessage } from './graphql/subscriptions';

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // 初期化
  useEffect(() => {
    initializeUser();
  }, [user]);

  // チャンネル変更時にメッセージを読み込み
  useEffect(() => {
    if (selectedSpace) {
      loadMessages();
      subscribeToMessages();
    }
  }, [selectedSpace]);

  const initializeUser = async () => {
    try {
      // 既存ユーザーの確認
      const userData = await API.graphql(
        graphqlOperation(getUser, { userId: user.attributes.sub })
      );
      
      if (userData.data.getUser) {
        setCurrentUser(userData.data.getUser);
        console.log('既存ユーザー:', userData.data.getUser);
      } else {
        // 新規ユーザーの作成
        const newUser = await API.graphql(
          graphqlOperation(createUser, {
            input: {
              username: user.attributes.email.split('@')[0],
              displayName: user.attributes.email.split('@')[0]
            }
          })
        );
        setCurrentUser(newUser.data.createUser);
        console.log('新規ユーザー作成:', newUser.data.createUser);
      }
      
      // ユーザーのチャンネル一覧を取得
      await loadUserChannels();
      
    } catch (error) {
      console.error('ユーザー初期化エラー:', error);
      // エラーでも継続
      setCurrentUser({
        userId: user.attributes.sub,
        username: user.attributes.email.split('@')[0],
        email: user.attributes.email
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserChannels = async () => {
    try {
      const userChannelsData = await API.graphql(
        graphqlOperation(getUserChannels, { userId: user.attributes.sub })
      );
      
      // デフォルトチャンネルがない場合は作成
      if (!userChannelsData.data.getUserChannels || userChannelsData.data.getUserChannels.length === 0) {
        await createDefaultChannels();
      } else {
        // 既存チャンネルを設定（実際のアプリではチャンネル詳細も取得）
        const channelList = [
          { channelId: "general", name: "ホーム", description: "一般的な会話" },
          { channelId: "dev-team", name: "開発チーム", description: "開発に関する議論" },
          { channelId: "marketing", name: "マーケティング", description: "マーケティング戦略" },
          { channelId: "design", name: "デザイン", description: "デザインレビュー" },
          { channelId: "project-a", name: "プロジェクトA", description: "プロジェクトA関連" }
        ];
        setChannels(channelList);
        setSelectedSpace(channelList[0]);
      }
    } catch (error) {
      console.error('チャンネル読み込みエラー:', error);
      await createDefaultChannels();
    }
  };

  const createDefaultChannels = async () => {
    try {
      // デフォルトチャンネルを作成
      const defaultChannels = [
        { name: "ホーム", description: "一般的な会話" },
        { name: "開発チーム", description: "開発に関する議論" },
        { name: "マーケティング", description: "マーケティング戦略" },
        { name: "デザイン", description: "デザインレビュー" },
        { name: "プロジェクトA", description: "プロジェクトA関連" }
      ];

      const createdChannels = [];
      for (const channel of defaultChannels) {
        const newChannel = await API.graphql(
          graphqlOperation(createChannel, {
            input: {
              name: channel.name,
              description: channel.description
            }
          })
        );
        
        // チャンネルに参加
        await API.graphql(
          graphqlOperation(joinChannel, {
            channelId: newChannel.data.createChannel.channelId
          })
        );
        
        createdChannels.push(newChannel.data.createChannel);
      }
      
      setChannels(createdChannels);
      setSelectedSpace(createdChannels[0]);
    } catch (error) {
      console.error('デフォルトチャンネル作成エラー:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedSpace) return;
    
    try {
      const messagesData = await API.graphql(
        graphqlOperation(listMessages, { 
          channelId: selectedSpace.channelId,
          limit: 50
        })
      );
      
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
      console.error('メッセージ読み込みエラー:', error);
      setMessages([]);
    }
  };

  const subscribeToMessages = () => {
    if (!selectedSpace) return;
    
    const subscription = API.graphql(
      graphqlOperation(onCreateMessage, { channelId: selectedSpace.channelId })
    ).subscribe({
      next: ({ value }) => {
        const newMessage = value.data.onCreateMessage;
        const messageItem = {
          id: newMessage.messageId,
          sender: newMessage.username,
          content: newMessage.content,
          time: new Date(newMessage.createdAt).toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          isOwn: newMessage.userId === currentUser?.userId,
          avatar: newMessage.username.substring(0, 2).toUpperCase()
        };
        setMessages(prev => [...prev, messageItem]);
      },
      error: error => console.error('サブスクリプションエラー:', error)
    });

    return () => subscription.unsubscribe();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSpace || !currentUser) return;

    try {
      await API.graphql(
        graphqlOperation(createMessage, {
          input: {
            channelId: selectedSpace.channelId,
            content: newMessage.trim()
          }
        })
      );
      setNewMessage("");
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const spaces = channels.map(channel => ({
    ...channel,
    icon: getChannelIcon(channel.name),
    type: "space"
  }));

  const getChannelIcon = (name) => {
    if (name.includes('ホーム')) return 'home';
    if (name.includes('開発') || name.includes('チーム')) return 'team';
    if (name.includes('マーケティング')) return 'chart';
    if (name.includes('デザイン')) return 'design';
    if (name.includes('プロジェクト')) return 'folder';
    return 'home';
  };

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
          <button className="new-chat-btn" onClick={createDefaultChannels}>
            <span className="plus-icon">+</span>
            新しいチャット
          </button>
        </div>

        {/* ナビゲーション */}
        <div className="nav-section">
          <div className="nav-group">
            <div className="nav-group-header">チャンネル</div>
            {spaces.map((space) => (
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
            {/* チャットヘッダー */}
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
  return (
    <div className="App">
      <Authenticator>
        {({ signOut, user }) => {
          if (user) {
            return <ChatScreen user={user} onSignOut={signOut} />;
          }
          
          // 未認証の場合のフォールバック（通常はAuthenticatorが処理）
          return (
            <header className="App-header">
              <img src={logo} className="App-logo" alt="logo" />
              <h1>G00gleChat</h1>
              <div>認証中...</div>
            </header>
          );
        }}
      </Authenticator>
    </div>
  );
}

export default App;