/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getUser = /* GraphQL */ `
  query GetUser($userId: ID!) {
    getUser(userId: $userId) {
      userId
      username
      email
      displayName
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const getChannel = /* GraphQL */ `
  query GetChannel($channelId: ID!) {
    getChannel(channelId: $channelId) {
      channelId
      name
      description
      createdBy
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listMessages = /* GraphQL */ `
  query ListMessages($channelId: ID!, $limit: Int, $nextToken: String) {
    listMessages(channelId: $channelId, limit: $limit, nextToken: $nextToken) {
      items {
        channelId
        createdAt
        messageId
        userId
        content
        username
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getUserChannels = /* GraphQL */ `
  query GetUserChannels($userId: ID!) {
    getUserChannels(userId: $userId) {
      userId
      channelId
      joinedAt
      __typename
    }
  }
`;
