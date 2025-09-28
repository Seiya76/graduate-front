import React, { useState, useCallback } from 'react';

const MessageInput = ({ 
  selectedSpace,
  selectedRoomId,
  onSendMessage,
  isSendingMessage
}) => {
  const [newMessage, setNewMessage] = useState("");

  const handleSend = async () => {
    if (!newMessage.trim() || isSendingMessage) return;
    
    const messageContent = newMessage.trim();
    
    // メッセージを送信前に即座に入力フィールドをクリア
    setNewMessage("");
    
    // メッセージ送信（バックグラウンドで実行）
    onSendMessage(messageContent);
  };

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [newMessage, isSendingMessage]);

  if (selectedSpace === "ホーム" || !selectedRoomId) {
    return null;
  }

  return (
    <div className="message-input-area">
      <div className="input-container">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`${selectedSpace}にメッセージを送信`}
          className="message-input"
          rows="1"
        />
        <div className="input-actions">
          <button
            onClick={handleSend}
            className={`send-btn ${newMessage.trim() ? "active" : ""}`}
            disabled={!newMessage.trim()}
            title="送信"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;