// AWS Cognito認証クラス
class Auth {
    constructor() {
        this.userPool = null;
        this.currentUser = null;
        this.initializeAuth();
    }

    initializeAuth() {
        // Cognito User Poolの設定
        const poolData = {
            UserPoolId: 'your-user-pool-id', // 実際のUser Pool IDに置き換え
            ClientId: 'your-client-id' // 実際のClient IDに置き換え
        };
        
        this.userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    }

    // サインアップ
    async signUp({ username, password, attributes }) {
        return new Promise((resolve, reject) => {
            const attributeList = [];
            
            // 属性をCognitoAttribute形式に変換
            for (const key in attributes) {
                const attribute = new AmazonCognitoIdentity.CognitoUserAttribute({
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
            const userData = {
                Username: username,
                Pool: this.userPool
            };
            
            const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
            
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
            const authenticationData = {
                Username: username,
                Password: password
            };
            
            const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
            
            const userData = {
                Username: username,
                Pool: this.userPool
            };
            
            const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
            
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
                            ...cognitoUser,
                            attributes: this.parseAttributes(attributes)
                        };
                        resolve(userWithAttributes);
                    }).catch(err => {
                        // 属性取得に失敗してもサインインは成功とする
                        resolve(cognitoUser);
                    });
                },
                onFailure: (err) => {
                    reject(err);
                },
                newPasswordRequired: (userAttributes, requiredAttributes) => {
                    // 初回ログイン時の新パスワード設定が必要な場合
                    reject(new Error('NEW_PASSWORD_REQUIRED'));
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

    // 属性配列を オブジェクトに変換
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
                                ...cognitoUser,
                                attributes: this.parseAttributes(attributes)
                            };
                            resolve(userWithAttributes);
                        }).catch(err => {
                            resolve(cognitoUser);
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

    // パスワードリセット要求
    async forgotPassword(username) {
        return new Promise((resolve, reject) => {
            const userData = {
                Username: username,
                Pool: this.userPool
            };
            
            const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
            
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
            const userData = {
                Username: username,
                Pool: this.userPool
            };
            
            const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
            
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
                const attribute = new AmazonCognitoIdentity.CognitoUserAttribute({
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

    // JWTトークンを取得
    async getIdToken() {
        const session = await this.currentSession();
        return session.getIdToken().getJwtToken();
    }

    async getAccessToken() {
        const session = await this.currentSession();
        return session.getAccessToken().getJwtToken();
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
                        // リフレッシュトークンを使用してセッションを更新
                        const refreshToken = session.getRefreshToken();
                        cognitoUser.refreshSession(refreshToken, (err, session) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve(session);
                        });
                    }
                });
            } else {
                reject(new Error('No current user'));
            }
        });
    }
}

// グローバルインスタンスを作成
const Auth = new Auth();