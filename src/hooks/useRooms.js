import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getUserRooms } from '../graphql/queries';
import { createGroupRoom, createDirectRoom } from '../graphql/mutations';
import { onRoomUpdate } from '../graphql/subscriptions';

const client = generateClient();

export const useRooms = (currentUser) => {
  const [rooms, setRooms] = useState([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // ユーザーのルーム一覧を取得
  useEffect(() => {
    const fetchUserRooms = async () => {
      if (!currentUser?.userId) return;

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
          setRooms(result.data.getUserRooms.items);
        }
      } catch (error) {
        console.error("Error fetching user rooms:", error);
      }
    };

    if (currentUser?.userId) {
      fetchUserRooms();
    }
  }, [currentUser]);

  // ルーム更新のサブスクリプション
  useEffect(() => {
    if (!currentUser?.userId) return;

    let roomSubscription;

    try {
      roomSubscription = client
        .graphql({
          query: onRoomUpdate,
          variables: { userId: currentUser.userId },
          authMode: "apiKey",
        })
        .subscribe({
          next: (eventData) => {
            if (eventData.value?.data?.onRoomUpdate) {
              const updatedRoom = eventData.value.data.onRoomUpdate;

              // ルーム一覧を更新
              setRooms((prevRooms) => {
                const existingIndex = prevRooms.findIndex(
                  (r) => r.roomId === updatedRoom.roomId
                );

                if (existingIndex >= 0) {
                  // 既存のルームを更新
                  const updated = [...prevRooms];
                  updated[existingIndex] = updatedRoom;
                  return updated;
                } else {
                  // 新しいルームを追加
                  return [updatedRoom, ...prevRooms];
                }
              });
            }
          },
          error: (error) => {
            console.error("Room subscription error:", error);
          },
        });
    } catch (error) {
      console.error("Failed to setup room subscription:", error);
    }

    return () => {
      if (roomSubscription) {
        roomSubscription.unsubscribe();
      }
    };
  }, [currentUser?.userId]);

  // グループルーム作成
  const createGroup = async (roomName, memberUserIds) => {
    if (!roomName.trim() || !currentUser?.userId) return;

    setIsCreatingRoom(true);

    try {
      const result = await client.graphql({
        query: createGroupRoom,
        variables: {
          input: {
            roomName: roomName.trim(),
            memberUserIds: memberUserIds,
            createdBy: currentUser.userId,
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
        setRooms((prev) => [newRoom, ...prev]);
        return newRoom;
      }
    } catch (error) {
      console.error("Error creating room:", error);
      throw error;
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // ダイレクトルーム作成
  const createDirect = async (targetUserId) => {
    if (!currentUser?.userId || !targetUserId) return;

    try {
      const result = await client.graphql({
        query: createDirectRoom,
        variables: {
          targetUserId: targetUserId,
          createdBy: currentUser.userId,
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
        setRooms((prev) => [newRoom, ...prev]);
        return newRoom;
      }
    } catch (error) {
      console.error("Error creating direct room:", error);
      throw error;
    }
  };

  const groupRooms = rooms.filter((room) => room.roomType === "group");
  const directRooms = rooms.filter((room) => room.roomType === "direct");

  return {
    rooms,
    groupRooms,
    directRooms,
    createGroup,
    createDirect,
    isCreatingRoom,
  };
};