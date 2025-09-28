/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onRoomUpdate = /* GraphQL */ `
  subscription OnRoomUpdate($userId: ID!) {
    onRoomUpdate(userId: $userId) {
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
export const onMessageSent = /* GraphQL */ `
  subscription OnMessageSent($roomId: ID!) {
    onMessageSent(roomId: $roomId) {
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
