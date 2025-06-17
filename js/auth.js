// AWS Cognito認証クラス
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js';
import { Amplify } from 'aws-amplify';

class CognitoAuth {
    constructor() {
        this.userPool = null;
        this.currentUser = null;
        this.initializeAuth();
    }

    initializeAuth() {
        // Amplifyの設定から取得するか、環境変数から取得
        let poolData;
        
        try {
            // Amplifyの設定から取得を試行
            const amplifyConfig = Amplify.getConfig();
            if (amplifyConfig.Auth?.Cognito) {
                poolData = {
                    UserPoolId: amplifyConfig.Auth.Cognito.userPoolId,
                    ClientId: amplifyConfig.Auth.Cognito.userPoolClientId
                };
            }
        } catch (error) {
            console.log('Amplify config not available, using environment variables');
        }
        
        // Amplifyの設定が利用できない場合は環境変数を使用
        if (!poolData || !poolData.UserPoolId || !poolData.ClientId) {
            poolData = {
                UserPoolId: process.env.REACT_APP_USER_POOL_ID,
                ClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID
            };
        }
        
        // 環境変数の値をチェック
        if (!poolData.UserPoolId || !poolData.ClientId) {
            console.error('Cognito configuration is missing. Please check your environment variables or Amplify setup.');
            return;
        }
        
        this.userPool = new CognitoUserPool(poolData);
    }

