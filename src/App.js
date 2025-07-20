import React, { useState, useEffect } from "react";
import "./App.css";
import { useAuth } from "react-oidc-context";

// メインダッシュボードコンポーネント
const Dashboard = () => {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState('home');

  const signOutRedirect = () => {
    const clientId = "8pua3oe15pci4ci7m0misd8eu";
    const logoutUri = "https://main.d3rgq9lalaa9gb.amplifyapp.com/";
    const cognitoDomain =
      "https://ap-northeast-1u9yhtfywo.auth.ap-northeast-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
  };

  const dashboardStyle = {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 0',
    borderBottom: '2px solid #e0e0e0',
    marginBottom: '30px'
  };

  const navStyle = {
    display: 'flex',
    gap: '20px',
    marginBottom: '30px'
  };

  const tabStyle = (isActive) => ({
    padding: '10px 20px',
    backgroundColor: isActive ? '#007bff' : '#f8f9fa',
    color: isActive ? 'white' : '#333',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  });

  const cardStyle = {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginTop: '20px'
  };

  // タブコンテンツを表示する関数
  const renderTabContent = () => {
    switch(activeTab) {
      case 'home':
        return (
          <div>
            <h2>ダッシュボード</h2>
            <div style={gridStyle}>
              <div style={cardStyle}>
                <h3>📊 データ分析</h3>
                <p>最新のデータ分析結果を確認できます</p>
                <button style={{...tabStyle(false), marginTop: '10px'}}>
                  詳細を見る
                </button>
              </div>
              <div style={cardStyle}>
                <h3>📁 ファイル管理</h3>
                <p>AWS S3のファイルを管理します</p>
                <button style={{...tabStyle(false), marginTop: '10px'}}>
                  ファイルを開く
                </button>
              </div>
              <div style={cardStyle}>
                <h3>⚙️ 設定</h3>
                <p>アカウント設定とプロファイル管理</p>
                <button style={{...tabStyle(false), marginTop: '10px'}}>
                  設定を開く
                </button>
              </div>
            </div>
          </div>
        );
      case 'profile':
        return (
          <div>
            <h2>プロファイル</h2>
            <div style={cardStyle}>
              <h3>ユーザー情報</h3>
              <p><strong>メールアドレス:</strong> {auth.user?.profile.email}</p>
              <p><strong>ユーザー名:</strong> {auth.user?.profile.name || 'N/A'}</p>
              <p><strong>最終ログイン:</strong> {new Date().toLocaleString()}</p>
            </div>
            
            {/* 開発環境でのみデバッグ情報を表示 */}
            {process.env.NODE_ENV === 'development' && (
              <div style={cardStyle}>
                <details>
                  <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>
                    🔧 デバッグ情報（開発用）
                  </summary>
                  <div style={{marginTop: '10px', fontSize: '12px', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px'}}>
                    <p><strong>ID Token:</strong> {auth.user?.id_token ? '✅ 存在' : '❌ なし'}</p>
                    <p><strong>Access Token:</strong> {auth.user?.access_token ? '✅ 存在' : '❌ なし'}</p>
                    <p><strong>認証状態:</strong> {auth.isAuthenticated ? '✅ 認証済み' : '❌ 未認証'}</p>
                  </div>
                </details>
              </div>
            )}
          </div>
        );
      case 'services':
        return (
          <div>
            <h2>AWS サービス</h2>
            <div style={gridStyle}>
              <div style={cardStyle}>
                <h3>🗃️ Amazon S3</h3>
                <p>ファイルストレージとオブジェクト管理</p>
                <button style={{...tabStyle(false), marginTop: '10px'}}>
                  S3 コンソール
                </button>
              </div>
              <div style={cardStyle}>
                <h3>🗄️ DynamoDB</h3>
                <p>NoSQLデータベース管理</p>
                <button style={{...tabStyle(false), marginTop: '10px'}}>
                  データベース
                </button>
              </div>
              <div style={cardStyle}>
                <h3>⚡ Lambda</h3>
                <p>サーバーレス関数の実行</p>
                <button style={{...tabStyle(false), marginTop: '10px'}}>
                  関数一覧
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return <div>ページが見つかりません</div>;
    }
  };

  return (
    <div style={dashboardStyle}>
      {/* ヘッダー */}
      <header style={headerStyle}>
        <div>
          <h1 style={{margin: 0, color: '#333'}}>マイアプリケーション</h1>
          <p style={{margin: '5px 0 0 0', color: '#666'}}>
            ようこそ、{auth.user?.profile.email} さん
          </p>
        </div>
        <div>
          <button 
            onClick={() => signOutRedirect()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            サインアウト
          </button>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav style={navStyle}>
        <button 
          style={tabStyle(activeTab === 'home')}
          onClick={() => setActiveTab('home')}
        >
          🏠 ホーム
        </button>
        <button 
          style={tabStyle(activeTab === 'profile')}
          onClick={() => setActiveTab('profile')}
        >
          👤 プロファイル
        </button>
        <button 
          style={tabStyle(activeTab === 'services')}
          onClick={() => setActiveTab('services')}
        >
          ☁️ AWS サービス
        </button>
      </nav>

      {/* メインコンテンツ */}
      <main>
        {renderTabContent()}
      </main>
    </div>
  );
};

// ログイン画面コンポーネント
const LoginPage = () => {
  const auth = useAuth();

  const loginStyle = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: 'Arial, sans-serif'
  };

  const cardStyle = {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%'
  };

  const buttonStyle = {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    width: '100%',
    marginTop: '20px'
  };

  return (
    <div style={loginStyle}>
      <div style={cardStyle}>
        <h1 style={{color: '#333', marginBottom: '10px'}}>🔐 認証が必要です</h1>
        <p style={{color: '#666', marginBottom: '30px'}}>
          このアプリケーションを利用するには<br />
          AWS Cognitoでサインインしてください
        </p>
        <div style={{backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '5px', marginBottom: '20px'}}>
          <p style={{margin: 0, fontSize: '14px', color: '#1976d2'}}>
            ℹ️ セキュアな認証システムを使用しています
          </p>
        </div>
        <button 
          onClick={() => auth.signinRedirect()}
          style={buttonStyle}
          onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
        >
          AWS Cognito でサインイン
        </button>
      </div>
    </div>
  );
};

// ローディング画面コンポーネント
const LoadingPage = () => {
  const loadingStyle = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: 'Arial, sans-serif'
  };

  const spinnerStyle = {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  };

  return (
    <div style={loadingStyle}>
      <div style={spinnerStyle}></div>
      <p style={{color: '#666'}}>AWS Cognito 認証を確認中...</p>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

// エラー画面コンポーネント
const ErrorPage = ({ error }) => {
  const errorStyle = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
    padding: '20px'
  };

  const cardStyle = {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
    width: '100%',
    border: '1px solid #f5c6cb'
  };

  return (
    <div style={errorStyle}>
      <div style={cardStyle}>
        <h1 style={{color: '#721c24', marginBottom: '20px'}}>❌ 認証エラー</h1>
        <p style={{color: '#666', marginBottom: '20px'}}>
          AWS Cognito認証でエラーが発生しました
        </p>
        <div style={{backgroundColor: '#f8d7da', padding: '15px', borderRadius: '5px', marginBottom: '20px'}}>
          <p style={{margin: 0, fontSize: '14px', color: '#721c24'}}>
            {error.message}
          </p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔄 再試行
        </button>
      </div>
    </div>
  );
};

// メインAppコンポーネント
function App() {
  const auth = useAuth();

  // ローディング状態
  if (auth.isLoading) {
    return <LoadingPage />;
  }

  // エラー状態
  if (auth.error) {
    return <ErrorPage error={auth.error} />;
  }

  // 認証状態に応じて表示を切り替え
  return auth.isAuthenticated ? <Dashboard /> : <LoginPage />;
}

export default App;