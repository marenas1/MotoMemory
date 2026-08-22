"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="system-state" role="alert">
      <span className="brand-symbol" aria-hidden="true">MM</span>
      <p className="eyebrow">MotoMemory</p>
      <h1>The motorcycle view could not load.</h1>
      <p>
        Something unexpected happened while preparing the application. You can
        try loading the view again.
      </p>
      <button className="button button-primary" type="button" onClick={() => retry()}>
        Try again
      </button>
    </main>
  );
}
