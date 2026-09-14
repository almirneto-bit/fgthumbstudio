'use client';

import { useEffect } from 'react';

export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[FG Thumb Studio]', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f3f3f3',
        color: '#111',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <section style={{ width: 'min(520px, 100%)', padding: 24, background: '#fff', border: '1px solid #ddd' }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 20 }}>Não foi possível carregar o editor.</h1>
        <p style={{ margin: '0 0 18px', color: '#555', lineHeight: 1.5 }}>
          O FG Thumb Studio encontrou um erro no navegador. Você pode tentar carregar o editor novamente sem precisar recarregar o site inteiro.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: 0,
            padding: '10px 14px',
            background: '#111',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
