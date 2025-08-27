import React from "react";

function UserProfile({ currentUser }) {
  if (!currentUser) return null;
  const displayName = currentUser.nickname || currentUser.email;
  return (
    <div className="user-profile-display">
      <div className="user-avatar-display">{displayName.substring(0, 2).toUpperCase()}</div>
      <div className="user-info-display">
        <div className="user-name-display">{displayName}</div>
        <div className="user-status-display">{currentUser.status || "active"}</div>
      </div>
    </div>
  );
}

export default UserProfile;
