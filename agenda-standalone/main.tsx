import { createRoot } from 'react-dom/client'
import '../src/pages/share.css'
import '../src/pages/agenda.css'
import { AgendaApp } from './AgendaApp'

createRoot(document.getElementById('root')!).render(<AgendaApp />)
