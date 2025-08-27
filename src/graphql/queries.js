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
