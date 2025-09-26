export const onMessageSent = /* GraphQL */ `
  subscription OnMessageSent($roomId: ID!) {
    onMessageSent(roomId: $roomId) {
      messageId
      roomId
      userId
      nickname
      content
      createdAt
    }
  }
`;

export const onRoomUpdate = /* GraphQL */ `
  subscription OnRoomUpdate($userId: ID!) {
    onRoomUpdate(userId: $userId) {
      roomId
      roomName
      createdBy
      createdAt
      lastMessageAt
      memberCount
    }
  }
`;

export const onUserTyping = `
  subscription OnUserTyping($roomId: String!) {
    onUserTyping(roomId: $roomId) {
      roomId
      userId
      nickname
      isTyping
    }
  }
`;

