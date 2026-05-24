import { getProfile } from '@/lib/get-profile'
import ChangePasswordForm from './change-password-form'

export default async function SettingsPage() {
  const profile = await getProfile()

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          Settings
        </h1>
        <p style={{ color: '#888780', margin: 0, fontSize: '14px' }}>
          {profile?.email}
        </p>
      </div>

      <div style={{ marginBottom: '8px', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555' }}>
        Change password
      </div>
      <ChangePasswordForm />
    </div>
  )
}