import { createContext, useContext } from "react";
import { Animated } from "react-native";

type DashboardDrawerContextValue = {
  progress: Animated.Value;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

export const DashboardDrawerContext =
  createContext<DashboardDrawerContextValue | null>(null);

export function useDashboardDrawer() {
  const context = useContext(DashboardDrawerContext);
  if (!context) {
    throw new Error(
      "useDashboardDrawer must be used within DashboardDrawerContext",
    );
  }
  return context;
}
