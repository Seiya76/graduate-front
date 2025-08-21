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
  authority: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_u9YhtfyWO",
  client_id: "20dt0bgfusmmb24dleam55nlnc",
  redirect_uri: "https://main.d3rgq9lalaa9gb.amplifyapp.com/",
  response_type: "code",
  scope: "email openid",
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
