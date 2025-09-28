import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getUserRooms } from '../graphql/queries';
import { createGroupRoom } from '../graphql/mutations';

const client = generateClient();

export const useRooms = (currentUser) => {
  const [userRooms, setUserRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomError, setRoomError] = useState(null);

  // ルーム一覧の取得
  useEffect(() => {
    const fetchUserRooms = async () => {
      if (!currentUser?.userId) {
        return;
      }

      setIsLoadingRooms(true);
      setRoomError(null);
      
      try {
        const result = await client.graphql({
          query: getUserRooms,
          variables: {
            userId: currentUser.userId,
            limit: 50,
          },
          authMode: "apiKey",
        });

        if (result.data?.getUserRooms?.items) {
          const rooms = result.data.getUserRooms.items;
          setUserRooms(rooms);
        } else {
          setUserRooms([]);
        }
      } catch (error) {
        setRoomError('ルーム一覧の取得に失敗しました: ' + error.message);
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
        setUserRooms((prev) => [createdRoom, ...prev]);
        return createdRoom;
      }
    } catch (error) {
      throw error;
    }
  };

  return {
    userRooms,
    groupRooms: userRooms, // 全てのルームをグループルームとして扱う
    setUserRooms,
    createNewGroupRoom,
    isLoadingRooms,
    roomError,
  };
};