import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import Faq from '../components/Faq'

export default function FaqPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-atm-bg">
      <header className="px-6 py-4 bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/app" className="text-atm-muted hover:text-atm-ink">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-atm-ink">{t('faq.headerTitle')}</h1>
        </div>
      </header>
      <main className="px-6 py-10">
        <Faq />
      </main>
    </div>
  )
}
