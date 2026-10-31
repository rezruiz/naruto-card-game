import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeToggle } from './ui/components/ThemeToggle'
import { VARIANT_LABEL } from './variant'

document.title = `Naruto Custom Card Game — ${VARIANT_LABEL}`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ThemeToggle />
  </StrictMode>,
)
