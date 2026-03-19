"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold text-accent font-display mb-2">
        Listaviva
      </h1>
      <p className="text-muted text-sm mb-8">Serviços locais em Linhares</p>

      <div className="bg-surface border border-border rounded-2xl p-8 max-w-sm w-full">
        <p className="text-4xl mb-4">📡</p>
        <h2 className="text-xl font-semibold text-primary mb-2">
          Você está sem conexão
        </h2>
        <p className="text-sm text-muted mb-6">
          Verifique sua internet e tente novamente. Páginas visitadas
          anteriormente ainda podem estar disponíveis.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Tente novamente
        </button>
      </div>
    </div>
  );
}
