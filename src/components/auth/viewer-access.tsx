"use client";

import { createContext, useContext } from "react";
import { noAccess, type ViewerAccess } from "@/lib/access";

const ViewerAccessContext = createContext<ViewerAccess>(noAccess);

export function ViewerAccessProvider({
  value,
  children,
}: {
  value: ViewerAccess;
  children: React.ReactNode;
}) {
  return <ViewerAccessContext.Provider value={value}>{children}</ViewerAccessContext.Provider>;
}

export function useViewerAccess() {
  return useContext(ViewerAccessContext);
}
