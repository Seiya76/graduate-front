// App.js - リファクタリング版
import React, { useState, useEffect, useMemo } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import config from "./aws-exports.js";

// カスタムフック
import { useCurrentUser } from "./hooks/useAuth";
import { useRooms } from "./hooks/useRooms";
import { useMessages } from "./hooks/useMessages";
import { useUserSearch } from "./hooks/useUserSearch";
import { useRoomSubscription } from "./hooks/useRoomSubscription";

// コンポーネント
import Sidebar from "./components/Sidebar";
import ChatHeader from "./components/ChatHeader";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import CreateRoomModal from "./components/CreateRoomModal";

Amplify.configure(config);
const client = generateClient();

// 通知権限のリクエスト
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// ChatScreenコンポーネント
function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isRoomCreationLoading, setIsRoomCreationLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  // 各機能の使用
  const { currentUser, isLoading: isUserLoading } = useCurrentUser(user);
  
  const {
    userRooms,
    groupRooms,
    directRooms,
    setUserRooms,
    createNewGroupRoom,
    createNewDirectRoom,
    isLoadingRooms,
    roomError,
  } = useRooms(currentUser);

  // 選択されたルームのIDを取得
  const selectedRoomId = useMemo(() => {
    if (selectedSpace === "ホーム") return null;
    const room = userRooms.find((room) => room.roomName === selectedSpace);
    return room?.roomId || null;
  }, [selectedSpace, userRooms]);

  const {
    messages,
    messagesEndRef,
    isLoadingMessages,
    isSendingMessage,
    messageError,
    isConnected,
    connectionError,
    sendMessage,
  } = useMessages(selectedRoomId, currentUser);

  // ユーザー検索（モーダル用）
  const {
    searchTerm: modalSearchTerm,
    setSearchTerm: setModalSearchTerm,
    searchResults: modalSearchResults,
    isSearching: isModalSearching,
  } = useUserSearch(currentUser);

  // ユーザー検索（DM用）
  const {
    searchTerm: dmSearchTerm,
    setSearchTerm: setDmSearchTerm,
    searchResults: dmSearchResults,
    isSearching: isDmSearching,
  } = useUserSearch(currentUser);

  // ルーム更新のサブスクリプション
  useRoomSubscription(currentUser, setUserRooms);

  // 通知権限のリクエスト
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // 表示名の取得
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

  // ユーザー選択のトグル
  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // グループルーム作成
  const handleCreateGroupRoom = async (roomName, memberUserIds) => {
    if (!roomName.trim() || !currentUser?.userId) return;

    setIsRoomCreationLoading(true);
    try {
      const createdRoom = await createNewGroupRoom(
        roomName,
        memberUserIds,
        currentUser.userId
      );
      
      alert(
        `ルーム「${roomName}」を作成しました。（${createdRoom.memberCount}人のメンバー）`
      );
      
      setSelectedSpace(createdRoom.roomName);
      resetModal();
    } catch (error) {
      console.error("Error creating room:", error);
      let errorMessage = "ルーム作成でエラーが発生しました。";
      if (error.errors && error.errors.length > 0) {
        errorMessage += "\n" + error.errors.map((e) => e.message).join("\n");
      }
      alert(errorMessage);
    } finally {
      setIsRoomCreationLoading(false);
    }
  };

  // ダイレクトルーム作成
  const handleCreateDirectRoom = async (targetUserId) => {
    if (!currentUser?.userId || !targetUserId) return;

    try {
      const createdRoom = await createNewDirectRoom(
        targetUserId,
        currentUser.userId
      );
      setSelectedSpace(createdRoom.roomName);
    } catch (error) {
      console.error("Error creating direct room:", error);
      alert("ダイレクトルーム作成でエラーが発生しました: " + error.message);
    }
  };

  // モーダルリセット
  const resetModal = () => {
    setIsCreatingRoom(false);
    setIsRoomCreationLoading(false);
    setModalSearchTerm("");
    setSelectedUsers([]);
    setNewRoomName("");
  };

  if (isUserLoading || isLoadingRooms) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div>読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="chat-app">
      {/* サイドバー */}
      <Sidebar
        selectedSpace={selectedSpace}
        setSelectedSpace={setSelectedSpace}
        groupRooms={groupRooms}
        directRooms={directRooms}
        isCreatingRoom={isCreatingRoom}
        setIsCreatingRoom={setIsCreatingRoom}
        dmSearchTerm={dmSearchTerm}
        setDmSearchTerm={setDmSearchTerm}
        dmSearchResults={dmSearchResults}
        createDirectRoom_func={handleCreateDirectRoom}
        setDmSearchResults={() => {}}
        onSignOut={onSignOut}
      />

      {/* ルーム作成モーダル */}
      <CreateRoomModal
        isOpen={isCreatingRoom}
        onClose={resetModal}
        newRoomName={newRoomName}
        setNewRoomName={setNewRoomName}
        modalSearchTerm={modalSearchTerm}
        setModalSearchTerm={setModalSearchTerm}
        modalSearchResults={modalSearchResults}
        isModalSearching={isModalSearching}
        selectedUsers={selectedUsers}
        toggleUserSelection={toggleUserSelection}
        onCreateRoom={handleCreateGroupRoom}
        isRoomCreationLoading={isRoomCreationLoading}
      />

      {/* メインコンテンツ */}
      <div className="main-content">
        {/* チャットヘッダー */}
        <ChatHeader
          selectedSpace={selectedSpace}
          userRooms={userRooms}
          currentUser={currentUser}
          getDisplayName={getDisplayName}
          getDisplayAvatar={getDisplayAvatar}
        />

        {/* エラー表示 */}
        {(messageError || connectionError || roomError) && (
          <div className="error-banner">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span className="error-text">
                {messageError || connectionError || roomError}
              </span>
            </div>
          </div>
        )}

        {/* 接続状態表示 */}
        {!isConnected && selectedSpace !== "ホーム" && (
          <div className="connection-warning">
            リアルタイム通信が切断されています。再接続を試みています...
          </div>
        )}

        {/* メッセージ一覧 */}
        <div className="messages-container">
          <MessageList
            messages={messages}
            messagesEndRef={messagesEndRef}
            isLoadingMessages={isLoadingMessages}
            selectedSpace={selectedSpace}
            groupRooms={groupRooms}
            directRooms={directRooms}
          />
        </div>

        {/* メッセージ入力 */}
        <MessageInput
          selectedSpace={selectedSpace}
          selectedRoomId={selectedRoomId}
          onSendMessage={sendMessage}
          isSendingMessage={isSendingMessage}
        />
      </div>
    </div>
  );
}

// メインのAppコンポーネント
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
        <div className="error-message">
          エラーが発生しました: {auth.error.message}
        </div>
        <button onClick={() => window.location.reload()}>
          再読み込み
        </button>
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