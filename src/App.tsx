import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from './components/layout/AppShell'
import UpdatePrompt from './components/UpdatePrompt'
import { db } from './db'

// Eagerly loaded — needed before onboarding check resolves
import Onboarding from './pages/Onboarding'

// Lazy-loaded — only fetched when the user navigates to that route
const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Plan        = lazy(() => import('./pages/Plan'))
const PlanBuilder = lazy(() => import('./pages/PlanBuilder'))
const Workout     = lazy(() => import('./pages/Workout'))
const Nutrition   = lazy(() => import('./pages/Nutrition'))
const Body        = lazy(() => import('./pages/Body'))
const Progress    = lazy(() => import('./pages/Progress'))
const Library     = lazy(() => import('./pages/Library'))
const Settings    = lazy(() => import('./pages/Settings'))
const AICoach     = lazy(() => import('./pages/AICoach'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full bg-[#0D0D0D]">
      <div className="w-8 h-8 border-2 border-[#00FF87] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function AppRoutes() {
  // Use a tuple: [isLoaded, settings]
  // useLiveQuery returns undefined only while the async query is in-flight
  const result = useLiveQuery(
    async () => {
      const s = await db.settings.get('user')
      return { loaded: true, settings: s ?? null }
    },
    [],
  )

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0D0D0D]">
        <div className="w-10 h-10 border-2 border-[#00FF87] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const showOnboarding = !result.settings || !result.settings.onboardingCompleted

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {showOnboarding ? (
          <>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : (
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/plan/new" element={<PlanBuilder />} />
            <Route path="/plan/:id/edit" element={<PlanBuilder />} />
            <Route path="/workout" element={<Workout />} />
            <Route path="/nutrition" element={<Nutrition />} />
            <Route path="/body" element={<Body />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/library" element={<Library />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/ai" element={<AICoach />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Suspense>
  )
}

export default function App() {
  useEffect(() => {
    if (navigator.storage?.persist) navigator.storage.persist()
  }, [])

  return (
    <BrowserRouter>
      <AppRoutes />
      <UpdatePrompt />
    </BrowserRouter>
  )
}
