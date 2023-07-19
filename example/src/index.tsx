import { ConsistentSuspenseProvider } from '@lomray/consistent-suspense';
import { Manager, StoreManagerProvider } from '@lomray/react-mobx-manager';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './app';

const storeManager = new Manager();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <ConsistentSuspenseProvider>
      <StoreManagerProvider storeManager={storeManager} shouldInit>
        <App />
      </StoreManagerProvider>
    </ConsistentSuspenseProvider>
  </React.StrictMode>,
);
