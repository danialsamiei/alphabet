/**
 * @file main.tsx
 * @description Entry point for the Danial Samiei personal site.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const rootEl = document.getElementById('root');
if (rootEl === null) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
