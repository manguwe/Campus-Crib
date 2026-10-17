import { Link } from 'react-router-dom'
import RegistrationForm from '../components/RegistrationForm'
import PageLoading from '../components/ui/PageLoading'
import { useAgentsProgram } from '../hooks/useAgentsProgram'

export default function RegisterAgent() {
  const { enabled, loading } = useAgentsProgram()

  if (loading) return <PageLoading label="Loading…" />

  if (!enabled) {
    return (
      <div className="login-panel login-panel-aurora max-w-md mx-auto rounded-2xl p-6 text-center">
        <h2 className="text-lg font-semibold text-primary mb-2">Agent program</h2>
        <p className="text-sm text-gray-600">
          We are not accepting new agents right now. Please check back soon.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center text-sm">
          <Link to="/register/landlord" className="text-accent underline">Register as a landlord</Link>
          <span className="hidden sm:inline text-gray-300">|</span>
          <Link to="/register/student" className="text-accent underline">Register as a student</Link>
        </div>
      </div>
    )
  }

  return (
    <RegistrationForm
      role="landlord"
      accountType="agent"
      title="Create an agent account"
      roleLabel="Agent"
      afterPath="/landlord"
    />
  )
}
