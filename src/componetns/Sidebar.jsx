// components/Sidebar.jsx
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
              className={`nav-item dm-item ${
                selectedSpace === room.roomName ? "active" : ""
              }`}
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
                {dmSearchResults
                  .filter(
                    (user) =>
                      !directRooms.some((room) =>
                        room.roomName.includes(user.nickname || user.email)
                      )
                  )
                  .map((user) => (
                    <div
                      key={user.userId}
                      className="dm-search-result-item"
                      onClick={() => {
                        createDirectRoom_func(user.userId);
                        setDmSearchTerm("");
                        setDmSearchResults([]);
                      }}
                    >
                      <span className="nav-icon user-avatar">
                        {(user.nickname || user.email)
                          .substring(0, 2)
                          .toUpperCase()}
                      </span>
                      <div className="dm-user-info">
                        <span className="dm-user-name">
                          {user.nickname || user.email}
                        </span>
                        <span className="dm-user-email">{user.email}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;