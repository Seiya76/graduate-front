/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onRoomUpdate = /* GraphQL */ `
  subscription OnRoomUpdate($userId: ID!) {
    onRoomUpdate(userId: $userId) {
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
export const onNewMessage = /* GraphQL */ `
  subscription OnNewMessage($roomId: ID!) {
    onNewMessage(roomId: $roomId) {
      messageId
      roomId
      userId
      content
      messageType
      createdAt
      updatedAt
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
export const onMessageDeleted = /* GraphQL */ `
  subscription OnMessageDeleted($roomId: ID!) {
    onMessageDeleted(roomId: $roomId) {
      messageId
      success
      message
      __typename
    }
  }
`;
