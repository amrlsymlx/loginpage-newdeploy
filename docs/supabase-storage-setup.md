# Supabase Storage setup for profile avatars

The app uploads profile avatars to a Supabase Storage bucket named `avatars` and retrieves time-limited signed URLs for secure display.

## 1. Create the bucket

In the Supabase Dashboard:

1. Open Storage.
2. Click Create bucket.
3. Set the bucket name to `avatars`.
4. **Do NOT enable Public bucket** — keep it private for security.

## 2. Add storage policies

For the `avatars` bucket, add the following RLS (Row Level Security) policies.

### Authenticated read access

- Policy name: `Authenticated read access`
- Allowed operation: `SELECT`
- Target roles: `authenticated`
- USING expression:

```sql
bucket_id = 'avatars'
```

### Authenticated upload access

- Policy name: `Authenticated upload access`
- Allowed operation: `INSERT`
- Target roles: `authenticated`
- WITH CHECK expression:

```sql
bucket_id = 'avatars'
```

### Authenticated update access

- Policy name: `Authenticated update access`
- Allowed operation: `UPDATE`
- Target roles: `authenticated`
- USING expression:

```sql
bucket_id = 'avatars'
```

- WITH CHECK expression:

```sql
bucket_id = 'avatars'
```

### Authenticated delete access

- Policy name: `Authenticated delete access`
- Allowed operation: `DELETE`
- Target roles: `authenticated`
- USING expression:

```sql
bucket_id = 'avatars'
```

## 3. Confirm the app environment

Make sure your Expo app has valid Supabase environment values:

```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 4. Signed URLs

The app uses **signed URLs** to securely access avatars. Signed URLs are time-limited tokens (1 hour by default) that grant temporary access to private files. When a signed URL expires, a new one is generated automatically on the next login or profile load.
