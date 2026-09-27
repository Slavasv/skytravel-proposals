import { Suspense } from 'react'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { tr } from '@/lib/i18n'
import ChangePasswordForm from './change-password-form'
import BrandSettingsManager from './brand-settings-manager'
import MicrosoftIntegration from './microsoft-integration'
import { getOwnerBrands } from './actions'

export default async function SettingsPage() {
  const profile = await getProfile()
  const lang = profile?.ui_language ?? 'en'

  // Для owner'а подгружаем ВСЕ его бренды (настройки/дизайн по каждому)
  const brands = profile?.role === 'owner' ? await getOwnerBrands() : []

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {tr(lang, 'Settings', 'Настройки')}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          {profile?.email}
        </p>
      </div>

      {brands.length > 0 && (
        <>
          <div style={{ marginBottom: '8px', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-faint)' }}>
            {tr(lang, 'Brand settings', 'Настройки бренда')}
          </div>
          <BrandSettingsManager brands={brands} />
        </>
      )}

      {canManageBrand(profile?.role) && (
        <>
          <div style={{ marginBottom: '8px', marginTop: '28px', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-faint)' }}>
            {tr(lang, 'Microsoft integration', 'Интеграция Microsoft')}
          </div>
          <Suspense fallback={null}>
            <MicrosoftIntegration />
          </Suspense>
        </>
      )}

      <div style={{ marginBottom: '8px', marginTop: '28px', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-faint)' }}>
        {tr(lang, 'Change password', 'Смена пароля')}
      </div>
      <ChangePasswordForm />
    </div>
  )
}