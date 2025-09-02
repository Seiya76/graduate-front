import React, { useState } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { Amplify } from 'aws-amplify';
import config from './aws-exports.js';

// カスタムフック
import { useUser } from './hooks/useUser';
import { useRooms } from './hooks/useRooms';
import { useSearch } from './hooks/useSearch';
import { useModal } from './hooks/useModal';
import { useMessages } from './hooks/useMessages';

// ユーティリティ関数
import { getDisplayName, getDisplayAvatar, formatTime } from './utils/userUtils';

// コンポーネント
import { ErrorMessage, LoadingSpinner, MessagesList } from './components';

Amplify.configure(config);

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  
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
  
  // 選択されたルームのIDを取得
  const selectedRoomId = React.useMemo(() => {
    if (selectedSpace === "ホーム") return null;
    
    const groupRoom = groupRooms.find(room => room.roomName === selectedSpace);
    if (groupRoom) return groupRoom.roomId;
    
    const directRoom = directRooms.find(room => room.roomName === selectedSpace);
    if (directRoom) return directRoom.roomId;
    
    return null;
  }, [selectedSpace, groupRooms, directRooms]);
  
  const {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    handleKeyPress,
    isLoading: isMessagesLoading,
    isSending,
    error: messagesError,
    hasMore,
    loadMoreMessages,
    messagesEndRef,
    scrollToBottom
  } = useMessages(selectedRoomId, currentUser);

  // ルーム作成ハンドラー
  const handleCreateGroupRoom = async () => {
    if (!newRoomName.trim() || !currentUser?.userId) return;

    setIsRoomCreationLoading(true);

    try {
      const createdRoom = await createGroupRoom_func(newRoomName, selectedUsers);
      
      if (createdRoom) {
        resetModal();
        const totalMembers = createdRoom.memberCount;
        alert(`ルーム「${newRoomName}」を作成しました。（${totalMembers}人のメンバー）`);
        setSelectedSpace(createdRoom.roomName);
      }
    } catch (error) {
      let errorMessage = 'ルーム作成でエラーが発生しました。';
      if (error.errors && error.errors.length > 0) {
        errorMessage += '\n' + error.errors.map(e => e.message).join('\n');
      } else if (error.message) {
        errorMessage += '\n' + error.message;
      }
      alert(errorMessage);
    } finally {
      setIsRoomCreationLoading(false);
    }
  };

  // ダイレクトルーム作成ハンドラー
  const handleCreateDirectRoom = async (targetUserId) => {
    try {
      const createdRoom = await createDirectRoom_func(targetUserId);
      if (createdRoom) {
        setSelectedSpace(createdRoom.roomName);
        setDmSearchTerm("");
      }
    } catch (error) {
      alert('ダイレクトルーム作成でエラーが発生しました: ' + error.message);
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

        {/* 新しいチャット */}
        <div className="new-chat-section">
          <button className="new-chat-btn" onClick={() => setIsCreatingRoom(true)}>
            <span className="plus-icon">+</span>
            新しいチャット
          </button>
        </div>

        {/* ルーム作成モーダル */}
        {isCreatingRoom && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>新しいグループルームを作成</h3>
                <button onClick={resetModal} disabled={isRoomCreationLoading}>×</button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  placeholder="ルーム名"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="room-name-input"
                  disabled={isRoomCreationLoading}
                />
                
                {/* ユーザー検索セクション */}
                <div className="user-search-section">
                  <h4>メンバーを検索して追加:</h4>
                  <div className="search-container">
                    <input
                      type="text"
                      placeholder="名前またはメールアドレスで検索"
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="user-search-input"
                      disabled={isRoomCreationLoading}
                    />
                    {isModalSearching && <div className="search-loading">検索中...</div>}
                  </div>
                  
                  {/* 検索結果表示 */}
                  {modalSearchResults.length > 0 && (
                    <div className="search-results">
                      <div className="search-results-header">
                        {modalSearchResults.length}件のユーザーが見つかりました
                      </div>
                      {modalSearchResults.map(searchUser => (
                        <div key={searchUser.userId} className="search-result-item">
                          <div className="user-info">
                            <div className="user-avatar-small">
                              {(searchUser.nickname || searchUser.email).substring(0, 2).toUpperCase()}
                            </div>
                            <div className="user-details">
                              <div className="user-name">{searchUser.nickname || searchUser.email}</div>
                              <div className="user-email">{searchUser.email}</div>
                              {searchUser.status && (
                                <div className="user-status">{searchUser.status}</div>
                              )}
                            </div>
                          </div>
                          <button
                            className={`add-user-btn ${selectedUsers.includes(searchUser.userId) ? 'selected' : ''}`}
                            onClick={() => toggleUserSelection(searchUser.userId)}
                            disabled={isRoomCreationLoading}
                          >
                            {selectedUsers.includes(searchUser.userId) ? '✓ 選択済み' : '+ 追加'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* 検索結果なしの場合 */}
                  {modalSearchTerm && modalSearchResults.length === 0 && !isModalSearching && (
                    <div className="no-results">
                      「{modalSearchTerm}」に該当するユーザーが見つかりませんでした
                    </div>
                  )}
                </div>

                {/* 選択されたメンバーのプレビュー */}
                {selectedUsers.length > 0 && (
                  <div className="selected-users-section">
                    <h4>選択されたメンバー ({selectedUsers.length}人):</h4>
                    <div className="selected-users-preview">
                      <div className="member-count-preview">
                        総メンバー数: {selectedUsers.length + 1}人 (あなた + {selectedUsers.length}人)
                      </div>
                      <div className="selected-users-list">
                        {selectedUsers.map(userId => {
                          const user = modalSearchResults.find(u => u.userId === userId);
                          return user ? (
                            <div key={userId} className="selected-user-item">
                              <div className="user-avatar-small">
                                {(user.nickname || user.email).substring(0, 2).toUpperCase()}
                              </div>
                              <span className="selected-user-name">
                                {user.nickname || user.email}
                              </span>
                              <button
                                className="remove-user-btn"
                                onClick={() => toggleUserSelection(userId)}
                                disabled={isRoomCreationLoading}
                                title="削除"
                              >×</button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={resetModal}
                  disabled={isRoomCreationLoading}
                  className="cancel-btn"
                >
                  キャンセル
                </button>
                <button 
                  onClick={handleCreateGroupRoom} 
                  disabled={!newRoomName.trim() || isRoomCreationLoading}
                  className="create-room-btn"
                >
                  {isRoomCreationLoading ? (
                    <>
                      <span className="loading-spinner-small"></span>
                      作成中...
                    </>
                  ) : (
                    <>
                      ルーム作成 
                      {selectedUsers.length > 0 && (
                        <span className="member-count-badge">
                          {selectedUsers.length + 1}人
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ナビゲーション */}
        <div className="nav-section">
          {/* ホーム */}
          <div className="nav-group">
            <div className="nav-group-header">ショートカット</div>
            <div 
              className={`nav-item ${selectedSpace === "ホーム" ? 'active' : ''}`}
              onClick={() => setSelectedSpace("ホーム")}
            >
              <span className="nav-icon icon-home"></span>
              <span className="nav-text">ホーム</span>
            </div>
            
            {/* グループルーム */}
            {groupRooms.map((room) => (
              <div 
                key={room.roomId}
                className={`nav-item ${selectedSpace === room.roomName ? 'active' : ''}`}
                onClick={() => setSelectedSpace(room.roomName)}
              >
                <span className="nav-icon icon-team"></span>
                <span className="nav-text">{room.roomName}</span>
                <span className="member-count">({room.memberCount})</span>
              </div>
            ))}
          </div>

          {/* ダイレクトメッセージ */}
          <div className="nav-group">
            <div className="nav-group-header">ダイレクト メッセージ</div>
            
            {/* 既存のダイレクトルーム */}
            {directRooms.map((room) => (
              <div 
                key={room.roomId} 
                className={`nav-item dm-item ${selectedSpace === room.roomName ? 'active' : ''}`}
                onClick={() => setSelectedSpace(room.roomName)}
              >
                <span className="nav-icon user-avatar">
                  {room.roomName.substring(0, 2).toUpperCase()}
                </span>
                <div className="dm-info">
                  <span className="nav-text">{room.roomName}</span>
                  <div className="dm-preview">
                    <span className="last-message">{room.lastMessage || "未入力"}</span>
                    <span className="last-time">{formatTime(room.lastMessageAt)}</span>
                  </div>
                </div>
                <div className="status-indicator online"></div>
              </div>
            ))}

            {/* ダイレクトメッセージ作成用検索 */}
            <div className="dm-search-section">
              <input
                type="text"
                placeholder="ユーザーを検索してDM開始"
                value={dmSearchTerm}
                onChange={(e) => setDmSearchTerm(e.target.value)}
                className="dm-search-input"
              />
              
              {/* DM用検索結果 */}
              {dmSearchResults.length > 0 && dmSearchTerm && (
                <div className="dm-search-results">
                  {dmSearchResults.filter(searchUser => 
                    !directRooms.some(room => room.roomName.includes(searchUser.nickname || searchUser.email))
                  ).map((searchUser) => (
                    <div 
                      key={searchUser.userId} 
                      className="dm-search-result-item"
                      onClick={() => handleCreateDirectRoom(searchUser.userId)}
                    >
                      <span className="nav-icon user-avatar">
                        {(searchUser.nickname || searchUser.email).substring(0, 2).toUpperCase()}
                      </span>
                      <div className="dm-user-info">
                        <span className="dm-user-name">{searchUser.nickname || searchUser.email}</span>
                        <span className="dm-user-email">{searchUser.email}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              {selectedSpace === "ホーム" ? "チャットルームを選択してください" : 
              `${groupRooms.find(r => r.roomName === selectedSpace)?.memberCount || directRooms.find(r => r.roomName === selectedSpace)?.memberCount || 0}人のメンバー`}
            </div>
          </div>
          <div className="chat-actions">
            <button className="action-btn">未読</button>
            <button className="action-btn">スレッド</button>
            <button className="icon-btn pin-btn" title="ピン留め"></button>
            
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
        <ErrorMessage 
          error={messagesError} 
          onDismiss={() => {/* setError(null) */}} 
        />

        {/* メッセージ一覧 */}
        <div className="messages-container">
          <div className="messages-list">
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
                  <div className="stat-item">
                    <strong>{modalSearchResults.length}</strong>
                    <span>検索結果のユーザー</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 初回読み込み表示 */}
                {isMessagesLoading && messages.length === 0 && (
                  <LoadingSpinner text="メッセージを読み込み中..." />
                )}
                
                {/* 古いメッセージ読み込み */}
                {hasMore && messages.length > 0 && (
                  <div className="load-more-container">
                    <button 
                      className="load-more-btn" 
                      onClick={loadMoreMessages}
                      disabled={isMessagesLoading}
                    >
                      {isMessagesLoading ? '読み込み中...' : '過去のメッセージを読み込む'}
                    </button>
                  </div>
                )}
                
                {/* メッセージリスト */}
                {messages.map((message, index) => {
                  const showAvatar = index === 0 || messages[index - 1].userId !== message.userId;
                  const isLastFromUser = index === messages.length - 1 || messages[index + 1]?.userId !== message.userId;
                  
                  return (
                    <div 
                      key={message.messageId || message.id} 
                      className={`message-item ${message.isOwn ? 'own-message' : ''} ${isLastFromUser ? 'last-from-user' : ''}`}
                    >
                      {!message.isOwn && showAvatar && (
                        <div className="message-avatar user-avatar">{message.avatar}</div>
                      )}
                      <div className={`message-content ${!message.isOwn && !showAvatar ? 'no-avatar' : ''}`}>
                        {showAvatar && (
                          <div className="message-header">
                            <span className="sender-name">{message.sender}</span>
                            <span className="message-time">{message.time}</span>
                          </div>
                        )}
                        <div className="message-text">{message.content}</div>
                        {!showAvatar && (
                          <div className="message-time-inline">{message.time}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* メッセージリストの最下部参照用 */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* メッセージ入力 */}
        {selectedSpace !== "ホーム" && selectedRoomId && (
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
                disabled={isSending}
              />
              <div className="input-actions">
                <button className="icon-btn emoji-btn" title="絵文字"></button>
                <button 
                  onClick={sendMessage} 
                  className={`send-btn ${newMessage.trim() && !isSending ? 'active' : ''}`}
                  disabled={!newMessage.trim() || isSending}
                  title={isSending ? "送信中..." : "送信"}
                >
                  {isSending ? (
                    <span className="loading-spinner-small"></span>
                  ) : (
                    "📤"
                  )}
                </button>
              </div>
            </div>
            
            {/* 送信状態表示 */}
            {isSending && (
              <div className="sending-indicator">
                メッセージを送信中...
              </div>
            )}
          </div>
        )}
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
    return <LoadingSpinner text="認証中..." />;
  }

  if (auth.error) {
    return (
      <div className="error-screen">
        <div className="error-message">
          認証エラーが発生しました: {auth.error.message}
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