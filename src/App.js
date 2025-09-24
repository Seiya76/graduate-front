import React, { useState, useEffect, useCallback, useRef } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import config from "./aws-exports.js";

// GraphQLクエリをインポート
import {
  createGroupRoom,
  createDirectRoom,
  joinRoom,
  sendMessage as sendMessageMutation,
} from "./graphql/mutations";

import {
  getCurrentUser,
  getUser,
  searchUsers,
  getUserRooms,
  getRoom,
  getRecentMessages,
} from "./graphql/queries";

import { onMessageSent, onRoomUpdate } from "./graphql/subscriptions";

Amplify.configure(config);

const client = generateClient();

// getUserByEmailクエリが不足している場合は追加定義
const GET_USER_BY_EMAIL = `
  query GetUserByEmail($email: String!) {
    getUserByEmail(email: $email) {
      userId
      createdAt
      email
      emailVerified
      nickname
      status
      updatedAt
      __typename
    }
  }
`;

// Google Chat風のチャット画面コンポーネント
function ChatScreen({ user, onSignOut }) {
  const [selectedSpace, setSelectedSpace] = useState("ホーム");
  const [currentUser, setCurrentUser] = useState(null);
  const [userRooms, setUserRooms] = useState([]);

  // ルーム作成モーダル用のstate
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState([]);
  const [isModalSearching, setIsModalSearching] = useState(false);

  // ダイレクトメッセージ用のstate
  const [dmSearchTerm, setDmSearchTerm] = useState("");
  const [dmSearchResults, setDmSearchResults] = useState([]);
  const [isDmSearching, setIsDmSearching] = useState(false);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isRoomCreationLoading, setIsRoomCreationLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  // メッセージ機能用のstate
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState(null);

  // リアルタイム接続用のstate
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Subscription用のref
  const messageSubscriptionRef = useRef(null);
  const roomSubscriptionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 選択されたルームのID取得
  const selectedRoomId = React.useMemo(() => {
    if (selectedSpace === "ホーム") return null;

    const room = userRooms.find((room) => room.roomName === selectedSpace);
    return room?.roomId || null;
  }, [selectedSpace, userRooms]);

  // AppSyncからユーザー情報を取得
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const oidcSub = user.profile.sub;
        const email = user.profile.email;

        let result = null;

        // まずuserIdで検索を試す
        try {
          result = await client.graphql({
            query: getUser,
            variables: { userId: oidcSub },
            authMode: "apiKey",
          });

          if (result.data.getUser) {
            setCurrentUser(result.data.getUser);
            return;
          }
        } catch (userIdError) {
          // userIdで見つからない場合の処理
        }

        // userIdで見つからない場合、emailで検索
        if (email) {
          try {
            result = await client.graphql({
              query: GET_USER_BY_EMAIL,
              variables: { email: email },
              authMode: "apiKey",
            });

            if (result.data.getUserByEmail) {
              setCurrentUser(result.data.getUserByEmail);
              return;
            }
          } catch (emailError) {
            // emailでも見つからない場合の処理
          }
        }

        // DynamoDBにデータがない場合はOIDC情報をフォールバック
        const fallbackUser = {
          userId: oidcSub,
          nickname:
            user.profile.name ||
            user.profile.preferred_username ||
            email?.split("@")[0],
          email: email,
          status: "active",
        };
        setCurrentUser(fallbackUser);
      } catch (error) {
        console.error("Error fetching current user:", error);

        // エラーの場合もOIDC情報をフォールバック
        const fallbackUser = {
          userId: user.profile.sub,
          nickname:
            user.profile.name ||
            user.profile.preferred_username ||
            user.profile.email?.split("@")[0],
          email: user.profile.email,
          status: "active",
        };
        setCurrentUser(fallbackUser);
      }
    };

    if (user?.profile?.sub) {
      fetchCurrentUser();
    }
  }, [user]);

  // ユーザーのルーム一覧を取得
  useEffect(() => {
    const fetchUserRooms = async () => {
      if (!currentUser?.userId) return;

      try {
        const result = await client.graphql({
          query: getUserRooms,
          variables: {
            userId: currentUser.userId,
            limit: 50,
          },
          authMode: "apiKey",
        });

        if (result.data.getUserRooms?.items) {
          setUserRooms(result.data.getUserRooms.items);
        }
      } catch (error) {
        console.error("Error fetching user rooms:", error);
      }
    };

    if (currentUser?.userId) {
      fetchUserRooms();
    }
  }, [currentUser]);

  // メッセージサブスクリプションのセットアップ
  useEffect(() => {
    if (!selectedRoomId || !currentUser?.userId) {
      return;
    }

    // 既存のサブスクリプションをクリーンアップ
    if (messageSubscriptionRef.current) {
      messageSubscriptionRef.current.unsubscribe();
    }

    try {
      messageSubscriptionRef.current = client
        .graphql({
          query: onMessageSent,
          variables: { roomId: selectedRoomId },
          authMode: "apiKey",
        })
        .subscribe({
          next: (eventData) => {
            if (eventData.value?.data?.onMessageSent) {
              const newMsg = eventData.value.data.onMessageSent;

              // メッセージを処理
              const formattedMessage = {
                id: newMsg.messageId,
                messageId: newMsg.messageId,
                sender: newMsg.nickname || "不明なユーザー",
                content: newMsg.content,
                time: new Date(newMsg.createdAt).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                isOwn: newMsg.userId === currentUser.userId,
                avatar: (newMsg.nickname || "UN").substring(0, 2).toUpperCase(),
                userId: newMsg.userId,
                createdAt: newMsg.createdAt,
              };

              setMessages((prevMessages) => {
                // 楽観的更新のメッセージを削除（自分のメッセージの場合）
                const filtered = formattedMessage.isOwn
                  ? prevMessages.filter((msg) => !msg.isOptimistic)
                  : prevMessages;

                // 重複チェック
                const exists = filtered.some(
                  (msg) => msg.messageId === formattedMessage.messageId
                );
                if (exists) return filtered;

                // 新しいメッセージを追加
                const updated = [...filtered, formattedMessage];

                // 自動スクロール
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({
                    behavior: "smooth",
                  });
                }, 100);

                return updated;
              });

              // 他のユーザーからのメッセージの場合は通知
              if (newMsg.userId !== currentUser.userId && document.hidden) {
                showNotification(newMsg);
              }
            }
          },
          error: (error) => {
            console.error("Subscription error:", error);
            setConnectionError("リアルタイム接続でエラーが発生しました");
            setIsConnected(false);
          },
          complete: () => {
            setIsConnected(true);
            setConnectionError(null);
          },
        });

      setIsConnected(true);
    } catch (error) {
      console.error("Failed to setup subscription:", error);
      setIsConnected(false);
      setConnectionError("サブスクリプションの設定に失敗しました");
    }

    // クリーンアップ
    return () => {
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
      }
    };
  }, [selectedRoomId, currentUser?.userId]);

  // ルーム更新のサブスクリプション
  useEffect(() => {
    if (!currentUser?.userId) return;

    try {
      roomSubscriptionRef.current = client
        .graphql({
          query: onRoomUpdate,
          variables: { userId: currentUser.userId },
          authMode: "apiKey",
        })
        .subscribe({
          next: (eventData) => {
            if (eventData.value?.data?.onRoomUpdate) {
              const updatedRoom = eventData.value.data.onRoomUpdate;

              // ルーム一覧を更新
              setUserRooms((prevRooms) => {
                const existingIndex = prevRooms.findIndex(
                  (r) => r.roomId === updatedRoom.roomId
                );

                if (existingIndex >= 0) {
                  // 既存のルームを更新
                  const updated = [...prevRooms];
                  updated[existingIndex] = updatedRoom;
                  return updated;
                } else {
                  // 新しいルームを追加
                  return [updatedRoom, ...prevRooms];
                }
              });
            }
          },
          error: (error) => {
            console.error("Room subscription error:", error);
          },
        });
    } catch (error) {
      console.error("Failed to setup room subscription:", error);
    }

    return () => {
      if (roomSubscriptionRef.current) {
        roomSubscriptionRef.current.unsubscribe();
      }
    };
  }, [currentUser?.userId]);

  // 通知を表示
  const showNotification = (message) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`${message.nickname || "新着メッセージ"}`, {
        body: message.content,
        icon: "/chat-icon.png",
        tag: message.messageId,
        renotify: false,
      });
    }
  };

  // 通知権限リクエスト
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // メッセージ取得
  const fetchMessages = async () => {
    if (!selectedRoomId) return;

    setIsLoadingMessages(true);
    setMessages([]);
    setMessageError(null);

    try {
      const result = await client.graphql({
        query: getRecentMessages,
        variables: { roomId: selectedRoomId },
        authMode: "apiKey",
      });

      if (result.data?.getRecentMessages) {
        const fetchedMessages = result.data.getRecentMessages.map((msg) => ({
          id: msg.messageId,
          messageId: msg.messageId,
          sender: msg.nickname || "不明なユーザー",
          content: msg.content,
          time: new Date(msg.createdAt).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isOwn: msg.userId === currentUser?.userId,
          avatar: (msg.nickname || "UN").substring(0, 2).toUpperCase(),
          userId: msg.userId,
          createdAt: msg.createdAt,
        }));

        setMessages(fetchedMessages);

        // 初回読み込み時は最下部にスクロール
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }, 100);
      }
    } catch (err) {
      console.error("メッセージ取得エラー:", err);
      setMessageError("メッセージの取得に失敗しました");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // ルーム変更時のメッセージ取得
  useEffect(() => {
    if (selectedRoomId && currentUser?.userId) {
      fetchMessages();
    } else {
      setMessages([]);
      setMessageError(null);
    }
  }, [selectedRoomId, currentUser?.userId]);

  // メッセージ送信（楽観的UI更新付き）
  const sendMessage = useCallback(async () => {
    if (
      !newMessage.trim() ||
      !selectedRoomId ||
      !currentUser?.userId ||
      isSendingMessage
    ) {
      return;
    }

    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // 楽観的UI更新
    const optimisticMessage = {
      id: tempId,
      messageId: tempId,
      sender: currentUser.nickname || currentUser.email || "自分",
      content: messageContent,
      time: new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isOwn: true,
      avatar: (currentUser.nickname || currentUser.email || "ME")
        .substring(0, 2)
        .toUpperCase(),
      userId: currentUser.userId,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // 即座にUIに反映
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    setIsSendingMessage(true);

    // スクロール
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      const result = await client.graphql({
        query: sendMessageMutation,
        variables: {
          input: {
            roomId: selectedRoomId,
            userId: currentUser.userId,
            nickname: currentUser.nickname || currentUser.email || "ユーザー",
            content: messageContent,
          },
        },
        authMode: "apiKey",
      });

      // サブスクリプション経由で実際のメッセージが届く
    } catch (err) {
      console.error("メッセージ送信エラー:", err);

      // エラー時は楽観的更新を取り消し
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setNewMessage(messageContent); // エラーの場合は入力を復元

      let errorMessage = "メッセージの送信に失敗しました";
      if (err.errors && err.errors.length > 0) {
        errorMessage += ": " + err.errors[0].message;
      }

      setMessageError(errorMessage);
    } finally {
      setIsSendingMessage(false);
    }
  }, [newMessage, selectedRoomId, currentUser, isSendingMessage]);

  // キーボードイベントハンドラー
  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // ユーザー検索（モーダル用）
  const searchUsersForModal = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setModalSearchResults([]);
      return;
    }

    setIsModalSearching(true);
    try {
      const result = await client.graphql({
        query: searchUsers,
        variables: {
          searchTerm: searchTerm.trim(),
          limit: 50,
        },
        authMode: "apiKey",
      });

      if (result.data.searchUsers?.items) {
        const filteredUsers = result.data.searchUsers.items.filter(
          (u) => u.userId !== currentUser?.userId
        );

        setModalSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error("Error searching users for modal:", error);
      setModalSearchResults([]);
    } finally {
      setIsModalSearching(false);
    }
  };

  // DM用検索
  const searchUsersForDM = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setDmSearchResults([]);
      return;
    }

    setIsDmSearching(true);
    try {
      const result = await client.graphql({
        query: searchUsers,
        variables: {
          searchTerm: searchTerm.trim(),
          limit: 20,
        },
        authMode: "apiKey",
      });

      if (result.data.searchUsers?.items) {
        const filteredUsers = result.data.searchUsers.items.filter(
          (u) => u.userId !== currentUser?.userId
        );
        setDmSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error("Error searching users for DM:", error);
      setDmSearchResults([]);
    } finally {
      setIsDmSearching(false);
    }
  };

  // モーダル検索のデバウンス処理
  useEffect(() => {
    const timer = setTimeout(() => {
      if (modalSearchTerm) {
        searchUsersForModal(modalSearchTerm);
      } else {
        setModalSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [modalSearchTerm, currentUser]);

  // DM検索のデバウンス処理
  useEffect(() => {
    const timer = setTimeout(() => {
      if (dmSearchTerm) {
        searchUsersForDM(dmSearchTerm);
      } else {
        setDmSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [dmSearchTerm, currentUser]);

  // グループルーム作成
  const createGroupRoom_func = async () => {
    if (!newRoomName.trim() || !currentUser?.userId) return;

    setIsRoomCreationLoading(true);

    try {
      const result = await client.graphql({
        query: createGroupRoom,
        variables: {
          input: {
            roomName: newRoomName.trim(),
            memberUserIds: selectedUsers,
            createdBy: currentUser.userId,
          },
        },
        authMode: "apiKey",
      });

      if (result.data.createGroupRoom) {
        const createdRoom = result.data.createGroupRoom;

        const newRoom = {
          ...createdRoom,
          lastMessage: createdRoom.lastMessage || "未入力",
          lastMessageAt: createdRoom.lastMessageAt || createdRoom.createdAt,
        };
        setUserRooms((prev) => [newRoom, ...prev]);

        resetModal();

        alert(
          `ルーム「${newRoomName}」を作成しました。（${createdRoom.memberCount}人のメンバー）`
        );

        setSelectedSpace(createdRoom.roomName);
      }
    } catch (error) {
      console.error("Error creating room:", error);

      let errorMessage = "ルーム作成でエラーが発生しました。";
      if (error.errors && error.errors.length > 0) {
        errorMessage += "\n" + error.errors.map((e) => e.message).join("\n");
      }

      alert(errorMessage);
    } finally {
      setIsRoomCreationLoading(false);
    }
  };

  // ダイレクトルーム作成
  const createDirectRoom_func = async (targetUserId) => {
    if (!currentUser?.userId || !targetUserId) return;

    try {
      const result = await client.graphql({
        query: createDirectRoom,
        variables: {
          targetUserId: targetUserId,
          createdBy: currentUser.userId,
        },
        authMode: "apiKey",
      });

      if (result.data.createDirectRoom) {
        const newRoom = {
          ...result.data.createDirectRoom,
          lastMessage: result.data.createDirectRoom.lastMessage || "未入力",
          lastMessageAt:
            result.data.createDirectRoom.lastMessageAt ||
            result.data.createDirectRoom.createdAt,
        };
        setUserRooms((prev) => [newRoom, ...prev]);
        setSelectedSpace(result.data.createDirectRoom.roomName);
      }
    } catch (error) {
      console.error("Error creating direct room:", error);
      alert("ダイレクトルーム作成でエラーが発生しました: " + error.message);
    }
  };

  // 表示名の取得
  const getDisplayName = () => {
    return (
      currentUser?.nickname ||
      user.profile.name ||
      user.profile.email?.split("@")[0] ||
      "ユーザー"
    );
  };

  const getDisplayAvatar = () => {
    const name = getDisplayName();
    return name.substring(0, 2).toUpperCase();
  };

  // ユーザー選択のトグル
  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // モーダルリセット関数
  const resetModal = () => {
    setIsCreatingRoom(false);
    setIsRoomCreationLoading(false);
    setModalSearchTerm("");
    setModalSearchResults([]);
    setSelectedUsers([]);
    setNewRoomName("");
  };

  // エラー自動クリア
  useEffect(() => {
    if (messageError) {
      const timer = setTimeout(() => setMessageError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [messageError]);

  // グループルームとダイレクトルームの分類
  const groupRooms = userRooms.filter((room) => room.roomType === "group");
  const directRooms = userRooms.filter((room) => room.roomType === "direct");

  return (
    <div className="chat-app">
      {/* サイドバー */}
      <div className="sidebar">
        {/* ヘッダー */}
        <div className="sidebar-header">
          <div className="app-title">
            <span className="chat-icon">Chat</span>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn signout-btn"
              onClick={onSignOut}
              title="サインアウト"
            ></button>
          </div>
        </div>

        {/* 新しいチャット */}
        <div className="new-chat-section">
          <button
            className="new-chat-btn"
            onClick={() => setIsCreatingRoom(true)}
          >
            <span className="plus-icon">+</span>
            新しいチャット
          </button>
        </div>

        {/* ルーム作成モーダル */}
        {isCreatingRoom && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>新しいグループルームを作成</h3>
                <button onClick={resetModal} disabled={isRoomCreationLoading}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  placeholder="ルーム名"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="room-name-input"
                  disabled={isRoomCreationLoading}
                />

                <div className="user-search-section">
                  <h4>メンバーを検索して追加:</h4>
                  <div className="search-container">
                    <input
                      type="text"
                      placeholder="名前またはメールアドレスで検索"
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="user-search-input"
                      disabled={isRoomCreationLoading}
                    />
                    {isModalSearching && (
                      <div className="search-loading">検索中...</div>
                    )}
                  </div>

                  {modalSearchResults.length > 0 && (
                    <div className="search-results">
                      <div className="search-results-header">
                        {modalSearchResults.length}件のユーザーが見つかりました
                      </div>
                      {modalSearchResults.map((user) => (
                        <div key={user.userId} className="search-result-item">
                          <div className="user-info">
                            <div className="user-avatar-small">
                              {(user.nickname || user.email)
                                .substring(0, 2)
                                .toUpperCase()}
                            </div>
                            <div className="user-details">
                              <div className="user-name">
                                {user.nickname || user.email}
                              </div>
                              <div className="user-email">{user.email}</div>
                            </div>
                          </div>
                          <button
                            className={`add-user-btn ${
                              selectedUsers.includes(user.userId)
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => toggleUserSelection(user.userId)}
                            disabled={isRoomCreationLoading}
                          >
                            {selectedUsers.includes(user.userId)
                              ? "✓ 選択済み"
                              : "+ 追加"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {modalSearchTerm &&
                    modalSearchResults.length === 0 &&
                    !isModalSearching && (
                      <div className="no-results">
                        「{modalSearchTerm}
                        」に該当するユーザーが見つかりませんでした
                      </div>
                    )}
                </div>

                {selectedUsers.length > 0 && (
                  <div className="selected-users-section">
                    <h4>選択されたメンバー ({selectedUsers.length}人):</h4>
                    <div className="selected-users-preview">
                      <div className="member-count-preview">
                        総メンバー数: {selectedUsers.length + 1}人 (あなた +{" "}
                        {selectedUsers.length}人)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  onClick={resetModal}
                  disabled={isRoomCreationLoading}
                  className="cancel-btn"
                >
                  キャンセル
                </button>
                <button
                  onClick={createGroupRoom_func}
                  disabled={!newRoomName.trim() || isRoomCreationLoading}
                  className="create-room-btn"
                >
                  {isRoomCreationLoading ? (
                    <>
                      <span className="loading-spinner-small"></span>
                      作成中...
                    </>
                  ) : (
                    <>
                      ルーム作成
                      {selectedUsers.length > 0 && (
                        <span className="member-count-badge">
                          {selectedUsers.length + 1}人
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ナビゲーション */}
        <div className="nav-section">
          {/* ホーム */}
          <div className="nav-group">
            <div className="nav-group-header">グループメッセージ</div>
            <div
              className={`nav-item ${
                selectedSpace === "ホーム" ? "active" : ""
              }`}
              onClick={() => setSelectedSpace("ホーム")}
            >
              <span className="nav-icon icon-home"></span>
              <span className="nav-text">ホーム</span>
            </div>

            {/* グループルーム */}
            {groupRooms.map((room) => (
              <div
                key={room.roomId}
                className={`nav-item ${
                  selectedSpace === room.roomName ? "active" : ""
                }`}
                onClick={() => setSelectedSpace(room.roomName)}
              >
                <span className="nav-icon icon-team"></span>
                <span className="nav-text">{room.roomName}</span>
                <span className="member-count">({room.memberCount})</span>
                {room.lastMessageAt && (
                  <span className="last-message-time">
                    {new Date(room.lastMessageAt).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ダイレクトメッセージ */}
          <div className="nav-group">
            <div className="nav-group-header">ダイレクト メッセージ</div>

            {/* 既存のダイレクトルーム */}
            {directRooms.map((room) => {
              const formatTime = (timestamp) => {
                if (!timestamp) return "";
                const date = new Date(timestamp);
                const now = new Date();
                const diffDays = Math.floor(
                  (now - date) / (1000 * 60 * 60 * 24)
                );

                if (diffDays === 0) {
                  return date.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                } else if (diffDays === 1) {
                  return "昨日";
                } else {
                  return `${diffDays}日前`;
                }
              };

              return (
                <div
                  key={room.roomId}
                  className={`nav-item dm-item ${
                    selectedSpace === room.roomName ? "active" : ""
                  }`}
                  onClick={() => setSelectedSpace(room.roomName)}
                >
                  <span className="nav-icon user-avatar">
                    {room.roomName.substring(0, 2).toUpperCase()}
                  </span>
                  <div className="dm-info">
                    <span className="nav-text">{room.roomName}</span>
                    <div className="dm-preview">
                      <span className="last-message">
                        {room.lastMessage || "未入力"}
                      </span>
                      <span className="last-time">
                        {formatTime(room.lastMessageAt)}
                      </span>
                    </div>
                  </div>
                  <div className="status-indicator online"></div>
                </div>
              );
            })}

            {/* ダイレクトメッセージ作成用検索 */}
            <div className="dm-search-section">
              <input
                type="text"
                placeholder="ユーザーを検索してDM開始"
                value={dmSearchTerm}
                onChange={(e) => setDmSearchTerm(e.target.value)}
                className="dm-search-input"
              />

              {/* DM用検索結果 */}
              {dmSearchResults.length > 0 && dmSearchTerm && (
                <div className="dm-search-results">
                  {dmSearchResults
                    .filter(
                      (user) =>
                        !directRooms.some((room) =>
                          room.roomName.includes(user.nickname || user.email)
                        )
                    )
                    .map((user) => (
                      <div
                        key={user.userId}
                        className="dm-search-result-item"
                        onClick={() => {
                          createDirectRoom_func(user.userId);
                          setDmSearchTerm("");
                          setDmSearchResults([]);
                        }}
                      >
                        <span className="nav-icon user-avatar">
                          {(user.nickname || user.email)
                            .substring(0, 2)
                            .toUpperCase()}
                        </span>
                        <div className="dm-user-info">
                          <span className="dm-user-name">
                            {user.nickname || user.email}
                          </span>
                          <span className="dm-user-email">{user.email}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="main-content">
        {/* チャットヘッダー */}
        <div className="chat-header">
          <div className="chat-info">
            <h2 className="chat-title">{selectedSpace}</h2>
            <div className="chat-subtitle">
              {selectedSpace === "ホーム"
                ? "チャットルームを選択してください"
                : `${
                    userRooms.find((r) => r.roomName === selectedSpace)
                      ?.memberCount || 0
                  }人のメンバー`}
            </div>
          </div>
          <div className="chat-actions">

            {/* ユーザー情報表示 */}
            <div className="user-profile-display">
              <div className="user-avatar-display">{getDisplayAvatar()}</div>
              <div className="user-info-display">
                <div className="user-name-display">{getDisplayName()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* メッセージ一覧 */}
        <div className="messages-container">
          <div className="messages-list">
            {selectedSpace === "ホーム" ? (
              <div className="welcome-message">
                <h3>チャットへようこそ！</h3>
                <p>
                  左側のルーム一覧からチャットルームを選択するか、新しいチャットを作成してください。
                </p>
                <div className="stats">
                  <div className="stat-item">
                    <strong>{groupRooms.length}</strong>
                    <span>グループルーム</span>
                  </div>
                  <div className="stat-item">
                    <strong>{directRooms.length}</strong>
                    <span>ダイレクトメッセージ</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* メッセージリスト */}
                {messages.map((message, index) => {
                  const showAvatar =
                    index === 0 ||
                    messages[index - 1].userId !== message.userId;
                  const isLastFromUser =
                    index === messages.length - 1 ||
                    messages[index + 1]?.userId !== message.userId;

                  return (
                    <div
                      key={message.messageId || message.id}
                      className={`message-item ${
                        message.isOwn ? "own-message" : ""
                      } ${isLastFromUser ? "last-from-user" : ""} ${
                        message.isOptimistic ? "optimistic" : ""
                      }`}
                    >
                      {!message.isOwn && (
                        <div className="message-avatar user-avatar">
                          {message.avatar}
                        </div>
                      )}
                      <div className="message-content">
                        <div className="message-text">{message.content}</div>
                        <div className="message-time-inline">
                          {message.time}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* メッセージリストの最下部参照用 */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* メッセージ入力 */}
        {selectedSpace !== "ホーム" && selectedRoomId && (
          <div className="message-input-area">
            <div className="input-container">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`${selectedSpace}にメッセージを送信`}
                className="message-input"
                rows="1"
                disabled={isSendingMessage}
              />
              <div className="input-actions">
                <button
                  onClick={sendMessage}
                  className={`send-btn ${
                    newMessage.trim() && !isSendingMessage ? "active" : ""
                  }`}
                  disabled={!newMessage.trim() || isSendingMessage}
                  title={isSendingMessage ? "送信中..." : "送信"}
                >
                  {isSendingMessage ? (
                    <span className="loading-spinner-small"></span>
                  ) : (
                    ""
                  )}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = "5buno8gs9brj93apmu9tvqqp77";
    const logoutUri = "https://main.d3rgq9lalaa9gb.amplifyapp.com";
    const cognitoDomain =
      "https://ap-northeast-1ncffaodbj.auth.ap-northeast-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
  };

  if (auth.isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div>読み込み中...</div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="error-screen">
        <div className="error-message">
          エラーが発生しました: {auth.error.message}
        </div>
      </div>
    );
  }

  // 認証済みの場合はチャット画面を表示
  if (auth.isAuthenticated) {
    return <ChatScreen user={auth.user} onSignOut={signOutRedirect} />;
  }

  // 未認証の場合はログイン画面を表示
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h1>ChatApp</h1>
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
