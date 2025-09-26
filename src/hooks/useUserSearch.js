import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { searchUsers } from '../graphql/queries';

const client = generateClient();

export const useUserSearch = (currentUser) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        performSearch(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, currentUser]);

  const performSearch = async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await client.graphql({
        query: searchUsers,
        variables: {
          searchTerm: term.trim(),
          limit: 50,
        },
        authMode: "apiKey",
      });

      if (result.data.searchUsers?.items) {
        const filteredUsers = result.data.searchUsers.items.filter(
          (u) => u.userId !== currentUser?.userId
        );
        setSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
  };
};