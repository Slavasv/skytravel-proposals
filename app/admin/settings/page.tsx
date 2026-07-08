import { getProfile } from '@/lib/get-profile'
import { createSupabaseServer } from '@/lib/supabase-server'
import ChangePasswordForm from './change-password-form'
import BrandSettingsForm from './brand-settings-form'

export default async function SettingsPage() {
  const profile = await getProfile()

  // Для owner'а подгружаем данные его компании (для блока настроек бренда)
  let company = null
  if (profile?.role === 'owner') {
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: me } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (me?.company_id) {
        const { data } = await supabase
          .from('companies')
          .select('logo_url, accent_color, contact_email, contact_phone, website_url, office_address, tagline, greeting_message, footer_note, socials, voucher_template, voucher_bg_url')
          .eq('id', me.company_id)
          .single()
        company = data
      }
    }
  }

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          {profile?.email}
        </p>
      </div>

      {company && (
        <>
          <div style={{ marginBottom: '8px', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-faint)' }}>
            Brand settings
          </div>
          <BrandSettingsForm company={company} />
        </>
      )}

      <div style={{ marginBottom: '8px', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-faint)' }}>
        Change password
      </div>
      <ChangePasswordForm />
    </div>
  )
}