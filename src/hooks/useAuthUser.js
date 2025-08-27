import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/api";
import { getUser } from "../graphql/queries";

const client = generateClient();

export default function useAuthUser(user) {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!user?.profile?.sub) return;

      try {
        const result = await client.graphql({
          query: getUser,
          variables: { userId: user.profile.sub },
          authMode: "apiKey",
        });

        if (result.data.getUser) {
          setCurrentUser(result.data.getUser);
        } else {
          // DynamoDBに存在しない場合 → OIDC情報を利用
          setCurrentUser({
            userId: user.profile.sub,
            nickname: user.profile.name || user.profile.preferred_username,
            email: user.profile.email,
            status: "active",
          });
        }
      } catch (err) {
        console.error("useAuthUser error:", err);
        setCurrentUser({
          userId: user.profile.sub,
          nickname: user.profile.name || user.profile.preferred_username,
          email: user.profile.email,
          status: "active",
        });
      }
    };

    fetchUser();
  }, [user]);

  return currentUser;
}
