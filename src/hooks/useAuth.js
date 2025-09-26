// hooks/useAuth.js
import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getUser } from '../graphql/queries';

const client = generateClient();

const GET_USER_BY_EMAIL = `
  query GetUserByEmail($email: String!) {
    getUserByEmail(email: $email) {
      userId
      createdAt
      email
      emailVerified
      nickname
      __typename
    }
  }
`;

export const useCurrentUser = (oidcUser) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!oidcUser?.profile?.sub) {
        setIsLoading(false);
        return;
      }

      try {
        const oidcSub = oidcUser.profile.sub;
        const email = oidcUser.profile.email;

        // userIdで検索
        try {
          const result = await client.graphql({
            query: getUser,
            variables: { userId: oidcSub },
            authMode: "apiKey",
          });

          if (result.data.getUser) {
            setCurrentUser(result.data.getUser);
            setIsLoading(false);
            return;
          }
        } catch (userIdError) {
          console.log('User not found by userId, trying email...');
        }

        // emailで検索
        if (email) {
          try {
            const result = await client.graphql({
              query: GET_USER_BY_EMAIL,
              variables: { email: email },
              authMode: "apiKey",
            });

            if (result.data.getUserByEmail) {
              setCurrentUser(result.data.getUserByEmail);
              setIsLoading(false);
              return;
            }
          } catch (emailError) {
            console.log('User not found by email either');
          }
        }

        // フォールバック
        const fallbackUser = {
          userId: oidcSub,
          nickname: oidcUser.profile.name || 
                   oidcUser.profile.preferred_username || 
                   email?.split("@")[0],
          email: email,
        };
        setCurrentUser(fallbackUser);
      } catch (error) {
        console.error("Error fetching current user:", error);
        
        const fallbackUser = {
          userId: oidcUser.profile.sub,
          nickname: oidcUser.profile.name || 
                   oidcUser.profile.preferred_username || 
                   oidcUser.profile.email?.split("@")[0],
          email: oidcUser.profile.email,
        };
        setCurrentUser(fallbackUser);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentUser();
  }, [oidcUser]);

  return { currentUser, isLoading };
};