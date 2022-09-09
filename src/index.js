import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './front/App';

const reactRoot = ReactDOM.createRoot(document.getElementById('root'));
reactRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>);
