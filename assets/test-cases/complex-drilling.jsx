import React from "react";

// Complex prop drilling: multiple props across multiple branches

function AppContainer({
  user,
  theme,
  isAuthenticated,
  onLogout,
  notifications,
  onNotificationDismiss,
  isAdmin,
}) {
  return (
    <div>
      <TopBar
        user={user}
        theme={theme}
        isAuthenticated={isAuthenticated}
        onLogout={onLogout}
        notifications={notifications}
        onNotificationDismiss={onNotificationDismiss}
      />
      <MainContent
        user={user}
        theme={theme}
        isAdmin={isAdmin}
      />
      <BottomBar theme={theme} />
    </div>
  );
}

function TopBar({ user, theme, isAuthenticated, onLogout, notifications, onNotificationDismiss }) {
  return (
    <header style={{ background: theme }}>
      <UserMenu user={user} isAuthenticated={isAuthenticated} onLogout={onLogout} />
      <NotificationBell notifications={notifications} onNotificationDismiss={onNotificationDismiss} />
    </header>
  );
}

function UserMenu({ user, isAuthenticated, onLogout }) {
  return (
    <div>
      {isAuthenticated ? <span>{user.name}</span> : <span>Guest</span>}
      {isAuthenticated && <button onClick={onLogout}>Logout</button>}
    </div>
  );
}

function NotificationBell({ notifications, onNotificationDismiss }) {
  return (
    <div>
      <span>{notifications.length} notifications</span>
      <button onClick={onNotificationDismiss}>Dismiss</button>
    </div>
  );
}

function MainContent({ user, theme, isAdmin }) {
  return (
    <main>
      <ProfileSection user={user} isAdmin={isAdmin} />
      <ContentArea theme={theme} />
    </main>
  );
}

function ProfileSection({ user, isAdmin }) {
  return (
    <section>
      <h2>{user.name}</h2>
      {isAdmin && <p>Admin Access</p>}
    </section>
  );
}

function ContentArea({ theme }) {
  return <div style={{ color: theme }}>Content here</div>;
}

function BottomBar({ theme }) {
  return <footer style={{ background: theme }}>Footer</footer>;
}

export default AppContainer;
