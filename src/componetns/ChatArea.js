import React from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const ChatArea = ({ 
  selectedSpace, 
  selectedRoomId, 
  userRooms, 
  currentUser, 
  user,
  groupRooms,
  directRooms 
}) => {
  // 表示名の取得
  const getDisplayName = () => {
    return (
      currentUser?.nickname ||
      user.profile.name ||
      user.profile.email?.split("@")[0] ||
      "ユーザー"
    );
  };

  // 表示アバターの取得
  const getDisplayAvatar = () => {
    const name = getDisplayName();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="main-content">
      {/* チャットヘッダー */}
      <div className="chat-header">
        <div className="chat-info">
          <h2 className="chat-title">{selectedSpace}</h2>
          <div className="chat-subtitle">
            {selectedSpace === "ホーム"
              ? "チャットルームを選択してください"
              : `${
                  userRooms.find((r) => r.roomName === selectedSpace)?.memberCount || 0
                }人のメンバー`}
          </div>
        </div>
        <div className="chat-actions">
          {/* ユーザー情報表示 */}
          <div className="user-profile-display">
            <div className="user-avatar-display">{getDisplayAvatar()}</div>
            <div className="user-info-display">
              <div className="user-name-display">{getDisplayName()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* メッセージ表示エリア */}
      {selectedSpace === "ホーム" ? (
        <div className="messages-container">
          <div className="messages-list">
            <div className="welcome-message">
              <h3>チャットへようこそ！</h3>
              <p>
                左側のルーム一覧からチャットルームを選択するか、新しいチャットを作成してください。
              </p>
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
          </div>
        </div>
      ) : (
        <>
          <MessageList roomId={selectedRoomId} currentUser={currentUser} />
          <MessageInput 
            roomId={selectedRoomId} 
            currentUser={currentUser} 
            selectedSpace={selectedSpace} 
          />
        </>
      )}
    </div>
  );
};

export default ChatArea;