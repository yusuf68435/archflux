import { create } from "zustand";

interface CreditState {
  balance: number;
  setBalance: (n: number) => void;
  deduct: (n: number) => void;
  add: (n: number) => void;
}

export const useCreditStore = create<CreditState>()((set) => ({
  balance: 0,

  setBalance: (n) => set({ balance: n }),

  deduct: (n) =>
    set((state) => ({ balance: Math.max(0, state.balance - n) })),

  add: (n) =>
    set((state) => ({ balance: state.balance + n })),
}));
