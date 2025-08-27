import React from "react";

function MessageList({ selectedSpace, groupRooms, directRooms, messages }) {
  return (
    <div className="messages-container">
      <div className="messages-list">
        {selectedSpace === "ホーム" ? (
          <div className="welcome-message">
            <h3>チャットへようこそ！</h3>
            <p>左側からルームを選択してください</p>
            <div className="stats">
              <div className="stat-item"><strong>{groupRooms.length}</strong> グループルーム</div>
              <div className="stat-item"><strong>{directRooms.length}</strong> ダイレクト</div>
            </div>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`message-item ${m.isOwn ? "own-message" : ""}`}>
              {!m.isOwn && <div className="message-avatar">{m.avatar}</div>}
              <div className="message-content">
                <div className="message-header">
                  <span className="sender-name">{m.sender}</span>
                  <span className="message-time">{m.time}</span>
                </div>
                <div className="message-text">{m.content}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default MessageList;
