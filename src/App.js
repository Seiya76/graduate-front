import React, { useState } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "システム",
      content: "チャットへようこそ！",
      time: "10:00",
      isOwn: false
    }
  ]);
  const [newMessage, setNewMessage] = useState("");

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: messages.length + 1,
        sender: user.profile.email.split('@')[0],
        content: newMessage,
        time: new Date().toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: true
      };
      setMessages([...messages, message]);
      setNewMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      {/* ヘッダー */}
      <div className="chat-header">
        <div className="chat-title">
          <h2>一般</h2>
          <span className="member-count">3人のメンバー</span>
        </div>
        <button onClick={onSignOut} className="sign-out-btn">
          サインアウト
        </button>
      </div>

      {/* メッセージ一覧 */}
      <div className="messages-container">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.isOwn ? 'own-message' : ''}`}
          >
            <div className="message-header">
              <span className="sender">{message.sender}</span>
              <span className="time">{message.time}</span>
            </div>
            <div className="message-content">{message.content}</div>
          </div>
        ))}
      </div>

      {/* メッセージ入力 */}
      <div className="message-input-container">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="メッセージを入力..."
          className="message-input"
        />
        <button onClick={sendMessage} className="send-btn">
          送信
        </button>
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
    return <div className="loading">Loading...</div>;
  }

  if (auth.error) {
    return <div className="error">エラーが発生しました: {auth.error.message}</div>;
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
        <h1>チャットアプリ</h1>
        <p>
          サインインしてチャットを始めましょう
        </p>
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