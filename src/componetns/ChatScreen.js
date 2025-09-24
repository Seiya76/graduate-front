// components/ChatScreen.js
import React, { useState, useMemo } from 'react';
import { useCurrentUser } from '../hooks/useAuth';
import { useRooms } from '../hooks/useRooms';
import { useNotifications } from '../hooks/useNotifications';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';

const ChatScreen = ({ user, onSignOut }) => {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // カスタムフック使用
  const currentUser = useCurrentUser(user);
  const { 
    groupRooms, 
    directRooms, 
    createGroup, 
    createDirect, 
    isCreatingRoom: isRoomCreationLoading 
  } = useRooms(currentUser);
  const { showNotification } = useNotifications();

  // 選択されたルームのIDを取得
  const selectedRoomId = useMemo(() => {
    if (selectedSpace === "ホーム") return null;
    
    const allRooms = [...groupRooms, ...directRooms];
    const room = allRooms.find(room => room.roomName === selectedSpace);
    return room?.roomId || null;
  }, [selectedSpace, groupRooms, directRooms]);

  const handleCreateGroup = async (roomName, memberUserIds) => {
    try {
      const newRoom = await createGroup(roomName, memberUserIds);
      if (newRoom) {
        setSelectedSpace(newRoom.roomName);
        setIsCreatingRoom(false);
      }
      return newRoom;
    } catch (error) {
      throw error;
    }
  };

  const handleCreateDirect = async (targetUserId) => {
    try {
      const newRoom = await createDirect(targetUserId);
      if (newRoom) {
        setSelectedSpace(newRoom.roomName);
      }
    } catch (error) {
      console.error("Error creating direct room:", error);
      alert("ダイレクトルーム作成でエラーが発生しました: " + error.message);
    }
  };

  return (
    <div className="chat-app">
      <Sidebar
        selectedSpace={selectedSpace}
        setSelectedSpace={setSelectedSpace}
        groupRooms={groupRooms}
        directRooms={directRooms}
        isCreatingRoom={isCreatingRoom}
        setIsCreatingRoom={setIsCreatingRoom}
        onCreateGroup={handleCreateGroup}
        onCreateDirect={handleCreateDirect}
        onSignOut={onSignOut}
        currentUser={currentUser}
        user={user}
      />
      
      <ChatArea
        selectedSpace={selectedSpace}
        selectedRoomId={selectedRoomId}
        userRooms={[...groupRooms, ...directRooms]}
        currentUser={currentUser}
        user={user}
        groupRooms={groupRooms}
        directRooms={directRooms}
      />
    </div>
  );
};

export default ChatScreen;