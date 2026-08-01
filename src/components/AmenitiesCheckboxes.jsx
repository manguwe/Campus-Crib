import { AMENITY_OPTIONS } from '../lib/constants'

export default function AmenitiesCheckboxes({ selected, onChange }) {
  function toggle(value) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {AMENITY_OPTIONS.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="rounded border-gray-300"
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}
