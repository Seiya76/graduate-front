import React, { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/api";
import { getUser, getUserRooms, searchUsers } from "../graphql/queries";
import { createGroupRoom, createDirectRoom } from "../graphql/mutations";

import Sidebar from "./Sidebar";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import RoomModal from "./RoomModal";
import UserProfile from "./UserProfile";

const client = generateClient();

function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [currentUser, setCurrentUser] = useState(null);
  const [userRooms, setUserRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // ユーザー情報の取得
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const oidcSub = user.profile.sub;
        const result = await client.graphql({
          query: getUser,
          variables: { userId: oidcSub },
          authMode: "apiKey",
        });
        setCurrentUser(result.data.getUser || {
          userId: oidcSub,
          nickname: user.profile.name || user.profile.preferred_username,
          email: user.profile.email,
          status: "active"
        });
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };
    if (user?.profile?.sub) fetchCurrentUser();
  }, [user]);

  // ルーム一覧の取得
  useEffect(() => {
    const fetchRooms = async () => {
      if (!currentUser?.userId) return;
      const result = await client.graphql({
        query: getUserRooms,
        variables: { userId: currentUser.userId, limit: 50 },
        authMode: "apiKey",
      });
      setUserRooms(result.data.getUserRooms.items);
    };
    fetchRooms();
  }, [currentUser]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const displayName = currentUser?.nickname || user.profile.name;
    setMessages([...messages, {
      id: messages.length + 1,
      sender: displayName,
      content: newMessage,
      time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
      isOwn: true,
      avatar: displayName.substring(0, 2).toUpperCase()
    }]);
    setNewMessage("");
  };

  const groupRooms = userRooms.filter(r => r.roomType === "group");
  const directRooms = userRooms.filter(r => r.roomType === "direct");

  return (
    <div className="chat-app">
      <Sidebar
        selectedSpace={selectedSpace}
        setSelectedSpace={setSelectedSpace}
        groupRooms={groupRooms}
        directRooms={directRooms}
        onSignOut={onSignOut}
        onCreateRoom={() => setIsCreatingRoom(true)}
      />

      <div className="main-content">
        <div className="chat-header">
          <div className="chat-info">
            <h2 className="chat-title">{selectedSpace}</h2>
            <div className="chat-subtitle">
              {selectedSpace === "ホーム"
                ? "チャットルームを選択してください"
                : `${groupRooms.find(r => r.roomName === selectedSpace)?.memberCount || 
                   directRooms.find(r => r.roomName === selectedSpace)?.memberCount || 0}人のメンバー`}
            </div>
          </div>
          <UserProfile currentUser={currentUser} />
        </div>

        <MessageList
          selectedSpace={selectedSpace}
          groupRooms={groupRooms}
          directRooms={directRooms}
          messages={messages}
        />

        {selectedSpace !== "ホーム" && (
          <MessageInput
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            sendMessage={sendMessage}
          />
        )}
      </div>

      {isCreatingRoom && (
        <RoomModal
          onClose={() => setIsCreatingRoom(false)}
          currentUser={currentUser}
          setUserRooms={setUserRooms}
        />
      )}
    </div>
  );
}

export default ChatScreen;
