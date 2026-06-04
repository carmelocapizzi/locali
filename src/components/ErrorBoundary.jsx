import { Component } from 'react';

// Capture les erreurs de rendu pour éviter l'écran blanc.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // En dev, l'erreur la plus fréquente est un skew de modules pendant le HMR.
    console.warn('ErrorBoundary a capturé une erreur :', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="frame"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '40px 28px', gap: 14 }}
        >
          <div style={{ fontSize: 40 }}>🌿</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", color: 'var(--g5)', fontSize: 20 }}>Oups, un souci est survenu</h2>
          <p style={{ fontSize: 13, color: '#9a9484', lineHeight: 1.5 }}>Rechargez l'application pour continuer.</p>
          <button className="retry-btn" onClick={() => window.location.reload()}>Recharger</button>
        </div>
      );
    }
    return this.props.children;
  }
}
