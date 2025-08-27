import React from "react";
import { useAuth } from "react-oidc-context";
import logo from "./logo.svg";
import "./App.css";
import ChatScreen from "./components/ChatScreen";

function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = "5buno8gs9brj93apmu9tvqqp77";
    const logoutUri = "https://main.d3rgq9lalaa9gb.amplifyapp.com";
    const cognitoDomain = "https://ap-northeast-1ncffaodbj.auth.ap-northeast-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) {
    return <div className="loading-screen">読み込み中...</div>;
  }

  if (auth.error) {
    return <div className="error-screen">エラー: {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    return <ChatScreen user={auth.user} onSignOut={signOutRedirect} />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h1>G00gleChat</h1>
        <div className="auth-buttons">
          <button onClick={() => auth.signinRedirect()} className="signin-btn">
            サインイン
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;
