"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveArticle, holdArticle } from "@/app/actions/articleReview";

export function ArticleReviewForm({ articlePath }: { articlePath: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function run(action: "approve" | "hold") {
    startTransition(async () => {
      const result =
        action === "approve"
          ? await approveArticle(articlePath, note)
          : await holdArticle(articlePath, note);
      if (!result.ok) {
        setIssues(result.issues);
        return;
      }
      setIssues([]);
      router.refresh();
    });
  }

  return (
    <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
      <label className="block text-sm font-medium text-navy" htmlFor="article-note">
        Note
      </label>
      <textarea
        id="article-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-ink"
        placeholder="Optional. A hold should say what to change."
      />
      {issues.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("approve")}
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("hold")}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
        >
          Hold
        </button>
      </div>
    </form>
  );
}
