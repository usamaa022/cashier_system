import { useState, useEffect } from 'react';

export function useLocalStorage() {
  const getItem = (key) => {
    if (typeof window !== 'undefined') {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    }
    return null;
  };

  const setItem = (key, value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  const removeItem = (key) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  };

  return { getItem, setItem, removeItem };
}
