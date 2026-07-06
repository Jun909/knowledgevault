"use client";

import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import * as Y from "yjs";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note, NoteContent } from "@/lib/types";
import { getFragment, loadYDoc, stringToColor } from "@/lib/collab";
import { useNoteCollaboration } from "@/lib/useNoteCollaboration";

const supabase = createClient();

type SavedInfo = { lastEditedBy: string; updatedAt: string };

export default function NoteEditor({
  note,
  userEmail,
  onTitleChange,
  onSaved,
}: {
  note: Note;
  userEmail: string;
  onTitleChange: (title: string) => void;
  onSaved: (info: SavedInfo) => void;
}) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("notes")
      .select("content, doc_state")
      .eq("id", note.id)
      .single()
      .then(({ data }: { data: NoteContent | null }) => {
        if (cancelled) return;
        setDoc(
          loadYDoc({
            content: data?.content ?? [],
            docState: data?.doc_state ?? null,
          })
        );
      });

    return () => {
      cancelled = true;
    };
  }, [note.id]);

  if (!doc) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-400 dark:text-zinc-600">
        <span className="animate-pulse">Loading note…</span>
      </div>
    );
  }

  return (
    <NoteEditorBody
      note={note}
      doc={doc}
      userEmail={userEmail}
      onTitleChange={onTitleChange}
      onSaved={onSaved}
    />
  );
}

function NoteEditorBody({
  note,
  doc,
  userEmail,
  onTitleChange,
  onSaved,
}: {
  note: Note;
  doc: Y.Doc;
  userEmail: string;
  onTitleChange: (title: string) => void;
  onSaved: (info: SavedInfo) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [lastEditedBy, setLastEditedBy] = useState(note.last_edited_by);
  const [saveError, setSaveError] = useState<string | null>(null);
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSaved(info: SavedInfo) {
    setSaveError(null);
    setSavedAt(new Date(info.updatedAt));
    setLastEditedBy(info.lastEditedBy);
    onSaved(info);
  }

  const { awareness } = useNoteCollaboration({
    supabase,
    noteId: note.id,
    userEmail,
    doc,
    onSaved: handleSaved,
    onError: setSaveError,
  });

  const editor = useCreateBlockNote({
    collaboration: {
      fragment: getFragment(doc),
      user: { name: userEmail, color: stringToColor(userEmail) },
      provider: { awareness },
    },
  });

  function scheduleTitleSave(titleValue: string) {
    if (titleSaveTimeout.current) clearTimeout(titleSaveTimeout.current);
    titleSaveTimeout.current = setTimeout(async () => {
      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from("notes")
        .update({
          title: titleValue,
          last_edited_by: userEmail,
          updated_at: updatedAt,
        })
        .eq("id", note.id);

      if (error) {
        setSaveError(error.message);
        return;
      }
      handleSaved({ lastEditedBy: userEmail, updatedAt });
    }, 600);
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto">
      <div className="border-b border-zinc-200/70 px-6 py-5 dark:border-zinc-800/70">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            onTitleChange(e.target.value);
            scheduleTitleSave(e.target.value);
          }}
          placeholder="Untitled"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-50 dark:placeholder:text-zinc-700"
        />
        {saveError ? (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
            Failed to save: {saveError}
          </p>
        ) : (
          (lastEditedBy || savedAt) && (
            <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              {lastEditedBy && <>Last edited by {lastEditedBy}</>}
              {lastEditedBy && savedAt && " · "}
              {savedAt && <>Saved {savedAt.toLocaleTimeString()}</>}
            </p>
          )
        )}
      </div>
      <div className="flex-1 px-2 py-4">
        <BlockNoteView editor={editor} portalElements={{ default: null }} />
      </div>
    </div>
  );
}
