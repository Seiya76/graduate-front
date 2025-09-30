import React from 'react';

const Sidebar = ({
  selectedSpace,
  setSelectedSpace,
  groupRooms,
  directRooms,
  isCreatingRoom,
  setIsCreatingRoom,
  dmSearchTerm,
  setDmSearchTerm,
  dmSearchResults,
  createDirectRoom_func,
  setDmSearchResults,
  onSignOut
}) => {
  
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
              className={`nav-item ${
                selectedSpace === room.roomName ? "active" : ""
              }`}
              onClick={() => setSelectedSpace(room.roomName)}
            >
              <span className="nav-icon icon-team"></span>
              <span className="nav-text">{room.roomName}</span>
              <span className="member-count">({room.memberCount})</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Sidebar;