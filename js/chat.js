// チャット機能クラス
class Chat {
    constructor() {
        this.appsync = null;
        this.subscriptions = new Map();
        this.messageCache = new Map();
        this.typingUsers = new Set();
        this.isOnline = navigator.onLine;
        
        this.initializeChat();
        this.setupConnectionListeners();
    }

    initializeChat() {
        // AppSyncクライアントの初期化
        this.setupAppSyncClient();
    }

    async setupAppSyncClient() {
        // AppSync設定（実際の設定値に置き換えてください）
        this.appsyncConfig = {
            url: 'your-appsync-endpoint',
            region: 'ap-northeast-1',
            auth: {
                type: 'AMAZON_COGNITO_USER_POOLS',
                jwtToken: null
            }
        };
    }

    // GraphQL リクエストを送信
    async graphqlRequest(query, variables = {}) {
        try {
            // JWTトークンを取得
            const token = await Auth.getIdToken();
            
            const response = await fetch(this.appsyncConfig.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({
                    query,
                    variables
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.errors) {
                throw new Error(result.errors[0].message);
            }
            
            return result;
        } catch (error) {
            console.error('GraphQL request failed:', error);
            throw error;
        }
    }

    // ルーム作成
    async createRoom(roomData) {
        const mutation = `
            mutation CreateRoom($input: CreateRoomInput!) {
                createRoom(input: $input) {
                    id
                    name
                    roomType
                    description
                    createdBy
                    createdAt
                    updatedAt
                }
            }
        `;

        const variables = {
            input: {
                name: roomData.name,
                roomType: roomData.roomType || 'GROUP',
                description: roomData.description || '',
                createdBy: roomData.createdBy,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };

        return await this.graphqlRequest(mutation, variables);
    }

    // ルーム一覧取得
    async getUserRooms(userId) {
        const query = `
            query GetUserRooms($userId: ID!) {
                roomMembersByUser(userId: $userId) {
                    items {
                        room {
                            id
                            name
                            roomType
                            description
                            createdBy
                            createdAt
                            updatedAt
                            members {
                                items {
                                    user {
                                        id
                                        username
                                        email
                                        avatar
                                    }
                                    role
                                    joinedAt
                                }
                            }
                            lastMessage {
                                id
                                content
                                messageType
                                createdAt
                                user {
                                    username
                                }
                            }
                        }
                    }
                }
            }
        `;

        return await this.graphqlRequest(query, { userId });
    }

    // ルームメンバー追加
    async addRoomMember(roomId, userId, role = 'MEMBER') {
        const mutation = `
            mutation CreateRoomMember($input: CreateRoomMemberInput!) {
                createRoomMember(input: $input) {
                    id
                    roomId
                    userId
                    role
                    joinedAt
                    user {
                        id
                        username
                        email
                        avatar
                    }
                }
            }
        `;

        const variables = {
            input: {
                roomId,
                userId,
                role,
                joinedAt: new Date().toISOString()
            }
        };

        return await this.graphqlRequest(mutation, variables);
    }

    // ルームメンバー削除
    async removeRoomMember(roomId, userId) {
        const mutation = `
            mutation DeleteRoomMember($roomId: ID!, $userId: ID!) {
                deleteRoomMember(roomId: $roomId, userId: $userId) {
                    id
                }
            }
        `;

        return await this.graphqlRequest(mutation, { roomId, userId });
    }

    // メッセージ送信
    async sendMessage(messageData) {
        const mutation = `
            mutation CreateMessage($input: CreateMessageInput!) {
                createMessage(input: $input) {
                    id
                    roomId
                    userId
                    content
                    messageType
                    attachments
                    replyTo
                    createdAt
                    updatedAt
                    user {
                        id
                        username
                        avatar
                    }
                }
            }
        `;

        const variables = {
            input: {
                roomId: messageData.roomId,
                userId: messageData.userId,
                content: messageData.content,
                messageType: messageData.messageType || 'TEXT',
                attachments: messageData.attachments || [],
                replyTo: messageData.replyTo || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };

        const result = await this.graphqlRequest(mutation, variables);
        
        // キャッシュに追加
        const message = result.data.createMessage;
        this.addMessageToCache(message.roomId, message);
        
        return result;
    }

    // メッセージ一覧取得
    async getMessages(roomId, limit = 50, nextToken = null) {
        const query = `
            query ListMessages($roomId: ID!, $limit: Int, $nextToken: String) {
                messagesByRoom(
                    roomId: $roomId
                    sortDirection: DESC
                    limit: $limit
                    nextToken: $nextToken
                ) {
                    items {
                        id
                        roomId
                        userId
                        content
                        messageType
                        attachments
                        replyTo
                        createdAt
                        updatedAt
                        user {
                            id
                            username
                            avatar
                        }
                        replyToMessage {
                            id
                            content
                            user {
                                username
                            }
                        }
                    }
                    nextToken
                }
            }
        `;

        const result = await this.graphqlRequest(query, {
            roomId,
            limit,
            nextToken
        });

        // キャッシュに追加
        const messages = result.data.messagesByRoom.items.reverse();
        this.setMessagesCache(roomId, messages);

        return result;
    }

    // メッセージ更新
    async updateMessage(messageId, content) {
        const mutation = `
            mutation UpdateMessage($input: UpdateMessageInput!) {
                updateMessage(input: $input) {
                    id
                    content
                    updatedAt
                    edited
                }
            }
        `;

        const variables = {
            input: {
                id: messageId,
                content,
                edited: true,
                updatedAt: new Date().toISOString()
            }
        };

        return await this.graphqlRequest(mutation, variables);
    }

    // メッセージ削除
    async deleteMessage(messageId) {
        const mutation = `
            mutation DeleteMessage($input: DeleteMessageInput!) {
                deleteMessage(input: $input) {
                    id
                }
            }
        `;

        return await this.graphqlRequest(mutation, {
            input: { id: messageId }
        });
    }

    // ファイルアップロード
    async uploadFile(file, roomId) {
        try {
            // S3にファイルをアップロード
            const fileKey = `chat-files/${roomId}/${Date.now()}-${file.name}`;
            
            // Pre-signed URLを取得してアップロード
            const uploadUrl = await this.getUploadUrl(fileKey, file.type);
            
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type
                }
            });

            if (!uploadResponse.ok) {
                throw new Error('File upload failed');
            }

            return {
                key: fileKey,
                url: this.getFileUrl(fileKey),
                type: file.type,
                size: file.size
            };
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }

    // アップロード用URL取得
    async getUploadUrl(fileKey, contentType) {
        const mutation = `
            mutation GetUploadUrl($fileKey: String!, $contentType: String!) {
                getUploadUrl(fileKey: $fileKey, contentType: $contentType) {
                    uploadUrl
                }
            }
        `;

        const result = await this.graphqlRequest(mutation, {
            fileKey,
            contentType
        });

        return result.data.getUploadUrl.uploadUrl;
    }

    // ファイルURL取得
    getFileUrl(fileKey) {
        return `https://your-bucket.s3.ap-northeast-1.amazonaws.com/${fileKey}`;
    }

    // リアルタイム購読 - 新しいメッセージ
    subscribeToMessages(roomId, callback) {
        const subscription = `
            subscription OnCreateMessage($roomId: ID!) {
                onCreateMessage(roomId: $roomId) {
                    id
                    roomId
                    userId
                    content
                    messageType
                    attachments
                    replyTo
                    createdAt
                    user {
                        id
                        username
                        avatar
                    }
                    replyToMessage {
                        id
                        content
                        user {
                            username
                        }
                    }
                }
            }
        `;

        // 実際のWebSocket接続を設定
        const subscriptionId = this.createSubscription(subscription, { roomId }, callback);
        this.subscriptions.set(`messages_${roomId}`, subscriptionId);
        
        return subscriptionId;
    }

    // リアルタイム購読 - メッセージ更新
    subscribeToMessageUpdates(roomId, callback) {
        const subscription = `
            subscription OnUpdateMessage($roomId: ID!) {
                onUpdateMessage(roomId: $roomId) {
                    id
                    content
                    updatedAt
                    edited
                }
            }
        `;

        const subscriptionId = this.createSubscription(subscription, { roomId }, callback);
        this.subscriptions.set(`message_updates_${roomId}`, subscriptionId);
        
        return subscriptionId;
    }

    // リアルタイム購読 - タイピング状態
    subscribeToTyping(roomId, callback) {
        const subscription = `
            subscription OnTyping($roomId: ID!) {
                onTyping(roomId: $roomId) {
                    userId
                    username
                    isTyping
                    timestamp
                }
            }
        `;

        const subscriptionId = this.createSubscription(subscription, { roomId }, callback);
        this.subscriptions.set(`typing_${roomId}`, subscriptionId);
        
        return subscriptionId;
    }

    // 購読を作成（WebSocket実装）
    createSubscription(subscription, variables, callback) {
        // 実際の実装では、AppSync WebSocketまたはEventSourceを使用
        // ここでは概念的な実装を示します
        const subscriptionId = Utils.generateId();
        
        // WebSocket接続の設定
        // この部分は実際にはAppSync Real-time APIを使用します
        
        return subscriptionId;
    }

    // 購読解除
    unsubscribe(subscriptionId) {
        if (this.subscriptions.has(subscriptionId)) {
            // WebSocket接続を閉じる
            this.subscriptions.delete(subscriptionId);
        }
    }

    // ルームの購読を全て解除
    unsubscribeFromRoom(roomId) {
        const subscriptionKeys = [
            `messages_${roomId}`,
            `message_updates_${roomId}`,
            `typing_${roomId}`
        ];

        subscriptionKeys.forEach(key => {
            if (this.subscriptions.has(key)) {
                this.unsubscribe(this.subscriptions.get(key));
                this.subscriptions.delete(key);
            }
        });
    }

    // タイピング状態を送信
    async sendTypingStatus(roomId, isTyping) {
        const mutation = `
            mutation PublishTyping($input: TypingInput!) {
                publishTyping(input: $input) {
                    success
                }
            }
        `;

        const user = await Auth.getCurrentUser();
        
        const variables = {
            input: {
                roomId,
                userId: user.attributes.sub,
                username: user.attributes.name || user.username,
                isTyping,
                timestamp: new Date().toISOString()
            }
        };

        try {
            await this.graphqlRequest(mutation, variables);
        } catch (error) {
            console.warn('Failed to send typing status:', error);
        }
    }

    // オンライン状態更新
    async updateOnlineStatus(isOnline) {
        const mutation = `
            mutation UpdateUserStatus($input: UpdateUserStatusInput!) {
                updateUserStatus(input: $input) {
                    success
                }
            }
        `;

        const user = await Auth.getCurrentUser();
        
        const variables = {
            input: {
                userId: user.attributes.sub,
                isOnline,
                lastSeen: new Date().toISOString()
            }
        };

        try {
            await this.graphqlRequest(mutation, variables);
        } catch (error) {
            console.warn('Failed to update online status:', error);
        }
    }

    // メッセージキャッシュ管理
    addMessageToCache(roomId, message) {
        if (!this.messageCache.has(roomId)) {
            this.messageCache.set(roomId, []);
        }
        
        const messages = this.messageCache.get(roomId);
        messages.push(message);
        
        // 最大1000件までキャッシュ
        if (messages.length > 1000) {
            messages.splice(0, messages.length - 1000);
        }
    }

    setMessagesCache(roomId, messages) {
        this.messageCache.set(roomId, [...messages]);
    }

    getMessagesFromCache(roomId) {
        return this.messageCache.get(roomId) || [];
    }

    clearMessageCache(roomId) {
        if (roomId) {
            this.messageCache.delete(roomId);
        } else {
            this.messageCache.clear();
        }
    }

    // 接続状態の監視
    setupConnectionListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateOnlineStatus(true);
            this.reconnectSubscriptions();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateOnlineStatus(false);
        });

