import { Link } from 'react-router-dom'
import { Github, Globe, Mail, ShieldCheck, Camera, MessageCircle, Eye, Users, Zap } from 'lucide-react'
import { useCampuses } from '../context/CampusesContext'
import anotidaPhoto from '../assets/team-anotida-manguwe.jpg'
import taroPhoto from '../assets/team-taropafadzwanashe-kadurira.jpg'

const TEAM = [
  {
    name: 'Anotida Manguwe',
    role: 'Founder & Developer',
    handle: 'timtiml',
    bio: 'Building Campus Crib to make finding safe, affordable student accommodation easier. ICT student passionate about technology, software development, and innovation.',
    photo: anotidaPhoto,
    github: 'https://github.com/manguwe',
    portfolio: 'https://timtiml-website.vercel.app',
    email: 'timtimlinn@gmail.com',
  },
  {
    name: 'Taropafadzwanashe Kadurira',
    role: 'Brand Designer',
    bio: 'Creative web designer and developer behind Global Web Co, focused on building clean digital experiences, branding, and user-friendly web interfaces. Contributed to Campus Crib through its branding, logo, and web pages.',
    photo: taroPhoto,
    github: '',
    portfolio: '',
    email: 'taropafadzwanashekadurira@gmail.com',
  },
]

const HOW_WE_HELP = [
  {
    icon: ShieldCheck,
    title: 'Verified, always',
    body: 'Every landlord submits ID and proof of ownership before they can list a single room. No exceptions.',
  },
  {
    icon: Camera,
    title: 'See it before you visit',
    body: "Photos, video walkthroughs, and a map pin for every listing, so you know exactly what you're looking at.",
  },
  {
    icon: MessageCircle,
    title: 'Talk directly',
    body: 'No middleman, no waiting. Reach out to landlords straight away by call, SMS, or WhatsApp.',
  },
]

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Trust',
    body: "Verification isn't a checkbox. It's the whole point.",
  },
  {
    icon: Eye,
    title: 'Transparency',
    body: 'Real prices, real photos, real locations. No surprises.',
  },
  {
    icon: Users,
    title: 'Community',
    body: 'Reviews from real tenants help the next student choose well.',
  },
  {
    icon: Zap,
    title: 'Simplicity',
    body: 'Finding a home near campus should take minutes, not weeks.',
  },
]

export default function About() {
  const { campuses } = useCampuses()
  return (
    <div className="space-y-20">
      {/* 1. Hero */}
      <section className="max-w-2xl mx-auto text-center pt-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary leading-tight">
          Finding student housing shouldn't feel like a gamble.
        </h1>
        <p className="text-gray-600 mt-4 leading-relaxed">
          Campus Crib connects students with verified landlords near campus — real listings, real
          locations, and a direct line to the person holding the keys.
        </p>
      </section>

      {/* 2. Our story */}
      <section className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-primary text-center mb-6">We've been there.</h2>
        <div className="space-y-4 text-gray-600 leading-relaxed">
          <p>
            Every new semester, the same scramble starts again. A WhatsApp forward here, a Facebook
            post there, a phone number scribbled on a torn piece of paper. Prices that don't match
            what's actually available. Rooms that look nothing like their photos — if there were
            photos at all.
          </p>
          <blockquote className="border-l-4 border-accent pl-4 py-1 text-lg font-medium text-gray-900">
            We built Campus Crib because that search deserved better.
          </blockquote>
          <p>
            Not a fix for one bad experience, but a proper answer: a single place where every
            landlord is verified, every listing is reviewed, and every student can search with
            confidence instead of crossing their fingers.
          </p>
        </div>
      </section>

      {/* 3. Our mission - highlighted band */}
      <section className="bg-primary rounded-3xl py-14 px-6 sm:px-10 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug">
            To make finding safe, verified student housing as simple as it should have always been.
          </h2>
          <p className="text-white/80 mt-4 leading-relaxed">
            No more guessing games. No more wasted trips. Just a clear, trustworthy way to find a
            place near campus — and for landlords, a direct line to the students actually looking.
          </p>
        </div>
      </section>

      {/* 4. How we help */}
      <section className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-primary text-center mb-8">How we help</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {HOW_WE_HELP.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center"
            >
              <div className="inline-flex bg-primary/10 rounded-full p-3 mb-3">
                <item.icon size={20} className="text-primary" />
              </div>
              <p className="font-semibold text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Where we operate */}
      <section className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-primary mb-5">Built around your campus.</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {campuses.map((campus) => (
            <span
              key={campus.id}
              className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
            >
              {campus.name}
            </span>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-5 leading-relaxed">
          Every listing is mapped and distance-checked against your campus, so you always know how
          far home really is — before you commit to anything.
        </p>
      </section>

      {/* 6. Our values */}
      <section className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-primary text-center mb-8">Our values</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {VALUES.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center"
            >
              <div className="inline-flex bg-primary/10 rounded-full p-2.5 mb-2.5">
                <item.icon size={18} className="text-primary" />
              </div>
              <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Team */}
      <section className="max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-primary text-center mb-6">Team</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {TEAM.map((member, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center"
            >
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-20 h-20 rounded-full object-cover mx-auto mb-3"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gray-100 mx-auto mb-3" />
              )}
              <p className="font-medium text-gray-900">{member.name}</p>
              <p className="text-xs text-accent font-medium mt-0.5">{member.role}</p>
              {member.handle && <p className="text-xs text-gray-400 mt-0.5">@{member.handle}</p>}
              <p className="text-sm text-gray-500 mt-2">{member.bio}</p>

              {(member.github || member.portfolio || member.email) && (
                <div className="flex items-center justify-center gap-3 mt-3">
                  {member.github && (
                    <a
                      href={member.github}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${member.name}'s GitHub`}
                      className="text-gray-400 hover:text-primary"
                    >
                      <Github size={17} />
                    </a>
                  )}
                  {member.portfolio && (
                    <a
                      href={member.portfolio}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${member.name}'s portfolio`}
                      className="text-gray-400 hover:text-primary"
                    >
                      <Globe size={17} />
                    </a>
                  )}
                  {member.email && (
                    <a
                      href={`mailto:${member.email}`}
                      aria-label={`Email ${member.name}`}
                      className="text-gray-400 hover:text-primary"
                    >
                      <Mail size={17} />
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Team tagline */}
      <div className="max-w-md mx-auto text-center">
        <div className="w-12 h-px bg-gray-200 mx-auto mb-4" />
        <p className="text-base font-medium text-gray-700">
          Proudly made by students, for students.
        </p>
      </div>

      {/* 8. Closing CTA */}
      <section className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-primary mb-6">Ready to find your crib?</h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/browse"
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            Search Listings
          </Link>
          <Link
            to="/register/landlord"
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors duration-150"
          >
            List Your Property
          </Link>
        </div>
      </section>
    </div>
  )
}
