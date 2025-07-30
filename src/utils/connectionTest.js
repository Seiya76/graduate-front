// src/utils/connectionTest.js
import { generateClient } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import config from '../aws-exports';

// AppSync接続テスト用ユーティリティ
export const testAppSyncConnection = async () => {
  try {
    console.log('🔧 設定情報:', {
      endpoint: config.API.GraphQL.endpoint,
      region: config.API.GraphQL.region,
      authMode: config.API.GraphQL.defaultAuthMode,
      userPoolId: config.Auth?.userPoolId,
      clientId: config.Auth?.userPoolWebClientId
    });

    // Amplify設定
    Amplify.configure(config);
    console.log('✅ Amplify設定完了');

    // クライアント作成
    const client = generateClient({
      authMode: 'userPool'
    });
    console.log('✅ GraphQLクライアント作成完了');

    // 基本的な接続テスト（認証なし）
    try {
      const basicTest = await fetch(config.API.GraphQL.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: '{ __typename }'
        })
      });
      
      console.log('🌐 基本接続テスト:', {
        status: basicTest.status,
        statusText: basicTest.statusText,
        ok: basicTest.ok
      });
      
      if (basicTest.status === 401) {
        console.log('✅ 認証が必要（正常）- AppSync エンドポイント接続OK');
      } else if (basicTest.ok) {
        console.log('✅ AppSync エンドポイント接続OK');
      } else {
        console.log('❌ AppSync エンドポイント接続NG');
      }
    } catch (fetchError) {
      console.error('❌ 基本接続テストエラー:', fetchError);
    }

    return {
      success: true,
      client,
      config
    };

  } catch (error) {
    console.error('❌ AppSync設定エラー:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// OIDC認証情報でのテスト
export const testWithOIDCAuth = async (oidcUser) => {
  try {
    console.log('🔐 OIDC認証情報テスト:', {
      hasUser: !!oidcUser,
      hasIdToken: !!oidcUser?.id_token,
      hasAccessToken: !!oidcUser?.access_token,
      userId: oidcUser?.profile?.sub,
      email: oidcUser?.profile?.email
    });

    if (!oidcUser || !oidcUser.id_token) {
      throw new Error('OIDC認証情報が不完全');
    }

    // 認証付きクライアント作成
    const client = generateClient({
      authMode: 'userPool',
      authToken: oidcUser.id_token
    });

    console.log('✅ 認証付きクライアント作成完了');

    // 簡単なGraphQLテスト
    try {
      const testQuery = `query TestAuth { __typename }`;
      const result = await client.graphql({
        query: testQuery
      });
      
      console.log('✅ 認証付きGraphQLテスト成功:', result);
      return { success: true, client };
      
    } catch (gqlError) {
      console.error('❌ GraphQLテストエラー:', gqlError);
      
      // 詳細なエラー情報
      if (gqlError.errors) {
        console.error('GraphQL Errors:', gqlError.errors);
      }
      
      return { success: false, error: gqlError.message };
    }

  } catch (error) {
    console.error('❌ OIDC認証テストエラー:', error);
    return { success: false, error: error.message };
  }
};