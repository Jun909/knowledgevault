import * as Y from "yjs";
import { BlockNoteEditor } from "@blocknote/core";
import { blocksToYDoc } from "@blocknote/core/yjs";
import type { PartialBlock } from "@blocknote/core";

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Deterministic color per user, so the same person always gets the same
// cursor color across sessions/tabs.
export function stringToColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 45%)`;
}

const FRAGMENT_NAME = "prosemirror";

export function loadYDoc({
  content,
  docState,
}: {
  content: unknown;
  docState: string | null;
}): Y.Doc {
  if (docState) {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, base64ToBytes(docState));
    return doc;
  }

  // First time this note is opened under collaborative editing: seed a new
  // Yjs doc from its existing plain-JSON blocks. A throwaway editor is only
  // needed for its schema — it's never mounted to the DOM.
  const blocks: PartialBlock[] =
    Array.isArray(content) && content.length > 0
      ? (content as PartialBlock[])
      : [{ type: "paragraph", content: "" }];
  const tempEditor = BlockNoteEditor.create();
  return blocksToYDoc(tempEditor, blocks, FRAGMENT_NAME);
}

export function getFragment(doc: Y.Doc): Y.XmlFragment {
  return doc.getXmlFragment(FRAGMENT_NAME);
}
