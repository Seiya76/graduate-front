import React from "react";

function Sidebar({ selectedSpace, setSelectedSpace, groupRooms, directRooms, onSignOut, onCreateRoom }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="app-title"><span className="chat-icon">Chat</span></div>
        <div className="header-actions">
          <button className="icon-btn signout-btn" onClick={onSignOut}>サインアウト</button>
        </div>
      </div>

      <div className="new-chat-section">
        <button className="new-chat-btn" onClick={onCreateRoom}>
          <span className="plus-icon">+</span> 新しいチャット
        </button>
      </div>

      <div className="nav-section">
        <div className="nav-group">
          <div className="nav-group-header">ショートカット</div>
          <div
            className={`nav-item ${selectedSpace === "ホーム" ? "active" : ""}`}
            onClick={() => setSelectedSpace("ホーム")}
          >
            ホーム
          </div>
          {groupRooms.map(room => (
            <div
              key={room.roomId}
              className={`nav-item ${selectedSpace === room.roomName ? "active" : ""}`}
              onClick={() => setSelectedSpace(room.roomName)}
            >
              {room.roomName} ({room.memberCount})
            </div>
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-group-header">ダイレクトメッセージ</div>
          {directRooms.map(room => (
            <div
              key={room.roomId}
              className={`nav-item ${selectedSpace === room.roomName ? "active" : ""}`}
              onClick={() => setSelectedSpace(room.roomName)}
            >
              {room.roomName}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
