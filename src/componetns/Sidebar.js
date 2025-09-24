// components/Sidebar.js
import React from 'react';
import RoomModal from './RoomModal';
import UserSearch from './UserSearch';

const Sidebar = ({ 
  selectedSpace,
  setSelectedSpace,
  groupRooms,
  directRooms,
  isCreatingRoom,
  setIsCreatingRoom,
  onCreateGroup,
  onCreateDirect,
  onSignOut,
  currentUser,
  user
}) => {
  // タイムスタンプフォーマット関数
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "昨日";
    } else {
      return `${diffDays}日前`;
    }
  };

  return (
    <div className="sidebar">
      {/* ヘッダー */}
      <div className="sidebar-header">
        <div className="app-title">
          <span className="chat-icon">Chat</span>
        </div>
        <div className="header-actions">
          <button
            className="icon-btn signout-btn"
            onClick={onSignOut}
            title="サインアウト"
          ></button>
        </div>
      </div>

      {/* 新しいチャット */}
      <div className="new-chat-section">
        <button
          className="new-chat-btn"
          onClick={() => setIsCreatingRoom(true)}
        >
          <span className="plus-icon">+</span>
          新しいチャット
        </button>
      </div>

      {/* ルーム作成モーダル */}
      <RoomModal
        isOpen={isCreatingRoom}
        onClose={() => setIsCreatingRoom(false)}
        onCreateGroup={onCreateGroup}
        currentUser={currentUser}
      />

      {/* ナビゲーション */}
      <div className="nav-section">
        {/* グループメッセージ */}
        <div className="nav-group">
          <div className="nav-group-header">グループメッセージ</div>
          <div
            className={`nav-item ${selectedSpace === "ホーム" ? "active" : ""}`}
            onClick={() => setSelectedSpace("ホーム")}
          >
            <span className="nav-icon icon-home"></span>
            <span className="nav-text">ホーム</span>
          </div>

          {/* グループルーム */}
          {groupRooms.map((room) => (
            <div
              key={room.roomId}
              className={`nav-item ${selectedSpace === room.roomName ? "active" : ""}`}
              onClick={() => setSelectedSpace(room.roomName)}
            >
              <span className="nav-icon icon-team"></span>
              <span className="nav-text">{room.roomName}</span>
              <span className="member-count">({room.memberCount})</span>
              {room.lastMessageAt && (
                <span className="last-message-time">
                  {new Date(room.lastMessageAt).toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
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
              className={`nav-item dm-item ${selectedSpace === room.roomName ? "active" : ""}`}
              onClick={() => setSelectedSpace(room.roomName)}
            >
              <span className="nav-icon user-avatar">
                {room.roomName.substring(0, 2).toUpperCase()}
              </span>
              <div className="dm-info">
                <span className="nav-text">{room.roomName}</span>
                <div className="dm-preview">
                  <span className="last-message">
                    {room.lastMessage || "未入力"}
                  </span>
                  <span className="last-time">
                    {formatTime(room.lastMessageAt)}
                  </span>
                </div>
              </div>
              <div className="status-indicator online"></div>
            </div>
          ))}

          {/* ユーザー検索 */}
          <UserSearch
            onSelectUser={onCreateDirect}
            currentUser={currentUser}
            directRooms={directRooms}
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;