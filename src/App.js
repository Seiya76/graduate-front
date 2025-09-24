import React, { useState, useEffect, useRef } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import config from "./aws-exports.js";

// GraphQLクエリをインポート
import {
  createGroupRoom,
  createDirectRoom,
} from "./graphql/mutations";

import {
  getUser,
  searchUsers,
  getUserRooms,
} from "./graphql/queries";

import { onRoomUpdate } from "./graphql/subscriptions";

// hooks & components
import { useMessages } from "./hooks/useMessages";
import MessageInput from "./components/MessageInput";

Amplify.configure(config);
const client = generateClient();

// getUserByEmailクエリ
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
      __typename
    }
  }
`;

function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [currentUser, setCurrentUser] = useState(null);
  const [userRooms, setUserRooms] = useState([]);

  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState([]);
  const [isModalSearching, setIsModalSearching] = useState(false);

  const [dmSearchTerm, setDmSearchTerm] = useState("");
  const [dmSearchResults, setDmSearchResults] = useState([]);
  const [isDmSearching, setIsDmSearching] = useState(false);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isRoomCreationLoading, setIsRoomCreationLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const roomSubscriptionRef = useRef(null);

  const selectedRoomId = React.useMemo(() => {
    if (selectedSpace === "ホーム") return null;
    const room = userRooms.find((room) => room.roomName === selectedSpace);
    return room?.roomId || null;
  }, [selectedSpace, userRooms]);

  // ユーザー情報取得
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const oidcSub = user.profile.sub;
        const email = user.profile.email;

        let result = null;

        try {
          result = await client.graphql({
            query: getUser,
            variables: { userId: oidcSub },
            authMode: "apiKey",
          });
          if (result.data.getUser) {
            setCurrentUser(result.data.getUser);
            return;
          }
        } catch {}

        if (email) {
          try {
            result = await client.graphql({
              query: GET_USER_BY_EMAIL,
              variables: { email },
              authMode: "apiKey",
            });
            if (result.data.getUserByEmail) {
              setCurrentUser(result.data.getUserByEmail);
              return;
            }
          } catch {}
        }

        setCurrentUser({
          userId: oidcSub,
          nickname:
            user.profile.name ||
            user.profile.preferred_username ||
            email?.split("@")[0],
          email,
          status: "active",
        });
      } catch (error) {
        console.error("Error fetching current user:", error);
        setCurrentUser({
          userId: user.profile.sub,
          nickname:
            user.profile.name ||
            user.profile.preferred_username ||
            user.profile.email?.split("@")[0],
          email: user.profile.email,
          status: "active",
        });
      }
    };

    if (user?.profile?.sub) {
      fetchCurrentUser();
    }
  }, [user]);

  // ルーム一覧取得
  useEffect(() => {
    const fetchUserRooms = async () => {
      if (!currentUser?.userId) return;
      try {
        const result = await client.graphql({
          query: getUserRooms,
          variables: { userId: currentUser.userId, limit: 50 },
          authMode: "apiKey",
        });
        if (result.data.getUserRooms?.items) {
          setUserRooms(result.data.getUserRooms.items);
        }
      } catch (error) {
        console.error("Error fetching user rooms:", error);
      }
    };
    if (currentUser?.userId) {
      fetchUserRooms();
    }
  }, [currentUser]);

  // ルーム更新のサブスクリプション
  useEffect(() => {
    if (!currentUser?.userId) return;

    try {
      roomSubscriptionRef.current = client
        .graphql({
          query: onRoomUpdate,
          variables: { userId: currentUser.userId },
          authMode: "apiKey",
        })
        .subscribe({
          next: (eventData) => {
            if (eventData.value?.data?.onRoomUpdate) {
              const updatedRoom = eventData.value.data.onRoomUpdate;
              setUserRooms((prevRooms) => {
                const existingIndex = prevRooms.findIndex(
                  (r) => r.roomId === updatedRoom.roomId
                );
                if (existingIndex >= 0) {
                  const updated = [...prevRooms];
                  updated[existingIndex] = updatedRoom;
                  return updated;
                } else {
                  return [updatedRoom, ...prevRooms];
                }
              });
            }
          },
          error: (error) => console.error("Room subscription error:", error),
        });
    } catch (error) {
      console.error("Failed to setup room subscription:", error);
    }

    return () => {
      if (roomSubscriptionRef.current) {
        roomSubscriptionRef.current.unsubscribe();
      }
    };
  }, [currentUser?.userId]);

  const groupRooms = userRooms.filter((room) => room.roomType === "group");
  const directRooms = userRooms.filter((room) => room.roomType === "direct");

  // ✅ メッセージ関連は useMessages に集約
  const {
    messages,
    sendMessage,
    isSending,
    isLoading,
    error,
    messagesEndRef,
  } = useMessages(currentUser, selectedRoomId);

  const getDisplayName = () => {
    return (
      currentUser?.nickname ||
      user.profile.name ||
      user.profile.email?.split("@")[0] ||
      "ユーザー"
    );
  };

  const getDisplayAvatar = () => {
    const name = getDisplayName();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="chat-app">
      {/* サイドバー */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="app-title"><span className="chat-icon">Chat</span></div>
          <div className="header-actions">
            <button
              className="icon-btn signout-btn"
              onClick={onSignOut}
              title="サインアウト"
            ></button>
          </div>
        </div>
        <div className="new-chat-section">
          <button className="new-chat-btn" onClick={() => setIsCreatingRoom(true)}>
            <span className="plus-icon">+</span>新しいチャット
          </button>
        </div>
        <div className="nav-section">
          <div className="nav-group">
            <div className="nav-group-header">グループメッセージ</div>
            <div
              className={`nav-item ${selectedSpace === "ホーム" ? "active" : ""}`}
              onClick={() => setSelectedSpace("ホーム")}
            >
              <span className="nav-icon icon-home"></span>
              <span className="nav-text">ホーム</span>
            </div>
            {groupRooms.map((room) => (
              <div
                key={room.roomId}
                className={`nav-item ${selectedSpace === room.roomName ? "active" : ""}`}
                onClick={() => setSelectedSpace(room.roomName)}
              >
                <span className="nav-icon icon-team"></span>
                <span className="nav-text">{room.roomName}</span>
                <span className="member-count">({room.memberCount})</span>
              </div>
            ))}
          </div>
          <div className="nav-group">
            <div className="nav-group-header">ダイレクト メッセージ</div>
            {directRooms.map((room) => (
              <div
                key={room.roomId}
                className={`nav-item dm-item ${selectedSpace === room.roomName ? "active" : ""}`}
                onClick={() => setSelectedSpace(room.roomName)}
              >
                <span className="nav-icon user-avatar">
                  {room.roomName.substring(0, 2).toUpperCase()}
                </span>
                <div className="dm-info">
                  <span className="nav-text">{room.roomName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="main-content">
        <div className="chat-header">
          <div className="chat-info">
            <h2 className="chat-title">{selectedSpace}</h2>
            <div className="chat-subtitle">
              {selectedSpace === "ホーム"
                ? "チャットルームを選択してください"
                : `${userRooms.find((r) => r.roomName === selectedSpace)?.memberCount || 0}人のメンバー`}
            </div>
          </div>
          <div className="chat-actions">
            <div className="user-profile-display">
              <div className="user-avatar-display">{getDisplayAvatar()}</div>
              <div className="user-info-display">
                <div className="user-name-display">{getDisplayName()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="messages-container">
          <div className="messages-list">
            {isLoading && <div>読み込み中...</div>}
            {messages.map((message) => (
              <div
                key={message.messageId || message.id}
                className={`message-item ${message.isOwn ? "own-message" : ""}`}
              >
                {!message.isOwn && (
                  <div className="message-avatar user-avatar">{message.avatar}</div>
                )}
                <div className="message-content">
                  <div className="message-text">{message.content}</div>
                  <div className="message-time-inline">{message.time}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {selectedSpace !== "ホーム" && selectedRoomId && (
          <MessageInput onSend={sendMessage} disabled={isSending} />
        )}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}

function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = "5buno8gs9brj93apmu9tvqqp77";
    const logoutUri = "https://main.d3rgq9lalaa9gb.amplifyapp.com";
    const cognitoDomain =
      "https://ap-northeast-1ncffaodbj.auth.ap-northeast-1.amazoncognito.com";
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
        <div className="error-message">エラーが発生しました: {auth.error.message}</div>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return <ChatScreen user={auth.user} onSignOut={signOutRedirect} />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h1>ChatApp</h1>
        <div className="auth-buttons">
          <button onClick={() => auth.signinRedirect()} className="signin-btn">
            サインイン
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;
