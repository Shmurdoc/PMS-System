import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster 
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#1c1c1e',
          border: '1px solid #38383a',
          color: '#e5e5e7',
        },
      }}
    />
    </BrowserRouter>
  </StrictMode>,
)
