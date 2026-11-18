import React from 'react';

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro não tratado:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 32, background: '#fef7fe', textAlign: 'center', fontFamily: 'sans-serif',
      }}>
        <h2 style={{ color: '#68597a', marginBottom: 12 }}>Algo deu errado</h2>
        <p style={{ color: '#625d67', maxWidth: 360, marginBottom: 20 }}>
          Ocorreu um erro inesperado. Recarregue a página; se persistir, avise o suporte.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: '#68597a', color: '#fff', border: 'none', borderRadius: 50, padding: '12px 28px', fontWeight: 700, cursor: 'pointer' }}
        >
          Recarregar
        </button>
        <pre style={{ marginTop: 20, color: '#ba1a1a', fontSize: 11, maxWidth: 480, whiteSpace: 'pre-wrap' }}>
          {this.state.error.message}
        </pre>
      </div>
    );
  }
}
