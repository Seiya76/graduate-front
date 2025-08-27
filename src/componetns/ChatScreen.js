import React, { useState } from "react";
import { generateClient } from "aws-amplify/api";
import { createGroupRoom, createDirectRoom } from "../graphql/mutations";

import useAuthUser from "../hooks/useAuthUser";
import useUserRooms from "../hooks/useUserRooms";

import Sidebar from "./Sidebar";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import RoomModal from "./RoomModal";
import UserProfile from "./UserProfile";

const client = generateClient();

function ChatScreen({ user, onSignOut }) {
  const currentUser = useAuthUser(user);
  const userRooms = useUserRooms(currentUser);

  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // グループルームとDMに分割
  const groupRooms = userRooms.filter((room) => room.roomType === "group");
  const directRooms = userRooms.filter((room) => room.roomType === "direct");

  // メッセージ送信（ローカルのみ）
  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const displayName =
      currentUser?.nickname || user.profile.name || user.profile.email;

    const newMsg = {
      id: messages.length + 1,
      sender: displayName,
      content: newMessage,
      time: new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isOwn: true,
      avatar: displayName.substring(0, 2).toUpperCase(),
    };

    setMessages([...messages, newMsg]);
    setNewMessage("");
  };

  // ダイレクトルーム作成（例: DM開始時）
  const createDirectChat = async (targetUserId) => {
    if (!currentUser?.userId) return;
    try {
      const result = await client.graphql({
        query: createDirectRoom,
        variables: {
          targetUserId,
          createdBy: currentUser.userId,
        },
        authMode: "userPool",
      });
      console.log("Direct room created:", result.data.createDirectRoom);
    } catch (err) {
      console.error("Error creating direct room:", err);
    }
  };

  return (
    <div className="chat-app">
      {/* サイドバー */}
      <Sidebar
        selectedSpace={selectedSpace}
        setSelectedSpace={setSelectedSpace}
        groupRooms={groupRooms}
        directRooms={directRooms}
        onSignOut={onSignOut}
        onCreateRoom={() => setIsCreatingRoom(true)}
      />

      {/* メインコンテンツ */}
      <div className="main-content">
        {/* チャットヘッダー */}
        <div className="chat-header">
          <div className="chat-info">
            <h2 className="chat-title">{selectedSpace}</h2>
            <div className="chat-subtitle">
              {selectedSpace === "ホーム"
                ? "チャットルームを選択してください"
                : `${
                    groupRooms.find((r) => r.roomName === selectedSpace)
                      ?.memberCount ||
                    directRooms.find((r) => r.roomName === selectedSpace)
                      ?.memberCount ||
                    0
                  }人のメンバー`}
            </div>
          </div>
          <UserProfile currentUser={currentUser} />
        </div>

        {/* メッセージ一覧 */}
        <MessageList
          selectedSpace={selectedSpace}
          groupRooms={groupRooms}
          directRooms={directRooms}
          messages={messages}
        />

        {/* メッセージ入力 */}
        {selectedSpace !== "ホーム" && (
          <MessageInput
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            sendMessage={sendMessage}
          />
        )}
      </div>

      {/* ルーム作成モーダル */}
      {isCreatingRoom && (
        <RoomModal
          onClose={() => setIsCreatingRoom(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

export default ChatScreen;
