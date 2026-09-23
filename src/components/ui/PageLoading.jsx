import Spinner from './Spinner'

export default function PageLoading({ label = 'Loading…' }) {
  return (
    <div className="flex justify-center py-16">
      <Spinner label={label} size={20} />
    </div>
  )
}
