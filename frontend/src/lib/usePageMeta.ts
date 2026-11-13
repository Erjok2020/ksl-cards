import { useEffect } from "react";

const SITE = "KSL Cards";

/** Sets a unique <title> and <meta name="description"> for the current page. */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [title, description]);
}
