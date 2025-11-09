import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const [form, setForm] = useState({
    username: user.full_name || '',
    email: user.email || '',
    password: '',
    autoBook: false,
    autoBookHour: '08:00',
    emailOption: 'Always',
    emailOffices: [],
    darkMode: false
  });

  const offices = [
    'Desks',
    'Bubbles',
    'Team Meetings (Small)',
    'Team Meetings (Big)',
    'Beer Point',
    'Wellbeing'
  ];

  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleOfficeToggle = (office) => {
    setForm(prev => {
      const updatedOffices = prev.emailOffices.includes(office)
        ? prev.emailOffices.filter(o => o !== office)
        : [...prev.emailOffices, office];

      const emailOption = updatedOffices.length === offices.length
        ? 'Always'
        : 'Before Some Bookings';

      return { ...prev, emailOffices: updatedOffices, emailOption };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password && form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await updateUser({
  full_name: form.username,   // 👈 convert username → full_name
  email: form.email,
  password: form.password || undefined,
  avatar_url: user.avatar_url, // keep same if needed
});
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div>Please log in to see your profile.</div>;

  return (
    <div className="profile container">
      <h2>{user.full_name || user.email}'s Profile</h2>

      <div
        className="profile-grid"
        style={{ display: 'flex', gap: '2rem', marginTop: '1rem', alignItems: 'flex-start' }}
      >
        {/* Left column */}
        <div style={{ minWidth: '150px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <img
            src={user.avatar || '/default-avatar.png'}
            alt="Profile"
            style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <label className="btn ghost" style={{ display: 'block', cursor: 'pointer' }}>
            Upload Avatar
            <input type="file" onChange={(e) => console.log('Upload avatar:', e.target.files[0])} style={{ display: 'none' }} />
          </label>

          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem', color: '#fff' }}>
              🥈 Silver Medal
            </div>
            <div style={{ fontSize: '0.875rem', color: '#fff', marginBottom: '0.5rem' }}>
              ({user.full_name} has discovered more than 65% of desks)
            </div>
            <button className="btn accent" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }} onClick={() => setShowModal(true)}>
              See Progress
            </button>
          </div>
        </div>

        {/* Right column */}
        <form
          onSubmit={handleSubmit}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '450px' }}
        >
          {/* Username, Email, Password */}
          {['username', 'email', 'password'].map((field) => (
            <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label className="label">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                name={field}
                value={form[field]}
                onChange={handleChange}
                className="input accent"
                placeholder={field === 'password' ? '********' : ''}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #ccc', outline: 'none', fontSize: '1rem', width: '100%' }}
              />
            </div>
          ))}

          {error && <div className="badge yellow">{error}</div>}
          {ok && <div className="badge blue">Profile updated!</div>}

          {/* Auto-book desk */}
          <div>
            <label className="label">
              <input type="checkbox" name="autoBook" checked={form.autoBook} onChange={handleChange} style={{ marginRight: '0.5rem' }} />
              Auto-book personal desk
            </label>
            {form.autoBook && (
              <select name="autoBookHour" value={form.autoBookHour} onChange={handleChange} className="input accent" style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ccc', width: '100%' }}>
                {hours.map(hour => <option key={hour} value={hour}>{hour}</option>)}
              </select>
            )}
          </div>

          {/* Email preferences */}
          <div>
            <label className="label">Receive Emails</label>
            <div className="email-options" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '180px' }}>
                {['Always', 'Before Some Bookings', 'Never'].map(option => (
                  <label key={option} className="btn ghost" style={{ borderRadius: '2rem', padding: '0.5rem 1rem' }}>
                    <input type="radio" name="emailOption" value={option} checked={form.emailOption === option} onChange={handleChange} style={{ marginRight: '0.5rem' }} />
                    {option}
                  </label>
                ))}
              </div>
              {form.emailOption === 'Before Some Bookings' && (
                <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '0.5rem', padding: '0.75rem', flex: 1 }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Booking Types</strong>
                  {offices.map(office => (
                    <label key={office} className="btn ghost" style={{ display: 'block', marginBottom: '0.25rem' }}>
                      <input type="checkbox" checked={form.emailOffices.includes(office)} onChange={() => handleOfficeToggle(office)} style={{ marginRight: '0.5rem' }} />
                      {office}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dark Mode */}
          <div>
            <label className="btn ghost">
              <input type="checkbox" name="darkMode" checked={form.darkMode} onChange={handleChange} style={{ marginRight: '0.5rem' }} />
              Dark Mode
            </label>
          </div>

          <button type="submit" className="btn accent" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
        </form>
      </div>

      {/* Modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: '2rem', borderRadius: '0.5rem', minWidth: '300px', textAlign: 'center' }}>
            <h3>{user.full_name}'s Achievements</h3>
            <p>The map with the desks the user stayed at is here.</p>
          </div>
        </div>
      )}
    </div>
  );
}
