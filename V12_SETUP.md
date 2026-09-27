# Campus Crib V12 — Reservation Conversations + Admin User Contacts

V12 fixes the V11 reservation relationship/embed error and adds an operational communication workflow.

## Supabase migration

Run this after migrations 33–37:

`supabase_sql/38_v12_reservation_chat_admin_contacts.sql`

The migration:
- adds reservation-linked conversations
- automatically creates a private student ↔ Campus Crib admin conversation when a reservation is submitted
- lets admins open that conversation from the Reservations panel
- adds admin-only direct conversations from Users
- adds an admin-only user directory with auth email, profile phone, landlord contact email and WhatsApp
- notifies admins when a reservation request is created
- extends conversation kinds safely to `reservation` and `direct`

## Important V11 error fixed

The old AdminReservations query embedded both `profiles` and `properties` directly through `reservations`. V11 added another relationship through `properties.reservation_hold_id`, which made PostgREST report:

`Could not embed because more than one relationship was found for 'reservations' and 'properties'`

V12 avoids that ambiguous embed entirely. Reservations, profiles and properties are loaded separately and joined in the UI.

## Build

```bash
npm install
npm run build
```

## Reservation communication flow

Student submits a reservation → private reservation conversation is created → admin can message the student → student can reply → admin decides whether to confirm/reject.

The reservation is not automatically confirmed just because the chat exists.
