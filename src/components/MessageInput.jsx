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
    const success = await onSendMessage(messageContent);
    
    if (success) {
      setNewMessage("");
    }
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
          disabled={isSendingMessage}
        />
        <div className="input-actions">
          <button
            onClick={handleSend}
            className={`send-btn ${
              newMessage.trim() && !isSendingMessage ? "active" : ""
            }`}
            disabled={!newMessage.trim() || isSendingMessage}
            title="送信"
          >
            {isSendingMessage ? (
              <span className="loading-spinner-small"></span>
            ) : (
              "→"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;