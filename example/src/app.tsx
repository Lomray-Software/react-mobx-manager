import React from 'react';
import './App.css';
import User from './pages/user';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <User userId="user-1" />
        <User userId="user-2" />
      </header>
    </div>
  );
}

export default App;
