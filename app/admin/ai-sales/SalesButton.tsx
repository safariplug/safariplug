"use client";

import { useState } from "react";

export default function SalesButton() {

  const [loading, setLoading] = useState(false);


  async function runScout() {

    setLoading(true);


    await fetch(
      "/api/admin/sales/run",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          city: "Nairobi",
          category: "Hotels",
        }),
      }
    );


    setLoading(false);

    window.location.reload();

  }



  return (

    <button
      onClick={runScout}
      disabled={loading}
      className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white"
    >

      {loading
        ? "Running Sales Scout..."
        : "Run Sales Scout"}

    </button>

  );

}