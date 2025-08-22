/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createChatRoom = /* GraphQL */ `
  mutation CreateChatRoom($input: CreateChatRoomInput!) {
    createChatRoom(input: $input) {
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
export const updateChatRoom = /* GraphQL */ `
  mutation UpdateChatRoom($input: UpdateChatRoomInput!) {
    updateChatRoom(input: $input) {
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
export const deleteChatRoom = /* GraphQL */ `
  mutation DeleteChatRoom($input: DeleteChatRoomInput!) {
    deleteChatRoom(input: $input) {
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
export const updateUser = /* GraphQL */ `
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
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
export const updateUserStatus = /* GraphQL */ `
  mutation UpdateUserStatus($userId: String!, $status: String!) {
    updateUserStatus(userId: $userId, status: $status) {
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
export const createMessage = /* GraphQL */ `
  mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
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
export const updateMessage = /* GraphQL */ `
  mutation UpdateMessage($input: UpdateMessageInput!) {
    updateMessage(input: $input) {
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
export const deleteMessage = /* GraphQL */ `
  mutation DeleteMessage($input: DeleteMessageInput!) {
    deleteMessage(input: $input) {
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
