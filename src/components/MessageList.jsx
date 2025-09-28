import React from 'react';

const MessageList = ({ 
  messages, 
  messagesEndRef, 
  isLoadingMessages,
  selectedSpace,
  groupRooms
}) => {
  
  if (selectedSpace === "ホーム") {
    return (
      <div className="messages-list">
        <div className="welcome-message">
          <p>
            左側のルーム一覧からチャットルームを選択するか、新しいチャットを作成してください。
          </p>
          <div className="stats">
            <div className="stat-item">
              <strong>{groupRooms.length}</strong>
              <span>グループルーム</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-list">
      {isLoadingMessages && messages.length === 0 ? (
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <div>メッセージを読み込み中...</div>
        </div>
      ) : (
        <>
          {messages.map((message, index) => {
            const showAvatar = index === 0 || messages[index - 1].userId !== message.userId;
            const isLastFromUser = 
              index === messages.length - 1 || 
              messages[index + 1]?.userId !== message.userId;

            return (
              <div
                key={message.messageId || message.id}
                className={`message-item ${
                  message.isOwn ? "own-message" : ""
                } ${isLastFromUser ? "last-from-user" : ""} ${
                  message.isOptimistic ? "optimistic" : ""
                }`}
              >
                {!message.isOwn && (
                  <div className="message-avatar user-avatar">
                    {message.avatar}
                  </div>
                )}
                <div className="message-content">
                  <div className="message-text">{message.content}</div>
                  <div className="message-time-inline">
                    {message.time}
                  </div>
                </div>
              </div>
            );
          })}
          
          {messages.length === 0 && !isLoadingMessages && (
            <div className="no-messages">
              <p>まだメッセージがありません。</p>
              <p>最初のメッセージを送信してみましょう！</p>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
};

export default MessageList;