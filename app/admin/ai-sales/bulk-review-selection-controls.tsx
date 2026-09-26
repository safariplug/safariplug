"use client";

export function BulkReviewSelectionControls() {
  function setChecked(checked: boolean) {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(
      'input[form="bulk-prospect-approval"][name="prospect_id"]'
    )).slice(0, 50);
    for (const input of inputs) input.checked = checked;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setChecked(true)}
        className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-900"
      >
        Select first 50 quality-ready
      </button>
      <button
        type="button"
        onClick={() => setChecked(false)}
        className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800"
      >
        Clear selection
      </button>
    </div>
  );
}
