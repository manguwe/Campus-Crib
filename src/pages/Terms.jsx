// Content sourced from the Terms of Service & Privacy Notice document.
// Edit the SECTIONS array below to update the wording - the page itself
// just renders whatever's here, following the same heading/paragraph/
// list conventions as About.jsx and Contact.jsx.
const SECTIONS = [
  {
    heading: '1. What This Platform Does',
    paragraphs: [
      'Campus Crib is an online marketplace that helps university students find boarding houses and rooms near their campus, and helps landlords list verified accommodation to students. The Platform does not own, manage, or lease any property listed on it — it is a listings and discovery service only. Any agreement to rent a room is made directly between a student and a landlord, outside of the Platform.',
    ],
  },
  {
    heading: '2. Who Can Use the Platform',
    list: [
      'Students: currently enrolled students at a supported university (e.g. UNZA, Eden University) may register a student account.',
      'Landlords: property owners or authorised agents who wish to list boarding houses may register a landlord account, subject to verification (see Section 5).',
    ],
    paragraphs: [
      'You must provide accurate information when registering. You may not create an account on behalf of someone else, or misrepresent your identity, role, or the property you are listing.',
    ],
  },
  {
    heading: '3. Acceptance of These Terms',
    paragraphs: [
      'By ticking "I agree to the Terms of Service and Privacy Notice" during registration, you confirm that you have read, understood, and agree to be bound by this document. If you do not agree, please do not register or use the Platform.',
    ],
  },
  {
    heading: '4. Our Commitment to Your Privacy',
    intro: 'We take the protection of your personal information seriously. Specifically:',
    list: [
      'We only collect the information needed to operate the Platform: your name, email address, phone number, role (student or landlord), and — for landlords — property and contact details for listings you choose to publish.',
      'We do not sell, rent, or trade your personal information to any third party, advertiser, or data broker, for any purpose.',
      "Your personal contact details (phone number, email) are never displayed publicly on the Platform without your action. Students can only see a landlord's listed contact numbers for a property that landlord has chosen to make public on that listing. A landlord cannot see a student's personal details unless that student contacts them directly.",
      'Only Platform administrators can view full account details (e.g. for landlord verification, moderation, or resolving a reported problem), and only for that purpose.',
      'We do not use your data for advertising, profiling, or any purpose beyond running the marketplace (matching students with listings, enabling contact, verification, and basic safety moderation).',
      'Account activity (such as searches, page views, and key actions) may be logged internally to help us detect bugs, abuse, and improve the Platform. This activity data is used for those purposes only and is not shared externally.',
      'We also collect anonymous, aggregate visit data (such as which pages are viewed, roughly how long visitors spend on them, and their approximate country) to understand how many people use the Platform and improve it — including from visitors who are just browsing and never create an account. This data is not tied to your identity, is never sold, and is not used to profile individual visitors.',
    ],
  },
  {
    heading: '5. Landlord Verification',
    paragraphs: [
      'To reduce the risk of fraudulent or fake listings, landlord accounts and their listings go through a verification step by Platform administrators before becoming visible to students. Verification is a good-faith safety measure, not a guarantee — students should still exercise their own judgement, ask questions, and, where possible, view a property in person before making any payment.',
    ],
  },
  {
    heading: '6. Account Security',
    list: [
      'You are responsible for keeping your password confidential and for all activity that occurs under your account.',
      'Use a strong, unique password, and contact us immediately if you believe your account has been accessed without your permission.',
      'We store passwords securely (hashed, never in plain text) and use industry-standard practices to protect data in transit and at rest.',
    ],
  },
  {
    heading: '7. Acceptable Use',
    intro: 'You agree not to:',
    list: [
      'Post false, misleading, or fraudulent listings or information;',
      'Use the Platform to harass, threaten, or discriminate against any other user;',
      "Attempt to access another user's account or data without authorisation;",
      'Scrape, copy, or republish Platform content or listings without permission;',
      'Use the Platform for any unlawful purpose.',
    ],
    paragraphs: [
      'We may suspend or terminate accounts that violate these Terms, at our discretion, to protect the safety and integrity of the Platform for all users.',
    ],
  },
  {
    heading: "8. Listings Are the Landlord's Responsibility",
    paragraphs: [
      'Landlords are solely responsible for the accuracy of the information, photos, and pricing in their listings. The Platform does not inspect properties and makes no guarantee as to the condition, safety, legality, or availability of any listed accommodation. Any dispute regarding a booking or tenancy is between the student and the landlord.',
    ],
  },
  {
    heading: '9. No Liability for Transactions',
    paragraphs: [
      'The Platform is a discovery and listings tool. We are not a party to, and accept no liability for, any rental agreement, payment, or dispute between a student and a landlord. Users are encouraged to verify details independently and exercise reasonable caution, as with any other rental arrangement.',
    ],
  },
  {
    heading: '10. Changes to These Terms',
    paragraphs: [
      'We may update these Terms from time to time, for example as the Platform adds new features. Where changes are significant, we will make reasonable efforts to notify users (e.g. via a notice on the Platform). Continued use of the Platform after changes take effect constitutes acceptance of the updated Terms.',
    ],
  },
  {
    heading: '11. Governing Law',
    paragraphs: [
      "These Terms are governed by the laws of the Republic of Zambia, including the Data Protection Act, 2021, so far as applicable to the Platform's processing of personal information.",
    ],
  },
  {
    heading: '12. Contact',
    paragraphs: ['Questions about these Terms or how your data is handled can be sent via the Platform\'s Contact page.'],
  },
]

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <section className="text-center">
        <h1 className="text-3xl font-bold text-primary">Terms of Service &amp; Privacy Notice</h1>
        <p className="text-sm text-gray-400 mt-2">Last updated: August 2026</p>
        <p className="text-gray-600 mt-4 leading-relaxed">
          This document sets out the terms you agree to by creating an account on Campus Crib
          ("the Platform"), and explains how we handle your personal information. Please read it
          before registering.
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <h2 className="text-lg font-semibold text-primary mb-2">{section.heading}</h2>
            {section.intro && <p className="text-gray-600 leading-relaxed mb-2">{section.intro}</p>}
            {section.list && (
              <ul className="list-disc pl-5 space-y-1.5 text-gray-600 leading-relaxed">
                {section.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
            {section.paragraphs?.map((p, i) => (
              <p key={i} className="text-gray-600 leading-relaxed mt-2 first:mt-0">
                {p}
              </p>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
