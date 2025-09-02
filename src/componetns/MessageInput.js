import React from 'react';

const MessageInput = ({ 
  newMessage, 
  setNewMessage, 
  onSendMessage, 
  onKeyPress, 
  sending, 
  selectedRoom 
}) => {
  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
    }
  };

  if (!selectedRoom) {
    return null;
  }

  return (
    <div className="message-input-area">
      <div className="input-container">
        <button className="attach-btn" title="ファイル添付">📎</button>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={`${selectedRoom.roomName || selectedRoom.roomId}にメッセージを送信`}
          className="message-input"
          rows="1"
          disabled={sending}
        />
        <div className="input-actions">
          <button className="icon-btn emoji-btn" title="絵文字">😊</button>
          <button 
            onClick={handleSend}
            className={`send-btn ${newMessage.trim() ? 'active' : ''}`}
            disabled={!newMessage.trim() || sending}
            title="送信"
          >
            {sending ? '送信中...' : '送信'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;