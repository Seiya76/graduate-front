import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { searchUsers } from '../graphql/queries';

const client = generateClient();

export const useUserSearch = (currentUser, debounceDelay = 500) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // ユーザー検索実行
  const performSearch = async (term, limit = 50) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await client.graphql({
        query: searchUsers,
        variables: {
          searchTerm: term.trim(),
          limit,
        },
        authMode: "apiKey",
      });

      if (result.data.searchUsers?.items) {
        // 現在のユーザーを除外してフィルタリング
        const filteredUsers = result.data.searchUsers.items.filter(
          (u) => u.userId !== currentUser?.userId
        );
        setResults(filteredUsers);
      }
    } catch (error) {
      console.error("Error searching users:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // デバウンス処理
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        performSearch(searchTerm);
      } else {
        setResults([]);
      }
    }, debounceDelay);

    return () => clearTimeout(timer);
  }, [searchTerm, currentUser, debounceDelay]);

  // 検索クリア
  const clearSearch = () => {
    setSearchTerm("");
    setResults([]);
  };

  // 即座に検索実行（デバウンスなし）
  const searchImmediately = (term, limit) => {
    performSearch(term, limit);
  };

  return {
    searchTerm,
    setSearchTerm,
    results,
    isSearching,
    clearSearch,
    searchImmediately,
  };
};