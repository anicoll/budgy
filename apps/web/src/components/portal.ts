import { createContext, useContext } from "react";

/**
 * Where pop-ups (select lists, date pickers) should render. Inside the edit
 * sheet they must render in the sheet itself: a modal dialog makes the rest of
 * the page inert, so a list portalled to <body> can't be clicked.
 */
export const PortalContainer = createContext<Element | null>(null);

export const usePortalContainer = () => useContext(PortalContainer) ?? undefined;
