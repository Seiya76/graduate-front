import React, { useState } from "react";
import { useAuth } from "react-oidc-context";
import { Amplify } from 'aws-amplify';
import config from './aws-exports.js';

// カスタムフック
import { useUser } from './hooks/useUser';
import { useRooms } from './hooks/useRooms';
import { useSearch } from './hooks/useSearch';
import { useModal } from './hooks/useModal';
import { useMessages } from './hooks/useMessages'; // 新しいフック

// コンポーネント
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';

// ユーティリティ関数
import { getDisplayName, getDisplayAvatar, formatTime } from './utils/userUtils';

Amplify.configure(config);

function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  // カスタムフック使用
  const currentUser = useUser(user);
  const {
    userRooms,
    groupRooms,
    directRooms,
    createGroupRoom_func,
    createDirectRoom_func
  } = useRooms(currentUser);
  
  const {
    modalSearchTerm,
    setModalSearchTerm,
    modalSearchResults,
    isModalSearching,
    dmSearchTerm,
    setDmSearchTerm,
    dmSearchResults,
    isDmSearching
  } = useSearch(currentUser);
  
  const {
    isCreatingRoom,
    setIsCreatingRoom,
    isRoomCreationLoading,
    setIsRoomCreationLoading,
    newRoomName,
    setNewRoomName,
    selectedUsers,
    toggleUserSelection,
    resetModal
  } = useModal();
  
  // 新しいメッセージフック
  const {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    deleteMessage,
    handleKeyPress,
    loading: messagesLoading,
    sending,
    error: messageError,
    hasMore,
    loadMoreMessages,
    clearError
  } = useMessages(selectedRoom, currentUser);

  // ルーム選択ハンドラー
  const handleSpaceSelection = (spaceName) => {
    setSelectedSpace(spaceName);
    
    if (spaceName === "ホーム") {
      setSelectedRoom(null);
    } else {
      // グループルームまたはダイレクトルームを見つける
      const room = [...groupRooms, ...directRooms].find(r => r.roomName === spaceName);
      setSelectedRoom(room);
      console.log('Selected room:', room);
    }
  };

  // エラー処理
  const handleClearError = () => {
    clearError();
  };

  return (
    <div className="chat-app">
      {/* 既存のサイドバー部分は省略... */}
      
      {/* メインコンテンツ */}
      <div className="main-content">
        {/* チャットヘッダー */}
        <div className="chat-header">
          <div className="chat-info">
            <h2 className="chat-title">{selectedSpace}</h2>
            <div className="chat-subtitle">
              {selectedSpace === "ホーム" ? "チャットルームを選択してください" : 
              `${selectedRoom?.memberCount || 0}人のメンバー`}
            </div>
          </div>
          <div className="chat-actions">
            <button className="action-btn">未読</button>
            <button className="action-btn">スレッド</button>
            <button className="icon-btn pin-btn" title="ピン留め">📌</button>
            
            {/* ユーザー情報表示 */}
            <div className="user-profile-display">
              <div className="user-avatar-display">{getDisplayAvatar(currentUser, user)}</div>
              <div className="user-info-display">
                <div className="user-name-display">{getDisplayName(currentUser, user)}</div>
                <div className="user-status-display">{currentUser?.status || 'active'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {messageError && (
          <div className="error-message">
            <span>{messageError}</span>
            <button onClick={handleClearError} className="error-close">×</button>
          </div>
        )}

        {/* メッセージ表示エリア */}
        {selectedSpace === "ホーム" ? (
          <div className="welcome-message">
            <h3>チャットへようこそ！</h3>
            <p>左側のルーム一覧からチャットルームを選択するか、新しいチャットを作成してください。</p>
            <div className="stats">
              <div className="stat-item">
                <strong>{groupRooms.length}</strong>
                <span>グループルーム</span>
              </div>
              <div className="stat-item">
                <strong>{directRooms.length}</strong>
                <span>ダイレクトメッセージ</span>
              </div>
            </div>
          </div>
        ) : (
          <MessageList 
            messages={messages}
            currentUser={currentUser}
            onDeleteMessage={deleteMessage}
            onLoadMore={loadMoreMessages}
            hasMore={hasMore}
            loading={messagesLoading}
          />
        )}

        {/* メッセージ入力 */}
        <MessageInput
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          onSendMessage={sendMessage}
          onKeyPress={handleKeyPress}
          sending={sending}
          selectedRoom={selectedRoom}
        />
      </div>
    </div>
  );
}

// 残りのApp関数は変更なし...
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

  if (auth.isAuthenticated) {
    return <ChatScreen user={auth.user} onSignOut={signOutRedirect} />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Chat App</h1>
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