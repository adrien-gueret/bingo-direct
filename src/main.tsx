import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/archivo-black/latin-400.css'
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
