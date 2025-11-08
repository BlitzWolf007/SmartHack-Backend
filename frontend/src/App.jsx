import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header.jsx'
import Login from './pages/Login.jsx'
import Spaces from './pages/Spaces.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Register from './pages/Register.jsx'
import MyBookings from './pages/MyBookings.jsx'
import BookSpace from './pages/BookSpace.jsx'

export default function App(){
  return (
    <div>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/spaces" element={<Spaces/>} />
          <Route path="/bookings" element={<MyBookings/>} />
          <Route path="/spaces/:id/book" element={<BookSpace/>} />
        </Routes>
      </main>
    </div>
  )
}
