"use client";

export function SentryTestButton() {
  return (
    <button
      onClick={() => {
        throw new Error("Sentry Frontend Error Test");
      }}
      className="fixed bottom-2 right-2 z-50 p-2 text-[10px] text-stone-400 opacity-20 hover:opacity-100 transition-opacity bg-transparent outline-none border-none cursor-pointer"
      title="Trigger Sentry Error"
    >
      test sentry
    </button>
  );
}
