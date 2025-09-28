import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getUserRooms } from '../graphql/queries';
import { createGroupRoom, createDirectRoom } from '../graphql/mutations';

const client = generateClient();

export const useRooms = (currentUser) => {
  const [userRooms, setUserRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomError, setRoomError] = useState(null);

  // ルーム分類部分の前に追加
console.log("🔍 All fetched rooms:", userRooms);
console.log("🔍 Room details:", userRooms.map(room => ({
  roomId: room.roomId,
  roomName: room.roomName,
  roomType: room.roomType,
  memberCount: room.memberCount,
  hasHyphen: room.roomName?.includes('-')
})));

// より寛容な分類条件でテスト
const allRoomsAsGroup = userRooms; // 一時的に全ルームをグループとして表示

  // ルーム一覧の取得
  useEffect(() => {
    const fetchUserRooms = async () => {
      if (!currentUser?.userId) {
        console.log("🔍 useRooms: currentUser or userId is missing", currentUser);
        return;
      }

      console.log("🔍 useRooms: Starting to fetch rooms for user", currentUser.userId);
      setIsLoadingRooms(true);
      setRoomError(null);
      
      try {
        console.log("🔍 useRooms: Making GraphQL request...");
        const result = await client.graphql({
          query: getUserRooms,
          variables: {
            userId: currentUser.userId,
            limit: 50,
          },
          authMode: "apiKey",
        });

        console.log("🔍 useRooms: GraphQL response received", result);
        console.log("🔍 useRooms: Result data structure", JSON.stringify(result.data, null, 2));

        if (result.data?.getUserRooms?.items) {
          const rooms = result.data.getUserRooms.items;
          console.log("🔍 useRooms: Found rooms", rooms.length, rooms);
          setUserRooms(rooms);
          
          // 各ルームの詳細をログ出力
          rooms.forEach((room, index) => {
            console.log(`🔍 Room ${index + 1}:`, {
              roomId: room.roomId,
              roomName: room.roomName,
              memberCount: room.memberCount,
              roomType: room.roomType,
              createdBy: room.createdBy,
              lastMessageAt: room.lastMessageAt
            });
          });
        } else {
          console.log("🔍 useRooms: No rooms found in response", result.data);
          setUserRooms([]);
        }
      } catch (error) {
        console.error("🔍 useRooms: Error fetching user rooms", error);
        console.error("🔍 useRooms: Error details", {
          message: error.message,
          errors: error.errors,
          graphQLErrors: error.graphQLErrors
        });
        setRoomError('ルーム一覧の取得に失敗しました: ' + error.message);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    fetchUserRooms();
  }, [currentUser]);

  // グループルーム作成
  const createNewGroupRoom = async (roomName, memberUserIds, createdBy) => {
    console.log("🔍 useRooms: Creating group room", { roomName, memberUserIds, createdBy });
    
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

      console.log("🔍 useRooms: Group room created", result);

      if (result.data.createGroupRoom) {
        const createdRoom = result.data.createGroupRoom;
        const newRoom = {
          ...createdRoom,
          roomType: 'group'
        };
        setUserRooms((prev) => {
          const updated = [newRoom, ...prev];
          console.log("🔍 useRooms: Updated rooms after creation", updated);
          return updated;
        });
        return createdRoom;
      }
    } catch (error) {
      console.error("🔍 useRooms: Error creating group room", error);
      throw error;
    }
  };

  // ダイレクトルーム作成
  const createNewDirectRoom = async (targetUserId, createdBy) => {
    console.log("🔍 useRooms: Creating direct room", { targetUserId, createdBy });
    
    try {
      const result = await client.graphql({
        query: createDirectRoom,
        variables: {
          targetUserId: targetUserId,
          createdBy: createdBy,
        },
        authMode: "apiKey",
      });

      console.log("🔍 useRooms: Direct room created", result);

      if (result.data.createDirectRoom) {
        const newRoom = {
          ...result.data.createDirectRoom,
          roomType: 'direct'
        };
        setUserRooms((prev) => {
          const updated = [newRoom, ...prev];
          console.log("🔍 useRooms: Updated rooms after DM creation", updated);
          return updated;
        });
        return result.data.createDirectRoom;
      }
    } catch (error) {
      console.error("🔍 useRooms: Error creating direct room", error);
      throw error;
    }
  };

  // ルームの分類
  const groupRooms = userRooms.filter((room) => {
    const isGroup = room.roomType === "group" || 
                   room.memberCount > 2 || 
                   !room.roomName.includes('-');
    
    console.log(`🔍 Room "${room.roomName}" classified as group:`, isGroup, {
      roomType: room.roomType,
      memberCount: room.memberCount,
      hasHyphen: room.roomName.includes('-')
    });
    
    return isGroup;
  });
  
  const directRooms = userRooms.filter((room) => {
    const isDirect = room.roomType === "direct" || 
                    (room.memberCount === 2 && room.roomName.includes('-'));
    
    console.log(`🔍 Room "${room.roomName}" classified as direct:`, isDirect, {
      roomType: room.roomType,
      memberCount: room.memberCount,
      hasHyphen: room.roomName.includes('-')
    });
    
    return isDirect;
  });

  console.log("🔍 useRooms: Final classification", {
    totalRooms: userRooms.length,
    groupRooms: groupRooms.length,
    directRooms: directRooms.length,
    groupRoomNames: groupRooms.map(r => r.roomName),
    directRoomNames: directRooms.map(r => r.roomName)
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