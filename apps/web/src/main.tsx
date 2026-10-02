import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/tokens.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró #root');
createRoot(root).render(
  <StrictMode>
    <p>Gemelo Digital</p>
  </StrictMode>,
);
