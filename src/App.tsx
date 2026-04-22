import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from './components/layout/AppShell'
import UpdatePrompt from './components/UpdatePrompt'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import FloatingTimer from './components/ui/FloatingTimer'
import { TimerProvider } from './contexts/TimerContext'
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

/** Resets the error boundary automatically when the user navigates to a new page */
function PageBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
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
            <Route path="/" element={<PageBoundary><Dashboard /></PageBoundary>} />
            <Route path="/plan" element={<PageBoundary><Plan /></PageBoundary>} />
            <Route path="/plan/new" element={<PageBoundary><PlanBuilder /></PageBoundary>} />
            <Route path="/plan/:id/edit" element={<PageBoundary><PlanBuilder /></PageBoundary>} />
            <Route path="/workout" element={<PageBoundary><Workout /></PageBoundary>} />
            <Route path="/nutrition" element={<PageBoundary><Nutrition /></PageBoundary>} />
            <Route path="/body" element={<PageBoundary><Body /></PageBoundary>} />
            <Route path="/progress" element={<PageBoundary><Progress /></PageBoundary>} />
            <Route path="/library" element={<PageBoundary><Library /></PageBoundary>} />
            <Route path="/settings" element={<PageBoundary><Settings /></PageBoundary>} />
            <Route path="/ai" element={<PageBoundary><AICoach /></PageBoundary>} />
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
      <TimerProvider>
        <AppRoutes />
        <FloatingTimer />
        <UpdatePrompt />
      </TimerProvider>
    </BrowserRouter>
  )
}
