// ユーザー関連のユーティリティ関数

// 表示名の取得
export const getDisplayName = (currentUser, user) => {
  return currentUser?.nickname || user.profile.name || user.profile.email.split('@')[0];
};

// アバター文字の取得
export const getDisplayAvatar = (currentUser, user) => {
  const name = getDisplayName(currentUser, user);
  return name.substring(0, 2).toUpperCase();
};

// 時間フォーマット関数
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return '昨日';
  } else {
    return `${diffDays}日前`;
  }
};