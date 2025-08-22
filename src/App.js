import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import config from './aws-exports.js';

Amplify.configure(config);

// AppSync GraphQL クエリとミューテーション
const listMessages = /* GraphQL */ `
  query ListMessages($chatRoomId: String!, $limit: Int, $nextToken: String) {
    listMessages(chatRoomId: $chatRoomId, limit: $limit, nextToken: $nextToken) {
      items {
        id
        chatRoomId
        userId
        content
        userNickname
        replyToMessageId
        createdAt
      }
      nextToken
    }
  }
`;

const sendMessage = /* GraphQL */ `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      chatRoomId
      userId
      content
      userNickname
      replyToMessageId
      createdAt
    }
  }
`;

const onMessageAdded = /* GraphQL */ `
  subscription OnMessageAdded($chatRoomId: String!) {
    onMessageAdded(chatRoomId: $chatRoomId) {
      id
      chatRoomId
      userId
      content
      userNickname
      replyToMessageId
      createdAt
    }
  }
`;

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("開発チーム");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentChatRoomId] = useState("default-room-001"); // 実際のチャットルームID

  const client = generateClient();

  // チャットルーム一覧（実際のアプリでは ChatRoom API から取得）
  const spaces = [
    { name: "ホーム", icon: "home", type: "home", chatRoomId: "home-room" },
    { name: "開発チーム", icon: "team", type: "space", chatRoomId: "dev-team-room" },
    { name: "マーケティング", icon: "chart", type: "space", chatRoomId: "marketing-room" },
    { name: "デザイン", icon: "design", type: "space", chatRoomId: "design-room" },
    { name: "プロジェクトA", icon: "folder", type: "space", chatRoomId: "project-a-room" }
  ];

  const recentChats = [
    { name: "田中太郎", lastMessage: "資料の件、確認しました", time: "11:54", avatar: "TT" },
    { name: "佐藤花子", lastMessage: "会議の時間を変更できますか？", time: "11:30", avatar: "SH" },
    { name: "鈴木一郎", lastMessage: "今日はお疲れ様でした", time: "昨日", avatar: "SI" },
    { name: "山田美咲", lastMessage: "新しいデザインはいかがですか？", time: "昨日", avatar: "YM" }
  ];

  // メッセージ一覧を取得
  const fetchMessages = async (chatRoomId) => {
    try {
      setLoading(true);
      const result = await client.graphql({
        query: listMessages,
        variables: {
          chatRoomId: chatRoomId,
          limit: 50
        }
      });
      
      const fetchedMessages = result.data.listMessages.items.map(msg => ({
        id: msg.id,
        sender: msg.userNickname,
        content: msg.content,
        time: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: msg.userId === user.profile.sub,
        avatar: msg.userNickname.substring(0, 2).toUpperCase(),
        userId: msg.userId,
        chatRoomId: msg.chatRoomId,
        createdAt: msg.createdAt
      }));

      // 時間順にソート（古い順）
      fetchedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(fetchedMessages);
    } catch (error) {
      console.error('メッセージ取得エラー:', error);
      // エラー時はデフォルトメッセージを表示
      setMessages([
        {
          id: 'system-1',
          sender: "システム",
          content: "メッセージの読み込みに失敗しました。AppSync APIを確認してください。",
          time: new Date().toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          isOwn: false,
          avatar: "SY"
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // メッセージ送信
  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      try {
        setLoading(true);
        
        const currentChatRoomId = spaces.find(space => space.name === selectedSpace)?.chatRoomId || "default-room";
        const userNickname = user.profile.name || user.profile.email.split('@')[0];
        
        await client.graphql({
          query: sendMessage,
          variables: {
            input: {
              chatRoomId: currentChatRoomId,
              userId: user.profile.sub,
              content: newMessage,
              userNickname: userNickname
            }
          }
        });

        setNewMessage("");
        // メッセージ送信後、一覧を再取得
        await fetchMessages(currentChatRoomId);
      } catch (error) {
        console.error('メッセージ送信エラー:', error);
        alert('メッセージの送信に失敗しました: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // リアルタイム更新のセットアップ
  useEffect(() => {
    const currentChatRoomId = spaces.find(space => space.name === selectedSpace)?.chatRoomId || "default-room";
    
    // メッセージ一覧を取得
    fetchMessages(currentChatRoomId);

    // リアルタイム購読のセットアップ
    let subscription;
    try {
      subscription = client.graphql({
        query: onMessageAdded,
        variables: { chatRoomId: currentChatRoomId }
      }).subscribe({
        next: ({ data }) => {
          const newMsg = data.onMessageAdded;
          const formattedMessage = {
            id: newMsg.id,
            sender: newMsg.userNickname,
            content: newMsg.content,
            time: new Date(newMsg.createdAt).toLocaleTimeString('ja-JP', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            isOwn: newMsg.userId === user.profile.sub,
            avatar: newMsg.userNickname.substring(0, 2).toUpperCase(),
            userId: newMsg.userId,
            chatRoomId: newMsg.chatRoomId,
            createdAt: newMsg.createdAt
          };
          
          // 自分が送信したメッセージでない場合のみ追加
          if (newMsg.userId !== user.profile.sub) {
            setMessages(prev => [...prev, formattedMessage]);
          }
        },
        error: (error) => {
          console.error('Subscription エラー:', error);
        }
      });
    } catch (error) {
      console.error('Subscription セットアップエラー:', error);
    }

    // クリーンアップ
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [selectedSpace, user.profile.sub]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSpaceChange = (spaceName) => {
    setSelectedSpace(spaceName);
    // スペース変更時にメッセージをクリア（新しいメッセージは useEffect で取得される）
    setMessages([]);
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
                onClick={() => handleSpaceChange(space.name)}
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
            <div className="chat-subtitle">
              {loading ? "読み込み中..." : `${messages.length}件のメッセージ`}
            </div>
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
            {loading && messages.length === 0 ? (
              <div className="loading-message">メッセージを読み込み中...</div>
            ) : messages.length === 0 ? (
              <div className="empty-message">
                まだメッセージがありません。最初のメッセージを送信してみましょう！
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
              disabled={loading}
            />
            <div className="input-actions">
              <button className="icon-btn emoji-btn" title="絵文字"></button>
              <button 
                onClick={handleSendMessage} 
                className={`send-btn ${newMessage.trim() && !loading ? 'active' : ''}`}
                disabled={!newMessage.trim() || loading}
                title="送信"
              >
                {loading ? "..." : ""}
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