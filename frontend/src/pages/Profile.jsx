import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const [form, setForm] = useState({
    username: user.full_name || '',
    email: user.email || '',
    password: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
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
        full_name: form.username,
        email: form.email,
        password: form.password || undefined,
        avatar_url: user.avatar_url
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
    <div
      className="profile container"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',             // ✅ whole screen filled
        paddingTop: '3rem',
        paddingBottom: '3rem',
        overflow: 'hidden'
      }}
    >

      {/* Vibrant, fully visible rings */}
      <div
        style={{
          position: 'absolute',
          top: '5%',
          left: '-8%',
          width: '350px',
          height: '350px',
          border: '8px solid #ECB03D', // bright yellow
          borderRadius: '50%',
          opacity: 0.6,                
          zIndex: 1
        }}
      />
       <div
        style={{
          position: 'absolute',
          top: '5%',
          left: '56%',
          width: '150px',
          height: '150px',
          border: '8px solid #ECB03D', // bright yellow
          borderRadius: '50%',
          opacity: 0.6,                
          zIndex: 1
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: '65%',
          right: '-6%',
          width: '380px',
          height: '380px',
          border: '8px solid #EB6F38', // bright orange
          borderRadius: '50%',
          opacity: 0.6,
          zIndex: 1
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '66%',
          width: '280px',
          height: '280px',
          border: '8px solid #EB6F38', // bright orange
          borderRadius: '50%',
          opacity: 0.6,
          zIndex: 1
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '60%',
          left: '70%',
          transform: 'translate(-50%, -50%)',
          width: '420px',
          height: '420px',
          border: '8px solid #4B8AB8', // bright blue
          borderRadius: '50%',
          opacity: 0.5,
          zIndex: 1
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '30%',
          transform: 'translate(-50%, -50%)',
          width: '220px',
          height: '220px',
          border: '8px solid #4B8AB8', // bright blue
          borderRadius: '50%',
          opacity: 0.5,
          zIndex: 1
        }}
      />


      {/* Title */}
      <h2 style={{ zIndex: 5, marginBottom: '1rem' }}>
        {user.full_name || user.email}'s Profile
      </h2>

      {/* Glass form centered on screen */}
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: '450px',
          width: '90%',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          borderRadius: '1rem',
          boxShadow: '0 6px 25px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.2rem',
          alignItems: 'center',
          zIndex: 5
        }}
      >

        {/* Username, Email, Password fields */}
        {['username', 'email', 'password'].map((field) => (
          <div
            key={field}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              width: '100%',
            }}
          >
            <label style={{ fontWeight: 600 }}>
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>

            <input
              type={
                field === 'password'
                  ? 'password'
                  : field === 'email'
                  ? 'email'
                  : 'text'
              }
              name={field}
              value={form[field]}
              onChange={handleChange}
              placeholder={field === 'password' ? '********' : ''}
              style={{
                padding: '0.7rem 1rem',
                borderRadius: '0.6rem',
                border: '1px solid #ccc',
                outline: 'none',
                fontSize: '1rem',
                width: '100%',
                background: 'rgba(255, 255, 255, 0.8)'
              }}
            />
          </div>
        ))}

        {error && <div className="badge yellow">{error}</div>}
        {ok && <div className="badge blue">Profile updated!</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.6rem',
            borderRadius: '0.7rem',
            fontSize: '1rem',
            background: '#4B8AB8',
            color: 'white',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: '0.2s',
          }}
        >
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
