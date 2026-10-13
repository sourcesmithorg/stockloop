import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from '@/App';
import { ToastProvider } from '@/components/ui/toast';

// Load order matters: Tailwind + tokens first, Cornerstore stylesheet second so
// the ported template CSS (the authority) wins ties against Tailwind preflight.
import './index.css';
import './styles/cornerstore.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
