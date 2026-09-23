import RegistrationForm from '../components/RegistrationForm'

export default function RegisterStudent() {
  return (
    <RegistrationForm
      role="student"
      title="Create a student account"
      roleLabel="Student"
      afterPath="/student"
    />
  )
}
