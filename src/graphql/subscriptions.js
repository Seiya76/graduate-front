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
