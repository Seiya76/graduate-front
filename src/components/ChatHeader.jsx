import React from 'react';

const ChatHeader = ({ 
  selectedSpace, 
  userRooms, 
  currentUser, 
  getDisplayName, 
  getDisplayAvatar 
}) => {
  
  const getRoomMemberCount = () => {
    if (selectedSpace === "ホーム") {
      return "チャットルームを選択してください";
    }
    
    const room = userRooms.find((r) => r.roomName === selectedSpace);
    return `${room?.memberCount || 0}人のメンバー`;
  };

  return (
    <div className="chat-header">
      <div className="chat-info">
        <h2 className="chat-title">{selectedSpace}</h2>
        <div className="chat-subtitle">
          {getRoomMemberCount()}
        </div>
      </div>
      <div className="chat-actions">
        {/* ユーザー情報表示 */}
        <div className="user-profile-display">
          <div className="user-avatar-display">{getDisplayAvatar()}</div>
          <div className="user-info-display">
            <div className="user-name-display">{getDisplayName()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;