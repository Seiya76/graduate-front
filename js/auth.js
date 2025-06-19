import { UserManager } from "oidc-client-ts";

const cognitoAuthConfig = {
    authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_pXLzKGxxN",
    client_id: "7d12lvf8vpgk5p58mng699s1rl",
    redirect_uri: "https://main.d33st5a8bjhict.amplifyapp.com/",
    response_type: "code",
    scope: "email openid phone"
};

// create a UserManager instance
export const userManager = new UserManager({
    ...cognitoAuthConfig,
});

export async function signOutRedirect () {
    const clientId = "7d12lvf8vpgk5p58mng699s1rl";
    const logoutUri = "https://main.d33st5a8bjhict.amplifyapp.com/"; 
    const cognitoDomain = "https://us-east-1pxlzkgxxn.auth.us-east-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
};