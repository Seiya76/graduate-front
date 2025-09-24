import React from 'react';
import { useUserSearch } from '../hooks/useUserSearch';

const UserSearch = ({ onSelectUser, currentUser, directRooms }) => {
  const { searchTerm, setSearchTerm, results, clearSearch } = useUserSearch(currentUser, 500);

  // ユーザー選択時のハンドラー
  const handleUserSelect = async (user) => {
    await onSelectUser(user.userId);
    clearSearch();
  };

  // 既存のダイレクトルームのユーザーを除外
  const filteredResults = results.filter(user =>
    !directRooms.some(room => 
      room.roomName.includes(user.nickname || user.email)
    )
  );

  return (
    <div className="dm-search-section">
      <input
        type="text"
        placeholder="ユーザーを検索してDM開始"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="dm-search-input"
      />

      {/* 検索結果表示 */}
      {filteredResults.length > 0 && searchTerm && (
        <div className="dm-search-results">
          {filteredResults.map((user) => (
            <div
              key={user.userId}
              className="dm-search-result-item"
              onClick={() => handleUserSelect(user)}
            >
              <span className="nav-icon user-avatar">
                {(user.nickname || user.email).substring(0, 2).toUpperCase()}
              </span>
              <div className="dm-user-info">
                <span className="dm-user-name">{user.nickname || user.email}</span>
                <span className="dm-user-email">{user.email}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 検索結果なしの場合 */}
      {searchTerm && filteredResults.length === 0 && results.length === 0 && (
        <div className="dm-search-no-results">
          「{searchTerm}」に該当するユーザーが見つかりませんでした
        </div>
      )}
    </div>
  );
};

export default UserSearch;