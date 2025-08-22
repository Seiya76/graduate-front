/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateChatRoom = /* GraphQL */ `
  subscription OnCreateChatRoom(
    $id: ID
    $nickname: String
    $description: String
    $createdBy: String
    $memberCount: Int
  ) {
    onCreateChatRoom(
      id: $id
      nickname: $nickname
      description: $description
      createdBy: $createdBy
      memberCount: $memberCount
    ) {
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
export const onUpdateChatRoom = /* GraphQL */ `
  subscription OnUpdateChatRoom(
    $id: ID
    $nickname: String
    $description: String
    $createdBy: String
    $memberCount: Int
  ) {
    onUpdateChatRoom(
      id: $id
      nickname: $nickname
      description: $description
      createdBy: $createdBy
      memberCount: $memberCount
    ) {
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
export const onDeleteChatRoom = /* GraphQL */ `
  subscription OnDeleteChatRoom(
    $id: ID
    $nickname: String
    $description: String
    $createdBy: String
    $memberCount: Int
  ) {
    onDeleteChatRoom(
      id: $id
      nickname: $nickname
      description: $description
      createdBy: $createdBy
      memberCount: $memberCount
    ) {
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
export const onUserStatusChanged = /* GraphQL */ `
  subscription OnUserStatusChanged {
    onUserStatusChanged {
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
export const onCreateMessage = /* GraphQL */ `
  subscription OnCreateMessage(
    $id: ID
    $chatRoomId: String
    $userId: String
    $content: String
    $userNickname: String
  ) {
    onCreateMessage(
      id: $id
      chatRoomId: $chatRoomId
      userId: $userId
      content: $content
      userNickname: $userNickname
    ) {
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
export const onUpdateMessage = /* GraphQL */ `
  subscription OnUpdateMessage(
    $id: ID
    $chatRoomId: String
    $userId: String
    $content: String
    $userNickname: String
  ) {
    onUpdateMessage(
      id: $id
      chatRoomId: $chatRoomId
      userId: $userId
      content: $content
      userNickname: $userNickname
    ) {
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
export const onDeleteMessage = /* GraphQL */ `
  subscription OnDeleteMessage(
    $id: ID
    $chatRoomId: String
    $userId: String
    $content: String
    $userNickname: String
  ) {
    onDeleteMessage(
      id: $id
      chatRoomId: $chatRoomId
      userId: $userId
      content: $content
      userNickname: $userNickname
    ) {
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
