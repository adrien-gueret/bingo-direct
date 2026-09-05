import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { detectLocale } from './i18n'
import './styles.css'

const locale = detectLocale()
document.documentElement.lang = locale

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialLocale={locale} />
  </StrictMode>,
)
