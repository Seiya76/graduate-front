// hooks/useRoomSubscription.js
import { useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';
import { onRoomUpdate } from '../graphql/subscriptions';

const client = generateClient();

export const useRoomSubscription = (currentUser, setUserRooms) => {
  const roomSubscriptionRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.userId) return;

    try {
      roomSubscriptionRef.current = client
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
              setUserRooms((prevRooms) => {
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
      if (roomSubscriptionRef.current) {
        roomSubscriptionRef.current.unsubscribe();
      }
    };
  }, [currentUser?.userId, setUserRooms]);
};