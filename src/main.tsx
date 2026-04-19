import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { db } from './db'
import { seedExerciseLibrary, seedSamplePlans } from './db/seed'
import { runMigrations } from './db/migrations'
import { isNative } from './utils/platform'
import { registerNativeNotificationActions, initNativeNotificationListeners } from './plugins/notificationActions'

// Run data migrations first, then seed on first run
runMigrations().then(async () => {
  const count = await db.exercises.count()
  if (count === 0) {
    await seedExerciseLibrary()
    await seedSamplePlans()
  } else {
    const planCount = await db.plans.count()
    if (planCount === 0) await seedSamplePlans()
  }
})

// Init native notification infrastructure
if (isNative) {
  registerNativeNotificationActions()
  initNativeNotificationListeners()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
