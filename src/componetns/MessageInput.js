import React from "react";

function MessageInput({ newMessage, setNewMessage, sendMessage }) {
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="message-input-area">
      <div className="input-container">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="メッセージを入力"
          className="message-input"
          rows="1"
        />
        <button
          onClick={sendMessage}
          className={`send-btn ${newMessage.trim() ? "active" : ""}`}
          disabled={!newMessage.trim()}
        >
          送信
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
