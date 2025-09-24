import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getUser } from '../graphql/queries';

const client = generateClient();

// getUserByEmailクエリ
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

export const useCurrentUser = (user) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const oidcSub = user.profile.sub;
        const email = user.profile.email;
        let result = null;

        // まずuserIdで検索
        try {
          result = await client.graphql({
            query: getUser,
            variables: { userId: oidcSub },
            authMode: "apiKey",
          });

          if (result.data.getUser) {
            setCurrentUser(result.data.getUser);
            return;
          }
        } catch (userIdError) {
          // userIdで見つからない場合の処理
        }

        // emailで検索
        if (email) {
          try {
            result = await client.graphql({
              query: GET_USER_BY_EMAIL,
              variables: { email: email },
              authMode: "apiKey",
            });

            if (result.data.getUserByEmail) {
              setCurrentUser(result.data.getUserByEmail);
              return;
            }
          } catch (emailError) {
            // emailでも見つからない場合の処理
          }
        }

        // フォールバック
        const fallbackUser = {
          userId: oidcSub,
          nickname: user.profile.name || user.profile.preferred_username || email?.split("@")[0],
          email: email,
          status: "active",
        };
        setCurrentUser(fallbackUser);
      } catch (error) {
        console.error("Error fetching current user:", error);
        
        const fallbackUser = {
          userId: user.profile.sub,
          nickname: user.profile.name || user.profile.preferred_username || user.profile.email?.split("@")[0],
          email: user.profile.email,
          status: "active",
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