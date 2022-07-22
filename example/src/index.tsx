import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Manager, StoreManagerProvider } from '@lomray/react-mobx-manager';
import App from './app';

const storeManager = new Manager();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <StoreManagerProvider storeManager={storeManager} shouldInit>
      <App />
    </StoreManagerProvider>
  </React.StrictMode>,
);
