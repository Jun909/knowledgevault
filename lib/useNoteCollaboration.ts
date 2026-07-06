"use client";

import { useEffect, useState } from "react";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import type { SupabaseClient } from "@supabase/supabase-js";
import { base64ToBytes, bytesToBase64, stringToColor } from "./collab";

const REMOTE = "remote";
const SAVE_DEBOUNCE_MS = 1500;

export function useNoteCollaboration({
  supabase,
  noteId,
  userEmail,
  doc,
  onSaved,
  onError,
}: {
  supabase: SupabaseClient;
  noteId: string;
  userEmail: string;
  doc: Y.Doc;
  onSaved: (info: { lastEditedBy: string; updatedAt: string }) => void;
  onError?: (message: string) => void;
}) {
  const [awareness] = useState(() => new Awareness(doc));

  useEffect(() => {
    awareness.setLocalState({
      user: { name: userEmail, color: stringToColor(userEmail) },
    });

    const channel = supabase.channel(`note-${noteId}`);
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;

    // channel.send() silently (and, per a recent supabase-js deprecation
    // warning, no longer silently) falls back to REST when the websocket
    // hasn't finished joining yet — e.g. the very first awareness/doc update
    // right after mount. Route explicitly instead of relying on that fallback.
    function sendBroadcast(event: string, payload: Record<string, unknown>) {
      if (channel.state === "joined") {
        channel.send({ type: "broadcast", event, payload });
      } else {
        channel.httpSend(event, payload);
      }
    }

    function scheduleSave() {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        const updatedAt = new Date().toISOString();
        const { error } = await supabase
          .from("notes")
          .update({
            doc_state: bytesToBase64(Y.encodeStateAsUpdate(doc)),
            last_edited_by: userEmail,
            updated_at: updatedAt,
          })
          .eq("id", noteId);
        if (error) {
          onError?.(error.message);
        } else {
          onSaved({ lastEditedBy: userEmail, updatedAt });
        }
      }, SAVE_DEBOUNCE_MS);
    }

    function handleDocUpdate(update: Uint8Array, origin: unknown) {
      if (origin === REMOTE) return;
      sendBroadcast("yjs-update", { update: bytesToBase64(update) });
      scheduleSave();
    }

    function handleAwarenessUpdate({
      added,
      updated,
      removed,
    }: {
      added: number[];
      updated: number[];
      removed: number[];
    }) {
      const changed = added.concat(updated, removed);
      sendBroadcast("awareness-update", {
        update: bytesToBase64(encodeAwarenessUpdate(awareness, changed)),
      });
    }

    doc.on("update", handleDocUpdate);
    awareness.on("update", handleAwarenessUpdate);

    channel
      .on("broadcast", { event: "yjs-update" }, ({ payload }) => {
        Y.applyUpdate(doc, base64ToBytes(payload.update), REMOTE);
      })
      .on("broadcast", { event: "awareness-update" }, ({ payload }) => {
        applyAwarenessUpdate(awareness, base64ToBytes(payload.update), REMOTE);
      })
      .on("broadcast", { event: "sync-request" }, () => {
        sendBroadcast("yjs-update", { update: bytesToBase64(Y.encodeStateAsUpdate(doc)) });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          sendBroadcast("sync-request", {});
        }
      });

    return () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      doc.off("update", handleDocUpdate);
      awareness.off("update", handleAwarenessUpdate);
      // Broadcasts local-state-removal to peers (via the update event above)
      // while the channel is still open, then tears down internal timers.
      awareness.destroy();
      supabase.removeChannel(channel);
    };
    // Deps intentionally omitted: this whole tree remounts (via `key={note.id}`
    // in Workspace) whenever noteId/doc/userEmail would change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  return { awareness };
}
