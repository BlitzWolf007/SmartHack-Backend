import { Link, NavLink } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="header">
      <nav className="nav container">
        <div className="brand">
          <img src={logo} alt="Molson Coors" />
          <h1>Workspace</h1>
        </div>
        <div className="actions">
          <NavLink to="/dashboard" className={({ isActive }) => `btn ghost ${isActive ? 'accent' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/spaces" className={({ isActive }) => `btn ghost ${isActive ? 'accent' : ''}`}>
            Spaces
          </NavLink>
          <NavLink to="/bookings" className={({ isActive }) => `btn ghost ${isActive ? 'accent' : ''}`}>
            My Bookings
          </NavLink>

          {!user && <Link to="/login" className="btn accent">Log in</Link>}
          {!user && <Link to="/register" className="btn ghost">Register</Link>}

          {user && (
            <>
              <Link to={`/profile`} className="badge blue hidden-sm">
                {user.full_name || user.email}
              </Link>
              <button className="btn warn" onClick={signOut}>Log out</button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
