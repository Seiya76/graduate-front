import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { createGroupRoom, createDirectRoom } from '../graphql/mutations';
import { getUserRooms } from '../graphql/queries';

const client = generateClient();

export const useRooms = (currentUser) => {
  const [userRooms, setUserRooms] = useState([]);

  // ユーザーのルーム一覧を取得
  useEffect(() => {
    const fetchUserRooms = async () => {
      if (!currentUser?.userId) return;

      try {
        const result = await client.graphql({
          query: getUserRooms,
          variables: { 
            userId: currentUser.userId,
            limit: 50 
          },
          authMode: 'apiKey'
        });

        if (result.data.getUserRooms?.items) {
          setUserRooms(result.data.getUserRooms.items);
        }
      } catch (error) {
        // エラー処理は必要に応じて追加
      }
    };

    if (currentUser?.userId) {
      fetchUserRooms();
    }
  }, [currentUser]);

  // グループルーム作成
  const createGroupRoom_func = async (roomName, selectedUsers) => {
    if (!roomName.trim() || !currentUser?.userId) return null;

    try {
      const result = await client.graphql({
        query: createGroupRoom,
        variables: {
          input: {
            roomName: roomName.trim(),
            memberUserIds: selectedUsers,
            createdBy: currentUser.userId
          }
        },
        authMode: 'apiKey'
      });

      if (result.data.createGroupRoom) {
        const createdRoom = result.data.createGroupRoom;
        
        const newRoom = {
          ...createdRoom,
          lastMessage: createdRoom.lastMessage || "未入力",
          lastMessageAt: createdRoom.lastMessageAt || createdRoom.createdAt
        };
        setUserRooms(prev => [newRoom, ...prev]);
        
        return createdRoom;
      }
    } catch (error) {
      throw error;
    }
  };

  // ダイレクトルーム作成
  const createDirectRoom_func = async (targetUserId) => {
    if (!currentUser?.userId || !targetUserId) return null;

    try {
      const result = await client.graphql({
        query: createDirectRoom,
        variables: {
          targetUserId: targetUserId,
          createdBy: currentUser.userId
        },
        authMode: 'apiKey'
      });

      if (result.data.createDirectRoom) {
        const newRoom = {
          ...result.data.createDirectRoom,
          lastMessage: result.data.createDirectRoom.lastMessage || "未入力",
          lastMessageAt: result.data.createDirectRoom.lastMessageAt || result.data.createDirectRoom.createdAt
        };
        setUserRooms(prev => [newRoom, ...prev]);
        return result.data.createDirectRoom;
      }
    } catch (error) {
      throw error;
    }
  };

  // ルーム分類
  const groupRooms = userRooms.filter(room => room.roomType === 'group');
  const directRooms = userRooms.filter(room => room.roomType === 'direct');

  return {
    userRooms,
    groupRooms,
    directRooms,
    createGroupRoom_func,
    createDirectRoom_func
  };
};