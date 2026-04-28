export default function BottomNav({ onLogout }) {
  return (
    <nav className="bottom-nav">
      <button className="nav-btn active">
        <span className="nav-i">📋</span>
        <span className="nav-l">Jobs</span>
      </button>
      <button className="nav-btn" onClick={onLogout}>
        <span className="nav-i">↩</span>
        <span className="nav-l">Sign Out</span>
      </button>
    </nav>
  );
}
