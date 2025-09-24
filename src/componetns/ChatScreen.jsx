import { useMessages } from "../hooks/useMessages";
import MessageInput from "./MessageInput";

function ChatScreen({ user, selectedRoomId }) {
  const { messages, sendMessage, isSending, isLoading, error, messagesEndRef } =
    useMessages(user, selectedRoomId);

  return (
    <div className="chat-screen">
      {/* メッセージ一覧 */}
      <div className="messages-list">
        {isLoading && <div>読み込み中...</div>}
        {messages.map((m) => (
          <div key={m.messageId} className={m.isOwn ? "own" : "other"}>
            <span className="avatar">{m.avatar}</span>
            <span className="content">{m.content}</span>
            <span className="time">{m.time}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力欄 */}
      <MessageInput onSend={sendMessage} disabled={isSending} />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
