/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createGroupRoom = /* GraphQL */ `
  mutation CreateGroupRoom($input: CreateGroupRoomInput!) {
    createGroupRoom(input: $input) {
      roomId
      roomName
      roomType
      createdBy
      createdAt
      lastMessage
      lastMessageAt
      memberCount
      updatedAt
      __typename
    }
  }
`;
export const createDirectRoom = /* GraphQL */ `
  mutation CreateDirectRoom($targetUserId: ID!, $createdBy: ID!) {
    createDirectRoom(targetUserId: $targetUserId, createdBy: $createdBy) {
      roomId
      roomName
      roomType
      createdBy
      createdAt
      lastMessage
      lastMessageAt
      memberCount
      updatedAt
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
      content
      messageType
      createdAt
      updatedAt
      isDeleted
      editedAt
      user {
        userId
        createdAt
        email
        emailVerified
        nickname
        status
        updatedAt
        __typename
      }
      __typename
    }
  }
`;
