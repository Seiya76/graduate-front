import React, { useState } from "react";
import { generateClient } from "aws-amplify/api";
import { createGroupRoom } from "../graphql/mutations";

const client = generateClient();

function RoomModal({ onClose, currentUser, setUserRooms }) {
  const [roomName, setRoomName] = useState("");

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    const result = await client.graphql({
      query: createGroupRoom,
      variables: { input: { roomName, createdBy: currentUser.userId, memberUserIds: [] } },
      authMode: "apiKey",
    });
    setUserRooms(prev => [result.data.createGroupRoom, ...prev]);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>新しいルームを作成</h3>
        <input
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="ルーム名"
        />
        <div className="modal-footer">
          <button onClick={onClose}>キャンセル</button>
          <button onClick={handleCreate} disabled={!roomName.trim()}>作成</button>
        </div>
      </div>
    </div>
  );
}

export default RoomModal;
