// components/CreateRoomModal.jsx
import React from 'react';

const CreateRoomModal = ({
  isOpen,
  onClose,
  newRoomName,
  setNewRoomName,
  modalSearchTerm,
  setModalSearchTerm,
  modalSearchResults,
  isModalSearching,
  selectedUsers,
  toggleUserSelection,
  onCreateRoom,
  isRoomCreationLoading
}) => {
  
  if (!isOpen) return null;

  const handleCreateRoom = () => {
    onCreateRoom(newRoomName, selectedUsers);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>新しいグループルームを作成</h3>
          <button onClick={onClose} disabled={isRoomCreationLoading}>
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <input
            type="text"
            placeholder="ルーム名"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            className="room-name-input"
            disabled={isRoomCreationLoading}
          />

          <div className="user-search-section">
            <h4>メンバーを検索して追加:</h4>
            <div className="search-container">
              <input
                type="text"
                placeholder="名前またはメールアドレスで検索"
                value={modalSearchTerm}
                onChange={(e) => setModalSearchTerm(e.target.value)}
                className="user-search-input"
                disabled={isRoomCreationLoading}
              />
              {isModalSearching && (
                <div className="search-loading">検索中...</div>
              )}
            </div>

            {modalSearchResults.length > 0 && (
              <div className="search-results">
                <div className="search-results-header">
                  {modalSearchResults.length}件のユーザーが見つかりました
                </div>
                {modalSearchResults.map((user) => (
                  <div key={user.userId} className="search-result-item">
                    <div className="user-info">
                      <div className="user-avatar-small">
                        {(user.nickname || user.email)
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="user-details">
                        <div className="user-name">
                          {user.nickname || user.email}
                        </div>
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                    <button
                      className={`add-user-btn ${
                        selectedUsers.includes(user.userId)
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => toggleUserSelection(user.userId)}
                      disabled={isRoomCreationLoading}
                    >
                      {selectedUsers.includes(user.userId)
                        ? "✓ 選択済み"
                        : "+ 追加"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {modalSearchTerm &&
              modalSearchResults.length === 0 &&
              !isModalSearching && (
                <div className="no-results">
                  「{modalSearchTerm}」に該当するユーザーが見つかりませんでした
                </div>
              )}
          </div>

          {selectedUsers.length > 0 && (
            <div className="selected-users-section">
              <h4>選択されたメンバー ({selectedUsers.length}人):</h4>
              <div className="selected-users-preview">
                <div className="member-count-preview">
                  総メンバー数: {selectedUsers.length + 1}人 (あなた +{" "}
                  {selectedUsers.length}人)
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            disabled={isRoomCreationLoading}
            className="cancel-btn"
          >
            キャンセル
          </button>
          <button
            onClick={handleCreateRoom}
            disabled={!newRoomName.trim() || isRoomCreationLoading}
            className="create-room-btn"
          >
            {isRoomCreationLoading ? (
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

export default CreateRoomModal;