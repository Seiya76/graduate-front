import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/api";
import { getUserRooms } from "../graphql/queries";

const client = generateClient();

export default function useUserRooms(currentUser) {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    if (!currentUser?.userId) return;

    const fetchRooms = async () => {
      try {
        const result = await client.graphql({
          query: getUserRooms,
          variables: { userId: currentUser.userId, limit: 50 },
          authMode: "apiKey",
        });
        setRooms(result.data.getUserRooms.items || []);
      } catch (err) {
        console.error("useUserRooms error:", err);
      }
    };

    fetchRooms();
  }, [currentUser]);

  return rooms;
}
