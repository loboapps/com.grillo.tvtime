import { Routes, Route, useLocation } from 'react-router-dom'
import { PrivateRoute } from '@/components/PrivateRoute'
import { BottomNav } from '@/components/BottomNav'
import { LoginPage } from '@/pages/LoginPage'
import { WatchListPage } from '@/pages/WatchListPage'
import { SearchPage } from '@/pages/SearchPage'
import { ShowDetailPage } from '@/pages/ShowDetailPage'

export default function App() {
  const location = useLocation()
  const showNav = location.pathname !== '/login'

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <WatchListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/search"
          element={
            <PrivateRoute>
              <SearchPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/show/:tmdbId"
          element={
            <PrivateRoute>
              <ShowDetailPage />
            </PrivateRoute>
          }
        />
      </Routes>
      {showNav && <BottomNav />}
    </>
  )
}
