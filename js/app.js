// アプリケーションメインクラス
class ChatApp {
    constructor() {
        this.currentUser = null;
        this.currentRoom = null;
        this.rooms = [];
        this.messages = [];
        this.subscriptions = [];
        
        // AWS設定
        this.awsConfig = {
            region: 'ap-northeast-1',
            userPoolId: 'your-user-pool-id',
            userPoolWebClientId: 'your-client-id',
            appsyncGraphqlEndpoint: 'your-appsync-endpoint',
            appsyncRegion: 'ap-northeast-1',
            appsyncAuthenticationType: 'AMAZON_COGNITO_USER_POOLS'
        };
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // AWS設定
            AWS.config.update({
                region: this.awsConfig.region,
                credentials: new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: this.awsConfig.identityPoolId
                })
            });

            // 認証状態チェック
            await this.checkAuthState();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
        } catch (error) {
            console.error('アプリケーション初期化エラー:', error);
            this.showToast('アプリケーションの初期化に失敗しました', 'error');
        }
    }

    async checkAuthState() {
        try {
            const user = await Auth.getCurrentUser();
            if (user) {
                this.currentUser = user;
                this.showApp();
                await this.loadUserData();
            } else {
                this.showLogin();
            }
        } catch (error) {
            console.log('ユーザーは認証されていません');
            this.showLogin();
        }
    }

    setupEventListeners() {
        // 認証関連
        document.getElementById('login-form').addEventListener('submit', this.handleLogin.bind(this));
        document.getElementById('signup-form').addEventListener('submit', this.handleSignup.bind(this));
        document.getElementById('logout-btn').addEventListener('click', this.handleLogout.bind(this));
        
        // 画面切り替え
        document.getElementById('show-signup').addEventListener('click', this.showSignup.bind(this));
        document.getElementById('show-login').addEventListener('click', this.showLogin.bind(this));
        
        // ルーム関連
        document.getElementById('create-room-btn').addEventListener('click', this.showCreateRoomModal.bind(this));
        document.getElementById('create-room-form').addEventListener('submit', this.handleCreateRoom.bind(this));
        document.getElementById('close-modal').addEventListener('click', this.hideCreateRoomModal.bind(this));
        document.getElementById('cancel-create').addEventListener('click', this.hideCreateRoomModal.bind(this));
        
        // メッセージ関連
        document.getElementById('message-form').addEventListener('submit', this.handleSendMessage.bind(this));
        document.getElementById('attach-btn').addEventListener('click', this.handleAttachFile.bind(this));
        document.getElementById('file-input').addEventListener('change', this.handleFileUpload.bind(this));
        
        // 検索
        document.getElementById('room-search').addEventListener('input', this.handleRoomSearch.bind(this));
        
        // ドラッグ&ドロップ
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const chatContainer = document.getElementById('chat-container');
        
        chatContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.showDragOverlay();
        });
        
        chatContainer.addEventListener('dragleave', (e) => {
            if (!chatContainer.contains(e.relatedTarget)) {
                this.hideDragOverlay();
            }
        });
        
        chatContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            this.hideDragOverlay();
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleFileUpload({ target: { files } });
            }
        });
    }

    // 認証関連メソッド
    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        this.showLoading();
        
        try {
            const user = await Auth.signIn(email, password);
            this.currentUser = user;
            this.showApp();
            await this.loadUserData();
            this.showToast('ログインしました', 'success');
        } catch (error) {
            console.error('ログインエラー:', error);
            this.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        
        this.showLoading();
        
        try {
            await Auth.signUp({
                username: email,
                password,
                attributes: {
                    email,
                    name: username
                }
            });
            
            this.showToast('登録が完了しました。メールを確認してください。', 'success');
            this.showLogin();
        } catch (error) {
            console.error('登録エラー:', error);
            this.showToast(this.getErrorMessage(error), 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleLogout() {
        try {
            await Auth.signOut();
            this.currentUser = null;
            this.currentRoom = null;
            this.rooms = [];
            this.messages = [];
            this.unsubscribeAll();
            this.showLogin();
            this.showToast('ログアウトしました', 'success');
        } catch (error) {
            console.error('ログアウトエラー:', error);
            this.showToast('ログアウトに失敗しました', 'error');
        }
    }

    // ユーザーデータ読み込み
    async loadUserData() {
        try {
            await this.loadRooms();
            this.updateUserInfo();
        } catch (error) {
            console.error('ユーザーデータ読み込みエラー:', error);
            this.showToast('データの読み込みに失敗しました', 'error');
        }
    }

    async loadRooms() {
        try {
            const query = `
                query GetUserRooms($userId: ID!) {
                    roomMembersByUser(userId: $userId) {
                        items {
                            room {
                                id
                                name
                                roomType
                                createdAt
                                members {
                                    items {
                                        user {
                                            id
                                            username
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `;
            
            const result = await this.graphqlRequest(query, {
                userId: this.currentUser.attributes.sub
            });
            
            this.rooms = result.data.roomMembersByUser.items.map(item => item.room);
            this.renderRooms();
        } catch (error) {
            console.error('ルーム読み込みエラー:', error);
        }
    }

    // ルーム関連メソッド
    async handleCreateRoom(e) {
        e.preventDefault();
        const roomName = document.getElementById('room-name').value;
        const roomType = document.getElementById('room-type').value;
        
        this.showLoading();
        
        try {
            const mutation = `
                mutation CreateRoom($input: CreateRoomInput!) {
                    createRoom(input: $input) {
                        id
                        name
                        roomType
                        createdAt
                    }
                }
            `;
            
            const result = await this.graphqlRequest(mutation, {
                input: {
                    name: roomName,
                    roomType,
                    createdBy: this.currentUser.attributes.sub
                }
            });
            
            const newRoom = result.data.createRoom;
            
            // ルームメンバーに自分を追加
            await this.addRoomMember(newRoom.id, this.currentUser.attributes.sub, 'ADMIN');
            
            this.rooms.push(newRoom);
            this.renderRooms();
            this.hideCreateRoomModal();
            this.showToast('ルームを作成しました', 'success');
            
            // 新しいルームを選択
            this.selectRoom(newRoom);
            
        } catch (error) {
            console.error('ルーム作成エラー:', error);
            this.showToast('ルームの作成に失敗しました', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async addRoomMember(roomId, userId, role = 'MEMBER') {
        const mutation = `
            mutation CreateRoomMember($input: CreateRoomMemberInput!) {
                createRoomMember(input: $input) {
                    id
                }
            }
        `;
        
        await this.graphqlRequest(mutation, {
            input: {
                roomId,
                userId,
                role,
                joinedAt: new Date().toISOString()
            }
        });
    }

    selectRoom(room) {
        // 前のルームの購読を解除
        if (this.currentRoom) {
            this.unsubscribeFromRoom(this.currentRoom.id);
        }
        
        this.currentRoom = room;
        this.updateRoomSelection();
        this.loadMessages();
        this.subscribeToMessages();
        this.showChatContainer();
    }

    // メッセージ関連メソッド
    async loadMessages() {
        if (!this.currentRoom) return;
        
        try {
            const query = `
                query GetRoomMessages($roomId: ID!) {
                    messagesByRoom(roomId: $roomId, sortDirection: ASC) {
                        items {
                            id
                            content
                            messageType
                            attachments
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
            
            const result = await this.graphqlRequest(query, {
                roomId: this.currentRoom.id
            });
            
            this.messages = result.data.messagesByRoom.items;
            this.renderMessages();
        } catch (error) {
            console.error('メッセージ読み込みエラー:', error);
        }
    }

    async handleSendMessage(e) {
        e.preventDefault();
        const messageInput = document.getElementById('message-input');
        const content = messageInput.value.trim();
        
        if (!content || !this.currentRoom) return;
        
        try {
            const mutation = `
                mutation CreateMessage($input: CreateMessageInput!) {
                    createMessage(input: $input) {
                        id
                        content
                        messageType
                        createdAt
                    }
                }
            `;
            
            await this.graphqlRequest(mutation, {
                input: {
                    roomId: this.currentRoom.id,
                    userId: this.currentUser.attributes.sub,
                    content,
                    messageType: 'TEXT'
                }
            });
            
            messageInput.value = '';
        } catch (error) {
            console.error('メッセージ送信エラー:', error);
            this.showToast('メッセージの送信に失敗しました', 'error');
        }
    }

    async handleFileUpload(e) {
        const files = Array.from(e.target.files || e.target.files);
        if (files.length === 0 || !this.currentRoom) return;
        
        for (const file of files) {
            try {
                this.showLoading();
                
                // S3にファイルアップロード
                const fileKey = `chat-files/${Date.now()}-${file.name}`;
                await Storage.put(fileKey, file, {
                    contentType: file.type,
                    level: 'public'
                });
                
                // ファイルメッセージを送信
                const mutation = `
                    mutation CreateMessage($input: CreateMessageInput!) {
                        createMessage(input: $input) {
                            id
                            content
                            messageType
                            attachments
                            createdAt
                        }
                    }
                `;
                
                await this.graphqlRequest(mutation, {
                    input: {
                        roomId: this.currentRoom.id,
                        userId: this.currentUser.attributes.sub,
                        content: file.name,
                        messageType: file.type.startsWith('image/') ? 'IMAGE' : 'FILE',
                        attachments: [fileKey]
                    }
                });
                
            } catch (error) {
                console.error('ファイルアップロードエラー:', error);
                this.showToast(`${file.name}のアップロードに失敗しました`, 'error');
            } finally {
                this.hideLoading();
            }
        }
        
        // ファイル入力をクリア
        e.target.value = '';
    }

    // リアルタイム購読
    subscribeToMessages() {
        if (!this.currentRoom) return;
        
        const subscription = `
            subscription OnCreateMessage($roomId: ID!) {
                onCreateMessage(roomId: $roomId) {
                    id
                    content
                    messageType
                    attachments
                    createdAt
                    user {
                        id
                        username
                        avatar
                    }
                }
            }
        `;
        
        // WebSocketを使用したリアルタイム購読の実装
        // 実際の実装では、AppSync Subscriptionを使用
        this.subscriptions.push({
            roomId: this.currentRoom.id,
            unsubscribe: () => {
                // 購読解除の実装
            }
        });
    }

    unsubscribeFromRoom(roomId) {
        this.subscriptions = this.subscriptions.filter(sub => {
            if (sub.roomId === roomId) {
                sub.unsubscribe();
                return false;
            }
            return true;
        });
    }

    unsubscribeAll() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
    }

    // GraphQL リクエスト
    async graphqlRequest(query, variables = {}) {
        const endpoint = this.awsConfig.appsyncGraphqlEndpoint;
        const session = await Auth.currentSession();
        const token = session.getIdToken().getJwtToken();
        
        const response = await fetch(endpoint, {
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
        
        const result = await response.json();
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }
        
        return result;
    }

    // UI関連メソッド
    showLogin() {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('signup-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'none';
    }

    showSignup() {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('signup-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }

    showApp() {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('signup-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
    }

    showCreateRoomModal() {
        document.getElementById('create-room-modal').style.display = 'flex';
    }

    hideCreateRoomModal() {
        document.getElementById('create-room-modal').style.display = 'none';
        document.getElementById('create-room-form').reset();
    }

    showChatContainer() {
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showDragOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'drag-overlay';
        overlay.textContent = 'ファイルをドロップしてください';
        overlay.id = 'drag-overlay';
        document.getElementById('chat-container').appendChild(overlay);
    }

    hideDragOverlay() {
        const overlay = document.getElementById('drag-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    updateUserInfo() {
        if (this.currentUser) {
            document.getElementById('username').textContent = 
                this.currentUser.attributes.name || this.currentUser.username;
        }
    }

    updateRoomSelection() {
        // 全てのルームの選択状態をリセット
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 現在のルームを選択状態にする
        if (this.currentRoom) {
            const roomElement = document.querySelector(`[data-room-id="${this.currentRoom.id}"]`);
            if (roomElement) {
                roomElement.classList.add('active');
            }
            
            // チャットヘッダーを更新
            document.getElementById('current-room-name').textContent = this.currentRoom.name;
        }
    }

    renderRooms() {
        const roomsList = document.getElementById('rooms-list');
        roomsList.innerHTML = '';
        
        this.rooms.forEach(room => {
            const roomElement = this.createRoomElement(room);
            roomsList.appendChild(roomElement);
        });
    }

    createRoomElement(room) {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room-item';
        roomDiv.dataset.roomId = room.id;
        roomDiv.addEventListener('click', () => this.selectRoom(room));
        
        roomDiv.innerHTML = `
            <div class="room-avatar">
                ${room.name.charAt(0).toUpperCase()}
            </div>
            <div class="room-info">
                <div class="room-name">${room.name}</div>
                <div class="room-last-message">最後のメッセージ...</div>
            </div>
            <div class="room-meta">
                <div class="room-time">12:34</div>
            </div>
        `;
        
        return roomDiv;
    }

    renderMessages() {
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '';
        
        this.messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });
        
        // 最新メッセージまでスクロール
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-item';
        
        const isOwnMessage = message.user.id === this.currentUser.attributes.sub;
        if (isOwnMessage) {
            messageDiv.classList.add('own-message');
        }
        
        const time = new Date(message.createdAt).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <img src="${message.user.avatar || 'assets/images/default-avatar.png'}" 
                 alt="${message.user.username}" class="message-avatar">
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${message.user.username}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-bubble">
                    ${this.renderMessageContent(message)}
                </div>
            </div>
        `;
        
        return messageDiv;
    }

    renderMessageContent(message) {
        switch (message.messageType) {
            case 'TEXT':
                return `<p>${this.escapeHtml(message.content)}</p>`;
            case 'IMAGE':
                return `
                    <p>${this.escapeHtml(message.content)}</p>
                    <div class="message-image">
                        <img src="${this.getFileUrl(message.attachments[0])}" alt="画像">
                    </div>
                `;
            case 'FILE':
                return `
                    <div class="message-file">
                        <div class="file-icon">📎</div>
                        <div class="file-info">
                            <div class="file-name">${this.escapeHtml(message.content)}</div>
                        </div>
                        <button class="file-download" onclick="window.open('${this.getFileUrl(message.attachments[0])}')">
                            ダウンロード
                        </button>
                    </div>
                `;
            default:
                return `<p>${this.escapeHtml(message.content)}</p>`;
        }
    }

    getFileUrl(fileKey) {
        return `https://your-bucket.s3.ap-northeast-1.amazonaws.com/public/${fileKey}`;
    }

    handleRoomSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        const roomItems = document.querySelectorAll('.room-item');
        
        roomItems.forEach(item => {
            const roomName = item.querySelector('.room-name').textContent.toLowerCase();
            const isVisible = roomName.includes(searchTerm);
            item.style.display = isVisible ? 'flex' : 'none';
        });
    }

    handleAttachFile() {
        document.getElementById('file-input').click();
    }

    // ユーティリティメソッド
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getErrorMessage(error) {
        switch (error.code) {
            case 'UserNotConfirmedException':
                return 'メールアドレスの認証が完了していません';
            case 'NotAuthorizedException':
                return 'ユーザー名またはパスワードが間違っています';
            case 'UserNotFoundException':
                return 'ユーザーが見つかりません';
            case 'InvalidParameterException':
                return '入力された情報が正しくありません';
            case 'UsernameExistsException':
                return 'このメールアドレスは既に登録されています';
            default:
                return error.message || 'エラーが発生しました';
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        document.getElementById('toast-container').appendChild(toast);
        
        // 5秒後に自動削除
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});