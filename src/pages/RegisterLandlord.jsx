import { Link } from 'react-router-dom'
import RegistrationForm from '../components/RegistrationForm'
import { useAgentsProgram } from '../hooks/useAgentsProgram'

export default function RegisterLandlord() {
  const { enabled } = useAgentsProgram()

  return (
    <>
      <RegistrationForm
        role="landlord"
        title="Create a landlord account"
        roleLabel="Landlord"
        afterPath="/landlord"
      />
      {enabled && (
        <p className="text-center text-sm text-gray-500 mt-4">
          Do you list houses on behalf of owners?{' '}
          <Link to="/register/agent" className="text-accent underline">Register as an agent</Link>
        </p>
      )}
    </>
  )
}
