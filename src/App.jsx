import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { trackPageView, pauseTracking, resumeTracking } from './lib/pageViewTracking'
import { resolveCountryOnce } from './lib/visitorSession'
import Home from './pages/Home'
import Browse from './pages/Browse'
import PropertyDetail from './pages/PropertyDetail'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import RegisterStudent from './pages/RegisterStudent'
import RegisterLandlord from './pages/RegisterLandlord'
import StudentDashboard from './pages/StudentDashboard'
import Favourites from './pages/Favourites'
import LandlordDashboard from './pages/LandlordDashboard'
import LandlordVerification from './pages/LandlordVerification'
import PropertyEditor from './pages/PropertyEditor'
import AdminDashboard from './pages/AdminDashboard'
import About from './pages/About'
import Contact from './pages/Contact'
import Feedback from './pages/Feedback'
import Terms from './pages/Terms'
import Unauthorized from './pages/Unauthorized'
import Suspended from './pages/Suspended'
import DebugConnection from './pages/DebugConnection'

function App() {
  const location = useLocation()

  // Resolves the visitor's country once per browser session (cached in
  // localStorage) - see visitorSession.js. Fire-and-forget, never blocks
  // rendering.
  useEffect(() => {
    resolveCountryOnce()
  }, [])

  // Logs a page_view row for the page just left every time the route
  // changes, with best-effort time-on-page attached (pageViewTracking.js).
  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])

  // Also flush/resume around tab visibility and unload, so time spent
  // on the current page before closing the tab isn't lost entirely.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden') pauseTracking()
      else resumeTracking()
    }
    window.addEventListener('beforeunload', pauseTracking)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('beforeunload', pauseTracking)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ScrollToTop />
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/register/student" element={<RegisterStudent />} />
          <Route path="/register/landlord" element={<RegisterLandlord />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/suspended" element={<Suspended />} />
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
            path="/favourites"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <Favourites />
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
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  )
}

export default App
