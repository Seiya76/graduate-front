import React from 'react';

const MessageList = ({ messages, currentUser, onDeleteMessage, onLoadMore, hasMore, loading }) => {
  const handleDeleteClick = (messageId) => {
    if (window.confirm('このメッセージを削除しますか？')) {
      onDeleteMessage(messageId);
    }
  };

  return (
    <div className="messages-container">
      {/* 追加読み込みボタン */}
      {hasMore && (
        <div className="load-more-container">
          <button 
            onClick={onLoadMore}
            disabled={loading}
            className="load-more-btn"
          >
            {loading ? '読み込み中...' : '過去のメッセージを読み込む'}
          </button>
        </div>
      )}

      {/* メッセージ一覧 */}
      <div className="messages-list">
        {messages.map((message) => (
          <div 
            key={message.messageId} 
            className={`message-item ${message.isOwn ? 'own-message' : ''}`}
          >
            {!message.isOwn && (
              <div className="message-avatar user-avatar">
                {message.avatar}
              </div>
            )}
            <div className="message-content">
              <div className="message-header">
                <span className="sender-name">{message.sender}</span>
                <span className="message-time">{message.time}</span>
                {message.isOwn && (
                  <button 
                    onClick={() => handleDeleteClick(message.messageId)}
                    className="delete-message-btn"
                    title="メッセージを削除"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="message-text">{message.content}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessageList;