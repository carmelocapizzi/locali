import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { LocaliProvider } from './context/LocaliContext';
import { UIProvider } from './context/UIContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <AuthProvider>
      <LocaliProvider>
        <UIProvider>
          <App />
        </UIProvider>
      </LocaliProvider>
    </AuthProvider>
  </ErrorBoundary>
);
