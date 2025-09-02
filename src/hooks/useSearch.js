import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { searchUsers } from '../graphql/queries';

const client = generateClient();

export const useSearch = (currentUser) => {
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState([]);
  const [isModalSearching, setIsModalSearching] = useState(false);
  
  const [dmSearchTerm, setDmSearchTerm] = useState("");
  const [dmSearchResults, setDmSearchResults] = useState([]);
  const [isDmSearching, setIsDmSearching] = useState(false);

  // モーダル用のユーザー検索機能（デバッグ付き）
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
          limit: 50
        },
        authMode: 'apiKey'
      });

      if (result.data.searchUsers?.items) {
        // デバッグ: 生の検索結果を確認
        console.log('🔍 Raw search results:', result.data.searchUsers.items);
        console.log('🔍 Current user ID:', currentUser?.userId);
        
        // フィルタリング前後を確認
        const beforeFilter = result.data.searchUsers.items;
        console.log('🔍 Before filtering:', beforeFilter.length, 'users');
        
        // 現在のユーザーを除外するのみ
        const filteredUsers = result.data.searchUsers.items
          .filter(u => u.userId !== currentUser?.userId);
        
        console.log('🔍 After filtering:', filteredUsers.length, 'users');
        console.log('🔍 Filtered users:', filteredUsers);
        
        // user001が含まれているかチェック
        const user001 = filteredUsers.find(u => u.userId === 'user001');
        if (user001) {
          console.log('✅ user001 found:', user001);
        } else {
          console.log('❌ user001 not found in filtered results');
          const rawUser001 = beforeFilter.find(u => u.userId === 'user001');
          if (rawUser001) {
            console.log('📋 user001 exists in raw results:', rawUser001);
          } else {
            console.log('📋 user001 not in raw results from GraphQL');
          }
        }
        
        setModalSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error('🔍 Search error:', error);
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
          limit: 20 
        },
        authMode: 'apiKey'
      });

      if (result.data.searchUsers?.items) {
        const filteredUsers = result.data.searchUsers.items.filter(
          u => u.userId !== currentUser?.userId
        );
        setDmSearchResults(filteredUsers);
      }
    } catch (error) {
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

  return {
    modalSearchTerm,
    setModalSearchTerm,
    modalSearchResults,
    isModalSearching,
    dmSearchTerm,
    setDmSearchTerm,
    dmSearchResults,
    isDmSearching,
    searchUsersForModal,
    searchUsersForDM
  };
};