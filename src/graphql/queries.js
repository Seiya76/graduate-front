/* eslint-disable */
// this is an auto generated file. This will be overwritten

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
