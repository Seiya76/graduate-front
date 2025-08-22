/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getChatRoom = /* GraphQL */ `
  query GetChatRoom($id: ID!) {
    getChatRoom(id: $id) {
      id
      nickname
      description
      createdBy
      memberCount
      isPrivate
      __typename
    }
  }
`;
export const listChatRooms = /* GraphQL */ `
  query ListChatRooms(
    $filter: TableChatRoomFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listChatRooms(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        nickname
        description
        createdBy
        memberCount
        isPrivate
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getUser = /* GraphQL */ `
  query GetUser($userId: String!) {
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
export const listOnlineUsers = /* GraphQL */ `
  query ListOnlineUsers {
    listOnlineUsers {
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
export const getMessage = /* GraphQL */ `
  query GetMessage($chatRoomId: String!, $createdAt: AWSDateTime!) {
    getMessage(chatRoomId: $chatRoomId, createdAt: $createdAt) {
      id
      chatRoomId
      userId
      content
      userNickname
      replyToMessageId
      createdAt
      __typename
    }
  }
`;
export const listMessages = /* GraphQL */ `
  query ListMessages(
    $filter: TableMessageFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listMessages(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        chatRoomId
        userId
        content
        userNickname
        replyToMessageId
        createdAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
