export const createGroupRoom = /* GraphQL */ `
  mutation CreateGroupRoom($input: CreateGroupRoomInput!) {
    createGroupRoom(input: $input) {
      roomId
      roomName
      createdBy
      createdAt
      lastMessageAt
      memberCount
      __typename
    }
  }
`;
export const createDirectRoom = /* GraphQL */ `
  mutation CreateDirectRoom($targetUserId: ID!, $createdBy: ID!) {
    createDirectRoom(targetUserId: $targetUserId, createdBy: $createdBy) {
      roomId
      roomName
      createdBy
      createdAt
      lastMessageAt
      memberCount
      __typename
    }
  }
`;
export const joinRoom = /* GraphQL */ `
  mutation JoinRoom($roomId: ID!, $userId: ID!) {
    joinRoom(roomId: $roomId, userId: $userId) {
      userId
      roomId
      joinedAt
      role
      __typename
    }
  }
`;
export const leaveRoom = /* GraphQL */ `
  mutation LeaveRoom($roomId: ID!, $userId: ID!) {
    leaveRoom(roomId: $roomId, userId: $userId) {
      roomId
      userId
      message
      __typename
    }
  }
`;
export const sendMessage = /* GraphQL */ `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      messageId
      roomId
      userId
      nickname
      content
      createdAt
      __typename
    }
  }
`;
