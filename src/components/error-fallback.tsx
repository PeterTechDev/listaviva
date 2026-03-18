"use client";

import { useEffect } from "react";

export default function ErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h1 className="text-xl font-bold text-primary mb-2">
        Algo deu errado
      </h1>
      <p className="text-muted mb-6 max-w-sm">
        Ocorreu um erro inesperado. Tente novamente ou volte para a página
        inicial.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={reset}
          className="px-4 py-2 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover transition-colors"
        >
          Tentar novamente
        </button>
        <a
          href="/"
          className="px-4 py-2 bg-surface border border-border text-muted rounded-xl font-medium hover:border-accent hover:text-accent transition-colors"
        >
          Página inicial
        </a>
      </div>
    </div>
  );
}
