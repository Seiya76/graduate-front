/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateMessage = /* GraphQL */ `
  subscription OnCreateMessage($channelId: ID!) {
    onCreateMessage(channelId: $channelId) {
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
