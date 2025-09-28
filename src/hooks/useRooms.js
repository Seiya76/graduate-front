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
        setUserRooms((prev) => {
          const updated = [createdRoom, ...prev];
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

  // ルームの分類（memberCountのみを使用）
  const groupRooms = userRooms.filter((room) => {
    // memberCountが3以上、またはmemberCountが未定義/nullの場合はグループルーム
    const isGroup = !room.memberCount || room.memberCount !== 2;
    
    console.log(`🔍 Room "${room.roomName}" classified as group:`, isGroup, {
      memberCount: room.memberCount
    });
    
    return isGroup;
  });

  console.log("🔍 useRooms: Final classification", {
    totalRooms: userRooms.length,
    groupRooms: groupRooms.length,
    groupRoomNames: groupRooms.map(r => r.roomName),
  });

  return {
    userRooms,
    groupRooms,
    setUserRooms,
    createNewGroupRoom,
    isLoadingRooms,
    roomError,
  };
};