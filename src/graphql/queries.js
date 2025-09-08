/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getUserRooms = /* GraphQL */ `
  query GetUserRooms($userId: ID!, $limit: Int, $nextToken: String) {
    getUserRooms(userId: $userId, limit: $limit, nextToken: $nextToken) {
      items {
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
      nextToken
      __typename
    }
  }
`;
export const getRoom = /* GraphQL */ `
  query GetRoom($roomId: ID!) {
    getRoom(roomId: $roomId) {
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
export const getCurrentUser = /* GraphQL */ `
  query GetCurrentUser {
    getCurrentUser {
      userId
      createdAt
      email
      emailVerified
      nickname
      status
      updatedAt
      __typename
    }
  }
`;
export const getUser = /* GraphQL */ `
  query GetUser($userId: ID!) {
    getUser(userId: $userId) {
      userId
      createdAt
      email
      emailVerified
      nickname
      status
      updatedAt
      __typename
    }
  }
`;
export const searchUsers = /* GraphQL */ `
  query SearchUsers($searchTerm: String!, $limit: Int) {
    searchUsers(searchTerm: $searchTerm, limit: $limit) {
      items {
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
export const getRoomMessages = /* GraphQL */ `
  query GetRoomMessages(
    $roomId: ID!
    $limit: Int
    $nextToken: String
    $sortDirection: String
  ) {
    getRoomMessages(
      roomId: $roomId
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        messageId
        roomId
        userId
        content
        messageType
        createdAt
        updatedAt
        __typename
      }
      nextToken
      hasMore
      __typename
    }
  }
`;
export const getMessage = /* GraphQL */ `
  query GetMessage($messageId: ID!) {
    getMessage(messageId: $messageId) {
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
export const getUserMessages = /* GraphQL */ `
  query GetUserMessages(
    $userId: ID!
    $limit: Int
    $nextToken: String
    $sortDirection: String
  ) {
    getUserMessages(
      userId: $userId
      limit: $limit
      nextToken: $nextToken
      sortDirection: $sortDirection
    ) {
      items {
        messageId
        roomId
        userId
        content
        messageType
        createdAt
        updatedAt
        __typename
      }
      nextToken
      hasMore
      __typename
    }
  }
`;
