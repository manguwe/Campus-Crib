# Campus Crib V11 — Reservations

V11 adds a controlled room-reservation workflow on top of the existing marketplace.

## Workflow

1. Student opens an approved listing.
2. Student chooses **Request this room**.
3. Student provides move-in date, optional move-out date, occupants and a note.
4. Campus Crib admin reviews the request.
5. Admin can confirm/reject it, or create a confirmed reservation directly on behalf of a student who contacted the team by phone, chat, WhatsApp or in person.
6. A confirmed reservation marks the listing as **on hold/reserved** through the existing availability system.
7. The student and landlord receive an in-app notification.
8. Reservation history is available to the student/landlord; admins get the full reservation console.
9. Finished reservations with a move-out date are automatically expired when reservation workflows are used, and only reservation-created holds are released. A landlord's manual on-hold state is not overwritten.

## Database migration

Run this after migration 36:

`supabase_sql/37_v11_reservations.sql`

No previous migration should be skipped.

## Important operating model

Campus Crib should distinguish between:

- **Property owner / landlord** — the actual owner who owns the listing.
- **Campus Crib agent/admin** — the person who handles student requests, verification, reservations and support.
- **Student** — the person requesting the room.

If Campus Crib is managing a landlord's listing, keep the real landlord as the `landlord_id` and have the Campus Crib team use the admin reservation console. Avoid sharing or impersonating a landlord account just to perform agent work; it makes audit trails and ownership unclear.

## Production recommendation

Before taking deposits or signing tenancy agreements, add a formal reservation/booking agreement, cancellation rules, receipt/reference number and a clear statement of who holds any money. V11 deliberately handles the reservation state and audit trail but does not invent a payment/tenancy contract.
