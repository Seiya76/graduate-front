import React, { useState, useCallback } from 'react';
import { useMessages } from '../hooks/useMessages';

const MessageInput = ({ roomId, currentUser, selectedSpace }) => {
  const [inputMessage, setInputMessage] = useState("");
  const { sendMessage, isSending, error } = useMessages(roomId, currentUser);

  // メッセージ送信ハンドラー
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !roomId || isSending) return;
    
    await sendMessage(inputMessage);
    setInputMessage("");
  }, [inputMessage, roomId, sendMessage, isSending]);

  // キーボードイベントハンドラー
  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // ルームが選択されていない場合は表示しない
  if (!roomId) return null;

  return (
    <div className="message-input-area">
      {/* エラー表示 */}
      {error && (
        <div className="error-notification">
          {error}
        </div>
      )}
      
      {/* 入力コンテナ */}
      <div className="input-container">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`${selectedSpace}にメッセージを送信`}
          className="message-input"
          rows="1"
          disabled={isSending}
        />
        <div className="input-actions">
          <button
            onClick={handleSendMessage}
            className={`send-btn ${
              inputMessage.trim() && !isSending ? "active" : ""
            }`}
            disabled={!inputMessage.trim() || isSending}
            title={isSending ? "送信中..." : "送信"}
          >
            {isSending ? (
              <span className="loading-spinner-small"></span>
            ) : (
              "送信"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;