/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createUser = /* GraphQL */ `
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
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
export const createChannel = /* GraphQL */ `
  mutation CreateChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
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
export const createMessage = /* GraphQL */ `
  mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
      channelId
      createdAt
      messageId
      userId
      content
      username
      __typename
    }
  }
`;
export const joinChannel = /* GraphQL */ `
  mutation JoinChannel($channelId: ID!) {
    joinChannel(channelId: $channelId) {
      userId
      channelId
      joinedAt
      __typename
    }
  }
`;
