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
          // 削除された属性のフォールバック処理を削除
          roomType: 'group' // フロントエンドで設定
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
          roomType: 'direct' // フロントエンドで設定（重要）
        };
        setUserRooms((prev) => [newRoom, ...prev]);
        return result.data.createDirectRoom;
      }
    } catch (error) {
      console.error("Error creating direct room:", error);
      throw error;
    }
  };

  // ルームの分類（フロントエンドで判定）
  const groupRooms = userRooms.filter((room) => {
    // 1. フロントエンドで設定したroomTypeを優先
    if (room.roomType === "group") return true;
    if (room.roomType === "direct") return false;
    
    // 2. roomTypeがない場合の判定ロジック
    // - memberCountが3人以上 → グループ
    // - roomNameに'-'が含まれていない → グループ
    // - memberCountが2人でroomNameに'-'が含まれる → ダイレクト
    if (room.memberCount > 2) return true;
    if (!room.roomName.includes('-')) return true;
    
    return false;
  });
  
  const directRooms = userRooms.filter((room) => {
    // 1. フロントエンドで設定したroomTypeを優先
    if (room.roomType === "direct") return true;
    if (room.roomType === "group") return false;
    
    // 2. roomTypeがない場合の判定ロジック
    // - memberCountが2人かつroomNameに'-'が含まれる → ダイレクト
    if (room.memberCount === 2 && room.roomName.includes('-')) return true;
    
    return false;
  });

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