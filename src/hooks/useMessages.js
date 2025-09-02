import { useState } from 'react';

export const useMessages = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "システム",
      content: "チャットへようこそ！",
      time: "10:00",
      isOwn: false,
      avatar: "SY"
    },
    {
      id: 2,
      sender: "田中太郎",
      content: "おはようございます！今日もよろしくお願いします。",
      time: "10:15",
      isOwn: false,
      avatar: "TT"
    },
    {
      id: 3,
      sender: "佐藤花子",
      content: "プロジェクトの進捗はいかがでしょうか？",
      time: "10:30",
      isOwn: false,
      avatar: "SH"
    }
  ]);
  const [newMessage, setNewMessage] = useState("");

  const sendMessage = (currentUser, user) => {
    if (newMessage.trim()) {
      const displayName = currentUser?.nickname || user.profile.name || user.profile.email.split('@')[0];
      const message = {
        id: messages.length + 1,
        sender: displayName,
        content: newMessage,
        time: new Date().toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: true,
        avatar: displayName.substring(0, 2).toUpperCase()
      };
      setMessages([...messages, message]);
      setNewMessage("");
    }
  };

  const handleKeyPress = (e, currentUser, user) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(currentUser, user);
    }
  };
 
  return {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    handleKeyPress
  };
};