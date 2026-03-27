import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { ensurePresetMigration } from './ui/persistence/migrateToSupabase';
import './index.css';

// Kick off one-time migration of localStorage presets/loops to Supabase
ensurePresetMigration().catch(err =>
  console.error('Preset migration failed:', err)
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
