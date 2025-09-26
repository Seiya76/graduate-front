import { useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';

const client = generateClient();

const ON_ROOM_UPDATE = `
  subscription OnRoomUpdate($userId: ID!) {
    onRoomUpdate(userId: $userId) {
      roomId
      roomName
      createdBy
      createdAt
      lastMessageAt
      memberCount
    }
  }
`;

export const useRoomSubscription = (currentUser, setUserRooms) => {
  const roomSubscriptionRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.userId) return;

    try {
      roomSubscriptionRef.current = client
        .graphql({
          query: ON_ROOM_UPDATE,
          variables: { userId: currentUser.userId },
          authMode: "apiKey",
        })
        .subscribe({
          next: (eventData) => {
            if (eventData.value?.data?.onRoomUpdate) {
              const updatedRoom = eventData.value.data.onRoomUpdate;

              // ルーム一覧を更新
              setUserRooms((prevRooms) => {
                const existingIndex = prevRooms.findIndex(
                  (r) => r.roomId === updatedRoom.roomId
                );

                if (existingIndex >= 0) {
                  // 既存のルームを更新
                  const updated = [...prevRooms];
                  updated[existingIndex] = {
                    ...updatedRoom,
                    roomType: updated[existingIndex].roomType || 'group' // roomTypeを保持
                  };
                  return updated;
                } else {
                  // 新しいルームを追加
                  const newRoom = {
                    ...updatedRoom,
                    roomType: 'group'
                  };
                  return [newRoom, ...prevRooms];
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
      if (roomSubscriptionRef.current) {
        roomSubscriptionRef.current.unsubscribe();
      }
    };
  }, [currentUser?.userId, setUserRooms]);
};