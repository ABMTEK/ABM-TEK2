import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ThemeState {
    isDark: boolean;
    toggle: () => void;
    setDark: (value: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            isDark: false,
            toggle: () => set((s) => ({ isDark: !s.isDark })),
            setDark: (value: boolean) => set({ isDark: value }),
        }),
        {
            name: 'theme-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
