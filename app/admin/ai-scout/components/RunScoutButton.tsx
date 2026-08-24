"use client";

import { useTransition } from "react";
import { createScoutRun } from "../runs/actions";

export default function RunScoutButton() {

  const [isPending, startTransition] = useTransition();


  function runScout() {

    startTransition(async () => {

      await createScoutRun();

      alert("AI Scout run started.");

    });

  }


  return (
    <button
      onClick={runScout}
      disabled={isPending}
      className="rounded-full bg-orange-500 px-6 py-3 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-50"
    >
      {isPending
        ? "Starting Scout..."
        : "Run Discovery Scan"}
    </button>
  );
}