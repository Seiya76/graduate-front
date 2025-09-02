import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getUser } from '../graphql/queries';

const client = generateClient();

// getUserByEmailクエリが不足している場合は追加定義
const GET_USER_BY_EMAIL = `
  query GetUserByEmail($email: String!) {
    getUserByEmail(email: $email) {
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

export const useUser = (user) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const oidcSub = user.profile.sub;
        const email = user.profile.email;
        
        let result = null;
        
        // まずuserIdで検索を試す
        try {
          result = await client.graphql({
            query: getUser,
            variables: { userId: oidcSub },
            authMode: 'apiKey'
          });
          
          if (result.data.getUser) {
            setCurrentUser(result.data.getUser);
            return;
          }
        } catch (userIdError) {
          // ユーザーが見つからない場合は次のステップへ
        }
        
        // userIdで見つからない場合、emailで検索
        if (email) {
          try {
            result = await client.graphql({
              query: GET_USER_BY_EMAIL,
              variables: { email: email },
              authMode: 'apiKey'
            });
            
            if (result.data.getUserByEmail) {
              setCurrentUser(result.data.getUserByEmail);
              return;
            }
          } catch (emailError) {
            // emailでも見つからない場合は次のステップへ
          }
        }
        
        // DynamoDBにデータがない場合はOIDC情報をフォールバック
        const fallbackUser = {
          userId: oidcSub,
          nickname: user.profile.name || user.profile.preferred_username,
          email: email,
          status: 'active'
        };
        setCurrentUser(fallbackUser);
        
      } catch (error) {
        // エラーの場合もOIDC情報をフォールバック
        const fallbackUser = {
          userId: user.profile.sub,
          nickname: user.profile.name || user.profile.preferred_username,
          email: user.profile.email,
          status: 'active'
        };
        setCurrentUser(fallbackUser);
      }
    };

    if (user?.profile?.sub) {
      fetchCurrentUser();
    }
  }, [user]);

  return currentUser;
};