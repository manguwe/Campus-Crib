import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-primary text-white mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm">
        <p className="text-white/70">
          © {new Date().getFullYear()} Campus Crib
        </p>
        <div className="flex items-center gap-5">
          <Link to="/browse" className="text-white/80 hover:text-white">
            Browse
          </Link>
          <Link to="/about" className="text-white/80 hover:text-white">
            About
          </Link>
          <Link to="/contact" className="text-white/80 hover:text-white">
            Contact
          </Link>
          <Link to="/feedback" className="text-white/80 hover:text-white">
            Feedback
          </Link>
          <Link to="/terms" className="text-white/80 hover:text-white">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  )
}
