import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { AMENITY_OPTIONS } from '../lib/constants'
import { getAmenityIcon, getAmenityLabel } from '../lib/amenityIcons'

const PRESET_VALUES = new Set(AMENITY_OPTIONS.map((opt) => opt.value))

export default function AmenitiesCheckboxes({ selected, onChange }) {
  const [customInput, setCustomInput] = useState('')

  // Custom entries are anything in `selected` that isn't one of the
  // checklist's own values - stored in the exact same amenities jsonb
  // array, just as free text instead of a known slug.
  const customAmenities = selected.filter((v) => !PRESET_VALUES.has(v))

  function toggle(value) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  function addCustom() {
    const text = customInput.trim()
    if (!text) return

    const alreadyPresent = selected.some((v) => v.toLowerCase() === text.toLowerCase())
    if (alreadyPresent) {
      setCustomInput('')
      return
    }

    onChange([...selected, text])
    setCustomInput('')
  }

  function removeCustom(value) {
    onChange(selected.filter((v) => v !== value))
  }

  function handleCustomKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustom()
    }
  }

  return (
    <div className="space-y-4">
      {/* Tappable pill grid, not a checkbox list - selected pills fill
          solid with the accent teal, unselected stay outlined. */}
      <div className="flex flex-wrap gap-2">
        {AMENITY_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.value)
          const Icon = getAmenityIcon(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              aria-pressed={isSelected}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium border transition-all duration-150 ${
                isSelected
                  ? 'bg-accent border-accent text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-accent/50 hover:text-accent'
              }`}
            >
              <Icon size={15} />
              {opt.label}
            </button>
          )
        })}

        {customAmenities.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => removeCustom(value)}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium bg-accent border border-accent text-white"
          >
            {getAmenityLabel(value)}
            <X size={13} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleCustomKeyDown}
          placeholder="Add a custom amenity, e.g. solar geyser"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={addCustom}
          className="flex items-center gap-1 shrink-0 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-150"
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  )
}
