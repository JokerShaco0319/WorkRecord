import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import CaptureView from './components/CaptureView'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('缺少根节点 #root')

const isCapture = window.location.hash === '#capture'

createRoot(container).render(
  <StrictMode>{isCapture ? <CaptureView /> : <App />}</StrictMode>
)