        // ページを離れる時にオフライン状態に
        window.addEventListener('beforeunload', () => {
            if (this.isOnline) {
                this.updateOnlineStatus(false);
            }
        });
    }

    // 購読の再接続
    reconnectSubscriptions() {
        // 切断された購読を再接続
        this.subscriptions.forEach((subscriptionId, key) => {
            // 実際の実装では各購読を再作成
            console.log(`Reconnecting subscription: ${key}`);
        });
    }

    // メッセージ検索
    async searchMessages(roomId, searchTerm, limit = 20) {
        const query = `
            query SearchMessages($roomId: ID!, $searchTerm: String!, $limit: Int) {
                searchMessages(roomId: $roomId, searchTerm: $searchTerm, limit: $limit) {
                    items {
                        id
                        roomId
                        userId
                        content
                        messageType
                        createdAt
                        user {
                            id
                            username
                            avatar
                        }
                    }
                }
            }
        `;

        return await this.graphqlRequest(query, {
            roomId,
            searchTerm,
            limit
        });
    }

    // メッセージ履歴の読み込み（無限スクロール用）
    async loadMoreMessages(roomId, nextToken) {
        return await this.getMessages(roomId, 50, nextToken);
    }

    // 既読状態の更新
    async markAsRead(roomId, messageId) {
        const mutation = `
            mutation MarkAsRead($input: MarkAsReadInput!) {
                markAsRead(input: $input) {
                    success
                }
            }
        `;

        const user = await Auth.getCurrentUser();
        
        const variables = {
            input: {
                roomId,
                userId: user.attributes.sub,
                messageId,
                readAt: new Date().toISOString()
            }
        };

        return await this.graphqlRequest(mutation, variables);
    }

    // エラーハンドリング
    handleError(error) {
        console.error('Chat error:', error);
        
        // ネットワークエラーの場合
        if (!navigator.onLine) {
            throw new Error('ネットワークに接続されていません');
        }
        
        // 認証エラーの場合
        if (error.message.includes('Unauthorized')) {
            throw new Error('認証が必要です');
        }
        
        throw error;
    }
}

// グローバルインスタンスを作成
const Chat = new Chat();