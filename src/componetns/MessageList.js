import React from 'react';
import { useMessages } from '../hooks/useMessages';

const MessageList = ({ roomId, currentUser }) => {
  const { messages, isLoading, error, messagesEndRef } = useMessages(roomId, currentUser);

  if (isLoading) {
    return (
      <div className="messages-container">
        <div className="messages-list">
          <div className="loading-messages">メッセージを読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="messages-container">
        <div className="messages-list">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-container">
      <div className="messages-list">
        {messages.map((message, index) => {
          const showAvatar = index === 0 || messages[index - 1].userId !== message.userId;
          const isLastFromUser = index === messages.length - 1 || 
            messages[index + 1]?.userId !== message.userId;

          return (
            <div
              key={message.messageId || message.id}
              className={`message-item ${message.isOwn ? "own-message" : ""} ${
                isLastFromUser ? "last-from-user" : ""
              } ${message.isOptimistic ? "optimistic" : ""}`}
            >
              {!message.isOwn && (
                <div className="message-avatar user-avatar">
                  {message.avatar}
                </div>
              )}
              <div className="message-content">
                <div className="message-text">{message.content}</div>
                <div className="message-time-inline">{message.time}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;