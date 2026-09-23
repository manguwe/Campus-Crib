/** Text/number/tel/email input with an inline leading icon and a clear
 * accent-teal focus ring, used across the landlord-facing forms
 * (listing editor, verification) to bring plain inputs up to the same
 * visual bar as the rest of the app's polished sections. Just a
 * lightly-styled native <input> - accepts every normal input prop. */
export default function IconInput({ icon: Icon, className = '', ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      )}
      <input
        {...props}
        className={`w-full rounded-lg border border-gray-300 bg-white ${
          Icon ? 'pl-9' : 'pl-3'
        } pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors duration-150 ${className}`}
      />
    </div>
  )
}
