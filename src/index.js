import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from 'react-oidc-context';//cognito認証(OIDC)をインポート
import { Amplify }from 'aws-amplify';
import config from './aws-exports'; //Appsync用のConfigをインポート

Amplify.configure(config);

const cognitoAuthConfig = {
  authority: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_ncffAodBj",
  client_id: "5buno8gs9brj93apmu9tvqqp77",
  redirect_uri: "https://main.d3rgq9lalaa9gb.amplifyapp.com",
  post_logout_redirect_uri: "https://main.d3rgq9lalaa9gb.amplifyapp.com",
  response_type: "code",
  scope: "openid email",
  storage: window.localStorage, 
};

const root = ReactDOM.createRoot(document.getElementById('root'));
//AuthProviderで囲んで、cognito連携
root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);