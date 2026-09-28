# Campus Crib V16 — Admin User Contacts

## What changed

### Admin → Users
- Registered phone numbers are shown directly in the Contact column.
- Older landlord accounts can fall back to the landlord verification contact phone if the profile phone is empty.
- Added a WhatsApp button with a WhatsApp icon.
- WhatsApp opens the user's chat with a pre-filled Campus Crib admin message.
- Zambia local 10-digit numbers such as `0977xxxxxx` are converted to `260977xxxxxx` for the `wa.me` link.
- Email opens with a pre-filled subject and support message.
- Call still uses the user's phone number.
- In-app Message remains available.

### Admin contact message
The pre-filled WhatsApp/email message says, in effect:

> Hello [Name],
>
> This is Campus Crib Admin. We have seen that you registered on the Campus Crib platform. Thank you for joining Campus Crib.
>
> If you have any questions, a complaint, or need help with your account or a listing, please let us know and our team will assist you.
>
> — Campus Crib Admin

## Supabase
Run:

`supabase_sql/40_admin_user_contacts_and_prefilled_messages.sql`

This replaces the admin-only `get_admin_user_directory()` RPC and adds a `contact_phone` field to its returned data. No other tables are changed.

## Build / deploy

```bash
npm install
npm run build
```

Then deploy the resulting project normally.
