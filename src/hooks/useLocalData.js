import { useState, useEffect, useCallback } from "react";
import { StorageService } from "../services/storageService";

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    StorageService.getAll().then(setExpenses);
  }, []);

  const refresh = useCallback(async () => {
    setExpenses(await StorageService.getAll());
  }, []);

  return { expenses, setExpenses, refresh };
}

export function useCategories() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    StorageService.getCategories().then(setCategories);
  }, []);

  const refresh = useCallback(async () => {
    setCategories(await StorageService.getCategories());
  }, []);

  return { categories, setCategories, refresh };
}
