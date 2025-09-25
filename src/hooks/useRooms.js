// hooks/useRooms.js
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getUserRooms } from '../graphql/queries';
import { createGroupRoom, createDirectRoom } from '../graphql/mutations';

const client = generateClient();

export const useRooms = (currentUser) => {
  const [userRooms, setUserRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomError, setRoomError] = useState(null);

  // ルーム一覧の取得
  useEffect(() => {
    const fetchUserRooms = async () => {
      if (!currentUser?.userId) return;

      setIsLoadingRooms(true);
      try {
        const result = await client.graphql({
          query: getUserRooms,
          variables: {
            userId: currentUser.userId,
            limit: 50,
          },
          authMode: "apiKey",
        });

        if (result.data.getUserRooms?.items) {
          setUserRooms(result.data.getUserRooms.items);
        }
      } catch (error) {
        console.error("Error fetching user rooms:", error);
        setRoomError('ルーム一覧の取得に失敗しました');
      } finally {
        setIsLoadingRooms(false);
      }
    };

    fetchUserRooms();
  }, [currentUser]);

  // グループルーム作成
  const createNewGroupRoom = async (roomName, memberUserIds, createdBy) => {
    try {
      const result = await client.graphql({
        query: createGroupRoom,
        variables: {
          input: {
            roomName: roomName.trim(),
            memberUserIds: memberUserIds,
            createdBy: createdBy,
          },
        },
        authMode: "apiKey",
      });

      if (result.data.createGroupRoom) {
        const createdRoom = result.data.createGroupRoom;
        const newRoom = {
          ...createdRoom,
          lastMessage: createdRoom.lastMessage || "未入力",
          lastMessageAt: createdRoom.lastMessageAt || createdRoom.createdAt,
        };
        setUserRooms((prev) => [newRoom, ...prev]);
        return createdRoom;
      }
    } catch (error) {
      console.error("Error creating group room:", error);
      throw error;
    }
  };

  // ダイレクトルーム作成
  const createNewDirectRoom = async (targetUserId, createdBy) => {
    try {
      const result = await client.graphql({
        query: createDirectRoom,
        variables: {
          targetUserId: targetUserId,
          createdBy: createdBy,
        },
        authMode: "apiKey",
      });

      if (result.data.createDirectRoom) {
        const newRoom = {
          ...result.data.createDirectRoom,
          lastMessage: result.data.createDirectRoom.lastMessage || "未入力",
          lastMessageAt:
            result.data.createDirectRoom.lastMessageAt ||
            result.data.createDirectRoom.createdAt,
        };
        setUserRooms((prev) => [newRoom, ...prev]);
        return result.data.createDirectRoom;
      }
    } catch (error) {
      console.error("Error creating direct room:", error);
      throw error;
    }
  };

  // ルームの分類
  const groupRooms = userRooms.filter((room) => room.roomType === "group");
  const directRooms = userRooms.filter((room) => room.roomType === "direct");

  return {
    userRooms,
    groupRooms,
    directRooms,
    setUserRooms,
    createNewGroupRoom,
    createNewDirectRoom,
    isLoadingRooms,
    roomError,
  };
};