import { useState, useEffect, useCallback } from "react";
import { StorageService } from "../services/storageService";
import { Expense, Category, Payee } from "../types";

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    StorageService.getAll().then((data: Expense[]) => setExpenses(data));
  }, []);

  const refresh = useCallback(async () => {
    setExpenses(await StorageService.getAll() as Expense[]);
  }, []);

  return { expenses, setExpenses, refresh };
}

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    StorageService.getCategories().then((data: Category[]) => setCategories(data));
  }, []);

  const refresh = useCallback(async () => {
    setCategories(await StorageService.getCategories() as Category[]);
  }, []);

  return { categories, setCategories, refresh };
}

export const usePayees = () => {
  const [payees, setPayees] = useState<Payee[]>([]);

  useEffect(() => {
    StorageService.getPayees().then((data: Payee[]) => setPayees(data));
  }, []);

  const refresh = useCallback(async () => {
    setPayees(await StorageService.getPayees() as Payee[]);
  }, []);

  return { payees, setPayees, refresh };
}
