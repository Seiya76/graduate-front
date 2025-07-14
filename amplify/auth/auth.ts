import { UserManager } from "oidc-client-ts";

const cognitoAuthConfig = {
    authority: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_u9YhtfyWO",
    client_id: "8pua3oe15pci4ci7m0misd8eu",
    redirect_uri: "https://main.d2ggyu4753li5n.amplifyapp.com/",
    response_type: "code",
    scope: "email openid phone"
};

// create a UserManager instance
export const userManager = new UserManager({
    ...cognitoAuthConfig,
});

export async function signOutRedirect () {
    const clientId = "8pua3oe15pci4ci7m0misd8eu";
    const logoutUri = "<logout uri>";
    const cognitoDomain = "https://ap-northeast-1u9yhtfywo.auth.ap-northeast-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
};