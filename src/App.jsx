import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Browse from './pages/Browse'
import PropertyDetail from './pages/PropertyDetail'
import Login from './pages/Login'
import RegisterStudent from './pages/RegisterStudent'
import RegisterLandlord from './pages/RegisterLandlord'
import StudentDashboard from './pages/StudentDashboard'
import LandlordDashboard from './pages/LandlordDashboard'
import LandlordVerification from './pages/LandlordVerification'
import PropertyEditor from './pages/PropertyEditor'
import AdminDashboard from './pages/AdminDashboard'
import Unauthorized from './pages/Unauthorized'
import DebugConnection from './pages/DebugConnection'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="px-4 py-10">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register/student" element={<RegisterStudent />} />
          <Route path="/register/landlord" element={<RegisterLandlord />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/debug" element={<DebugConnection />} />

          {/* Role-protected */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord"
            element={
              <ProtectedRoute allowedRoles={['landlord']}>
                <LandlordDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/verification"
            element={
              <ProtectedRoute allowedRoles={['landlord']}>
                <LandlordVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/verify"
            element={
              <ProtectedRoute allowedRoles={['landlord']}>
                <LandlordVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/properties/:id"
            element={
              <ProtectedRoute allowedRoles={['landlord']}>
                <PropertyEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
