import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

export default function PasswordInput({ id, value, onChange, placeholder = 'Enter your password', autoComplete, required = true, minLength }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 pr-12 text-sm text-ink placeholder:text-gray-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
