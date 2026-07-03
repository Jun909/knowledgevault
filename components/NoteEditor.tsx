"use client";

import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import type { Block, PartialBlock } from "@blocknote/core";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note } from "@/lib/types";

const supabase = createClient();

function asBlocks(content: unknown): PartialBlock[] {
  return Array.isArray(content) && content.length > 0
    ? (content as PartialBlock[])
    : [{ type: "paragraph", content: "" }];
}

export default function NoteEditor({ note }: { note: Note }) {
  const editor = useCreateBlockNote({ initialContent: asBlocks(note.content) });
  const [title, setTitle] = useState(note.title);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(note.title);
    editor.replaceBlocks(editor.document, asBlocks(note.content));
    // Only re-sync when switching to a different note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  function scheduleSave(blocks: Block[], titleValue: string) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      await supabase
        .from("notes")
        .update({
          content: blocks,
          title: titleValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", note.id);
      setSavedAt(new Date());
    }, 600);
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto">
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave(editor.document, e.target.value);
          }}
          placeholder="Untitled"
          className="w-full bg-transparent text-2xl font-semibold text-zinc-900 outline-none dark:text-zinc-50"
        />
        {savedAt && (
          <p className="mt-1 text-xs text-zinc-400">
            Saved {savedAt.toLocaleTimeString()}
          </p>
        )}
      </div>
      <div className="flex-1 px-2 py-4">
        <BlockNoteView
          editor={editor}
          onChange={() => scheduleSave(editor.document, title)}
        />
      </div>
    </div>
  );
}
