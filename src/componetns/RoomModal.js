import React, { useState } from 'react';
import { useUserSearch } from '../hooks/useUserSearch';

const RoomModal = ({ isOpen, onClose, onCreateGroup, currentUser }) => {
  const [roomName, setRoomName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { searchTerm, setSearchTerm, results, isSearching } = useUserSearch(currentUser);

  if (!isOpen) return null;

  const handleCreateRoom = async () => {
    if (!roomName.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const newRoom = await onCreateGroup(roomName, selectedUsers);
      if (newRoom) {
        resetModal();
        alert(`ルーム「${roomName}」を作成しました。（${newRoom.memberCount}人のメンバー）`);
      }
    } catch (error) {
      console.error("Error creating room:", error);
      let errorMessage = "ルーム作成でエラーが発生しました。";
      if (error.errors && error.errors.length > 0) {
        errorMessage += "\n" + error.errors.map(e => e.message).join("\n");
      }
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const resetModal = () => {
    setRoomName("");
    setSelectedUsers([]);
    setSearchTerm("");
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>新しいグループルームを作成</h3>
          <button onClick={resetModal} disabled={isLoading}>×</button>
        </div>

        <div className="modal-body">
          <input
            type="text"
            placeholder="ルーム名"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="room-name-input"
            disabled={isLoading}
          />

          <div className="user-search-section">
            <h4>メンバーを検索して追加:</h4>
            <div className="search-container">
              <input
                type="text"
                placeholder="名前またはメールアドレスで検索"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="user-search-input"
                disabled={isLoading}
              />
              {isSearching && <div className="search-loading">検索中...</div>}
            </div>

            {results.length > 0 && (
              <div className="search-results">
                <div className="search-results-header">
                  {results.length}件のユーザーが見つかりました
                </div>
                {results.map((user) => (
                  <div key={user.userId} className="search-result-item">
                    <div className="user-info">
                      <div className="user-avatar-small">
                        {(user.nickname || user.email).substring(0, 2).toUpperCase()}
                      </div>
                      <div className="user-details">
                        <div className="user-name">{user.nickname || user.email}</div>
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                    <button
                      className={`add-user-btn ${selectedUsers.includes(user.userId) ? "selected" : ""}`}
                      onClick={() => toggleUserSelection(user.userId)}
                      disabled={isLoading}
                    >
                      {selectedUsers.includes(user.userId) ? "✓ 選択済み" : "+ 追加"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchTerm && results.length === 0 && !isSearching && (
              <div className="no-results">
                「{searchTerm}」に該当するユーザーが見つかりませんでした
              </div>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <div className="selected-users-section">
              <h4>選択されたメンバー ({selectedUsers.length}人):</h4>
              <div className="selected-users-preview">
                <div className="member-count-preview">
                  総メンバー数: {selectedUsers.length + 1}人 (あなた + {selectedUsers.length}人)
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={resetModal}
            disabled={isLoading}
            className="cancel-btn"
          >
            キャンセル
          </button>
          <button
            onClick={handleCreateRoom}
            disabled={!roomName.trim() || isLoading}
            className="create-room-btn"
          >
            {isLoading ? (
              <>
                <span className="loading-spinner-small"></span>
                作成中...
              </>
            ) : (
              <>
                ルーム作成
                {selectedUsers.length > 0 && (
                  <span className="member-count-badge">
                    {selectedUsers.length + 1}人
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomModal;