import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';
import { startUpdateChecks } from './lib/update.ts';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
startUpdateChecks();