    // サインアップ
    async signUp({ username, password, attributes }) {
        return new Promise((resolve, reject) => {
            if (!this.userPool) {
                reject(new Error('User pool not initialized'));
                return;
            }

            const attributeList = [];
            
            // 属性をCognitoAttribute形式に変換
            for (const key in attributes) {
                const attribute = new CognitoUserAttribute({
                    Name: key,
                    Value: attributes[key]
                });
                attributeList.push(attribute);
            }

            this.userPool.signUp(username, password, attributeList, null, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
    }

    // メール認証確認
    async confirmSignUp(username, confirmationCode) {
        return new Promise((resolve, reject) => {
            if (!this.userPool) {
                reject(new Error('User pool not initialized'));
                return;
            }

            const userData = {
                Username: username,
                Pool: this.userPool
            };
            
            const cognitoUser = new CognitoUser(userData);
            
            cognitoUser.confirmRegistration(confirmationCode, true, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
    }

    // サインイン
    async signIn(username, password) {
        return new Promise((resolve, reject) => {
            if (!this.userPool) {
                reject(new Error('User pool not initialized'));
                return;
            }

            const authenticationData = {
                Username: username,
                Password: password
            };
            
            const authenticationDetails = new AuthenticationDetails(authenticationData);
            
            const userData = {
                Username: username,
                Pool: this.userPool
            };
            
            const cognitoUser = new CognitoUser(userData);
            
            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (result) => {
                    this.currentUser = cognitoUser;
                    
                    // JWT トークンを取得
                    const accessToken = result.getAccessToken().getJwtToken();
                    const idToken = result.getIdToken().getJwtToken();
                    const refreshToken = result.getRefreshToken().getToken();
                    
                    // トークンをローカルストレージに保存
                    this.storeTokens({
                        accessToken,
                        idToken,
                        refreshToken
                    });
                    
                    // ユーザー属性を取得
                    this.getUserAttributes(cognitoUser).then(attributes => {
                        const userWithAttributes = {
                            cognitoUser,
                            attributes: this.parseAttributes(attributes),
                            tokens: { accessToken, idToken, refreshToken }
                        };
                        resolve(userWithAttributes);
                    }).catch(err => {
                        // 属性取得に失敗してもサインインは成功とする
                        resolve({
                            cognitoUser,
                            tokens: { accessToken, idToken, refreshToken }
                        });
                    });
                },
                onFailure: (err) => {
                    reject(err);
                },
                newPasswordRequired: (userAttributes, requiredAttributes) => {
                    // 初回ログイン時の新パスワード設定が必要な場合
                    const error = new Error('NEW_PASSWORD_REQUIRED');
                    error.userAttributes = userAttributes;
                    error.requiredAttributes = requiredAttributes;
                    error.cognitoUser = cognitoUser;
                    reject(error);
                }
            });
        });
    }

    // 新しいパスワードを設定（初回ログイン時）
    async completeNewPasswordChallenge(cognitoUser, newPassword, requiredAttributes = {}) {
        return new Promise((resolve, reject) => {
            cognitoUser.completeNewPasswordChallenge(newPassword, requiredAttributes, {
                onSuccess: (result) => {
                    this.currentUser = cognitoUser;
                    
                    // JWT トークンを取得
                    const accessToken = result.getAccessToken().getJwtToken();
                    const idToken = result.getIdToken().getJwtToken();
                    const refreshToken = result.getRefreshToken().getToken();
                    
                    // トークンをローカルストレージに保存
                    this.storeTokens({
                        accessToken,
                        idToken,
                        refreshToken
                    });
                    
                    resolve({
                        cognitoUser,
                        tokens: { accessToken, idToken, refreshToken }
                    });
                },
                onFailure: (err) => {
                    reject(err);
                }
            });
        });
    }

    // ユーザー属性を取得
    async getUserAttributes(cognitoUser) {
        return new Promise((resolve, reject) => {
            cognitoUser.getUserAttributes((err, attributes) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(attributes);
            });
        });
    }

    // 属性配列をオブジェクトに変換
    parseAttributes(attributes) {
        const parsed = {};
        attributes.forEach(attr => {
            parsed[attr.getName()] = attr.getValue();
        });
        return parsed;
    }

    // 現在のユーザーを取得
    async getCurrentUser() {
        return new Promise((resolve, reject) => {
            if (!this.userPool) {
                reject(new Error('User pool not initialized'));
                return;
            }

            const cognitoUser = this.userPool.getCurrentUser();
            
            if (cognitoUser != null) {
                cognitoUser.getSession((err, session) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (session.isValid()) {
                        this.currentUser = cognitoUser;
                        
                        // ユーザー属性を取得
                        this.getUserAttributes(cognitoUser).then(attributes => {
                            const userWithAttributes = {
                                cognitoUser,
                                attributes: this.parseAttributes(attributes),
                                session
                            };
                            resolve(userWithAttributes);
                        }).catch(err => {
                            resolve({
                                cognitoUser,
                                session
                            });
                        });
                    } else {
                        reject(new Error('Session is not valid'));
                    }
                });
            } else {
                reject(new Error('No current user'));
            }
        });
    }

    // 現在のセッションを取得
    async currentSession() {
        return new Promise((resolve, reject) => {
            if (!this.userPool) {
                reject(new Error('User pool not initialized'));
                return;
            }

            const cognitoUser = this.userPool.getCurrentUser();
            
            if (cognitoUser != null) {
                cognitoUser.getSession((err, session) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (session.isValid()) {
                        resolve(session);
                    } else {
                        reject(new Error('Session is not valid'));
                    }
                });
            } else {
                reject(new Error('No current user'));
            }
        });
    }

    // サインアウト
    async signOut() {
        return new Promise((resolve, reject) => {
            if (!this.userPool) {
                this.clearTokens();
                resolve();
                return;
            }

            const cognitoUser = this.userPool.getCurrentUser();
            
            if (cognitoUser != null) {
                cognitoUser.signOut(() => {
                    this.currentUser = null;
                    this.clearTokens();
                    resolve();
                });
            } else {
                this.clearTokens();
                resolve();
            }
        });
    }

    // グローバルサインアウト（すべてのデバイスからサインアウト）
    async globalSignOut() {
        return new Promise((resolve, reject) => {
            if (!this.currentUser) {
                reject(new Error('No authenticated user'));
                return;
            }
            
            this.currentUser.globalSignOut({
                onSuccess: () => {
                    this.currentUser = null;
                    this.clearTokens();
                    resolve();
                },
                onFailure: (err) => {
                    reject(err);
                }
            });
        });
    }

    // パスワードリセット要求
    async forgotPassword(username) {
        return new Promise((resolve, reject) => {
            if (!this.userPool) {
                reject(new Error('User pool not initialized'));
                return;
            }

            const userData = {
                Username: username,
                Pool: this.userPool
            };
            
            const cognitoUser = new CognitoUser(userData);
            
            cognitoUser.forgotPassword({
                onSuccess: (result) => {
                    resolve(result);
                },
                onFailure: (err) => {
                    reject(err);
                }
            });
        });
    }

    // パスワードリセット確認
    async confirmPassword(username, confirmationCode, newPassword) {
        return new Promise((resolve, reject) => {
            if (!this.userPool) {
                reject(new Error('User pool not initialized'));
                return;
            }

            const userData = {
                Username: username,
                Pool: this.userPool
            };
            
            const cognitoUser = new CognitoUser(userData);
            
            cognitoUser.confirmPassword(confirmationCode, newPassword, {
                onSuccess: () => {
                    resolve();
                },
                onFailure: (err) => {
                    reject(err);
                }
            });
        });
    }

    // パスワード変更
    async changePassword(oldPassword, newPassword) {
        return new Promise((resolve, reject) => {
            if (!this.currentUser) {
                reject(new Error('No authenticated user'));
                return;
            }
            
            this.currentUser.changePassword(oldPassword, newPassword, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
    }

    // ユーザー属性更新
    async updateUserAttributes(attributes) {
        return new Promise((resolve, reject) => {
            if (!this.currentUser) {
                reject(new Error('No authenticated user'));
                return;
            }
            
            const attributeList = [];
            for (const key in attributes) {
                const attribute = new CognitoUserAttribute({
                    Name: key,
                    Value: attributes[key]
                });
                attributeList.push(attribute);
            }
            
            this.currentUser.updateAttributes(attributeList, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
    }

    // ユーザー属性削除
    async deleteUserAttributes(attributeNames) {
        return new Promise((resolve, reject) => {
            if (!this.currentUser) {
                reject(new Error('No authenticated user'));
                return;
            }
            
            this.currentUser.deleteAttributes(attributeNames, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
    }

    // JWTトークンを取得
    async getIdToken() {
        const session = await this.currentSession();
        return session.getIdToken().getJwtToken();
    }

    async getAccessToken() {
        const session = await this.currentSession();
        return session.getAccessToken().getJwtToken();
    }

    async getRefreshToken() {
        const session = await this.currentSession();
        return session.getRefreshToken().getToken();
    }

    // トークンをローカルストレージに保存
    storeTokens(tokens) {
        try {
            localStorage.setItem('cognitoTokens', JSON.stringify(tokens));
        } catch (error) {
            console.warn('Failed to store tokens:', error);
        }
    }

    // トークンをローカルストレージから取得
    getStoredTokens() {
        try {
            const tokens = localStorage.getItem('cognitoTokens');
            return tokens ? JSON.parse(tokens) : null;
        } catch (error) {
            console.warn('Failed to get stored tokens:', error);
            return null;
        }
    }

    // トークンをローカルストレージからクリア
    clearTokens() {
        try {
            localStorage.removeItem('cognitoTokens');
        } catch (error) {
            console.warn('Failed to clear tokens:', error);
        }
    }

    // トークンの有効性をチェック
    async isTokenValid() {
        try {
            const session = await this.currentSession();
            return session.isValid();
        } catch (error) {
            return false;
        }
    }

    // セッションを更新
    async refreshSession() {
        return new Promise((resolve, reject) => {
            if (!this.userPool) {
                reject(new Error('User pool not initialized'));
                return;
            }

            const cognitoUser = this.userPool.getCurrentUser();
            
            if (cognitoUser != null) {
                cognitoUser.getSession((err, session) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (session.isValid()) {
                        // セッションの有効期限を更新
                        const accessToken = session.getAccessToken().getJwtToken();
                        const idToken = session.getIdToken().getJwtToken();
                        const refreshToken = session.getRefreshToken().getToken();
                        
                        this.storeTokens({
                            accessToken,
                            idToken,
                            refreshToken
                        });
                        
                        resolve(session);
                    } else {
                        // リフレッシュトークンを使用してセッションを更新
                        const refreshToken = session.getRefreshToken();
                        cognitoUser.refreshSession(refreshToken, (err, session) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            
                            // 新しいトークンを保存
                            const accessToken = session.getAccessToken().getJwtToken();
                            const idToken = session.getIdToken().getJwtToken();
                            const newRefreshToken = session.getRefreshToken().getToken();
                            
                            this.storeTokens({
                                accessToken,
                                idToken,
                                refreshToken: newRefreshToken
                            });
                            
                            resolve(session);
                        });
                    }
                });
            } else {
                reject(new Error('No current user'));
            }
        });
    }

    // ユーザーアカウント削除
    async deleteUser() {
        return new Promise((resolve, reject) => {
            if (!this.currentUser) {
                reject(new Error('No authenticated user'));
                return;
            }
            
            this.currentUser.deleteUser((err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                this.currentUser = null;
                this.clearTokens();
                resolve(result);
            });
        });
    }
}

// シングルトンインスタンスを作成してエクスポート
const auth = new CognitoAuth();
export default auth;