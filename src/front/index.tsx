import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './component/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Cannot render react: Container not found');
}
const reactRoot = ReactDOM.createRoot(container);
reactRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>);
