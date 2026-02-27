import React from "react";

// Example: Prop drilling through 3 levels
// App -> UserProfile -> UserAvatar

function App({ user, theme, onLogout, isAdmin }) {
  return (
    <div className="app">
      <Header theme={theme} onLogout={onLogout} isAdmin={isAdmin} />
      <UserProfile user={user} theme={theme} isAdmin={isAdmin} />
      <Footer theme={theme} />
    </div>
  );
}

function Header({ theme, onLogout, isAdmin }) {
  return (
    <header style={{ background: theme }}>
      <Nav isAdmin={isAdmin} />
      <LogoutButton onLogout={onLogout} />
    </header>
  );
}

function Nav({ isAdmin }) {
  return (
    <nav>
      <a href="/">Home</a>
      {isAdmin && <a href="/admin">Admin</a>}
    </nav>
  );
}

function LogoutButton({ onLogout }) {
  return <button onClick={onLogout}>Logout</button>;
}

function UserProfile({ user, theme, isAdmin }) {
  return (
    <div className="profile">
      <UserAvatar user={user} theme={theme} />
      <UserDetails user={user} isAdmin={isAdmin} />
    </div>
  );
}

function UserAvatar({ user, theme }) {
  return (
    <img
      src={user.avatar}
      alt={user.name}
      style={{ borderColor: theme }}
    />
  );
}

function UserDetails({ user, isAdmin }) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {isAdmin && <span className="badge">Admin</span>}
    </div>
  );
}

function Footer({ theme }) {
  return (
    <footer style={{ background: theme }}>
      <p>&copy; 2025 My App</p>
    </footer>
  );
}

export default App;
