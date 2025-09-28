import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getUserRooms } from '../graphql/queries';

const client = generateClient();

const RoomsDebugTest = ({ currentUser }) => {
  const [testResult, setTestResult] = useState(null);
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [testingAuth, setTestingAuth] = useState(false);

  const testDirectAPI = async () => {
    if (!currentUser?.userId) {
      setTestResult("❌ currentUser.userId が見つかりません");
      return;
    }

    setIsTestingAPI(true);
    try {
      console.log("🧪 Testing direct API call for user:", currentUser.userId);
      
      const result = await client.graphql({
        query: getUserRooms,
        variables: {
          userId: currentUser.userId,
          limit: 10,
        },
        authMode: "apiKey",
      });

      console.log("🧪 Direct API test result:", result);
      
      if (result.data?.getUserRooms?.items) {
        setTestResult(`✅ API成功: ${result.data.getUserRooms.items.length}個のルームを取得`);
      } else {
        setTestResult("⚠️ API成功だがデータなし: " + JSON.stringify(result.data));
      }
    } catch (error) {
      console.error("🧪 Direct API test error:", error);
      setTestResult(`❌ API エラー: ${error.message}`);
    } finally {
      setIsTestingAPI(false);
    }
  };

  const testAuthMode = async () => {
    if (!currentUser?.userId) {
      setTestResult("❌ currentUser.userId が見つかりません");
      return;
    }

    setTestingAuth(true);
    const authModes = ["apiKey", "userPool", "iam"];
    const results = [];

    for (const authMode of authModes) {
      try {
        console.log(`🧪 Testing auth mode: ${authMode}`);
        
        const result = await client.graphql({
          query: getUserRooms,
          variables: {
            userId: currentUser.userId,
            limit: 5,
          },
          authMode: authMode,
        });

        if (result.data?.getUserRooms?.items) {
          results.push(`✅ ${authMode}: ${result.data.getUserRooms.items.length}個`);
        } else {
          results.push(`⚠️ ${authMode}: データなし`);
        }
      } catch (error) {
        results.push(`❌ ${authMode}: ${error.message}`);
      }
    }

    setTestResult("認証モードテスト結果:\n" + results.join("\n"));
    setTestingAuth(false);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      background: 'white',
      border: '2px solid #007bff',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999,
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h4 style={{margin: '0 0 8px 0', color: '#007bff'}}>🔍 ルーム取得デバッグ</h4>
      
      <div style={{marginBottom: '8px'}}>
        <strong>現在のユーザー:</strong><br/>
        {currentUser ? (
          <>
            ID: {currentUser.userId}<br/>
            Email: {currentUser.email}<br/>
            Nickname: {currentUser.nickname || 'なし'}
          </>
        ) : (
          <span style={{color: 'red'}}>未ログイン</span>
        )}
      </div>

      <div style={{marginBottom: '8px'}}>
        <button 
          onClick={testDirectAPI}
          disabled={isTestingAPI || !currentUser}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            marginRight: '4px',
            cursor: 'pointer'
          }}
        >
          {isTestingAPI ? '測定中...' : 'API直接テスト'}
        </button>

        <button 
          onClick={testAuthMode}
          disabled={testingAuth || !currentUser}
          style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          {testingAuth ? '測定中...' : '認証モードテスト'}
        </button>
      </div>

      {testResult && (
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          padding: '6px',
          fontSize: '10px',
          whiteSpace: 'pre-line',
          maxHeight: '100px',
          overflow: 'auto'
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
};

export default RoomsDebugTest;