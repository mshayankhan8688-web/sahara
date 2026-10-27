import { useEffect } from "react";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title === "SAHARA" ? "SAHARA" : `${title} · SAHARA`;
  }, [title]);
}
