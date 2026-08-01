import RegistrationForm from '../components/RegistrationForm'

export default function RegisterLandlord() {
  return (
    <RegistrationForm
      role="landlord"
      title="Create a landlord account"
      roleLabel="Landlord"
      afterPath="/landlord"
    />
  )
}
