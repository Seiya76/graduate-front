import { useState } from 'react';

export const useModal = () => {
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isRoomCreationLoading, setIsRoomCreationLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  // ユーザー選択のトグル
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // モーダルリセット関数
  const resetModal = () => {
    setIsCreatingRoom(false);
    setIsRoomCreationLoading(false);
    setSelectedUsers([]);
    setNewRoomName("");
  };

  return {
    isCreatingRoom,
    setIsCreatingRoom,
    isRoomCreationLoading,
    setIsRoomCreationLoading,
    newRoomName,
    setNewRoomName,
    selectedUsers,
    setSelectedUsers,
    toggleUserSelection,
    resetModal
  };
};