import { createBrowserRouter } from 'react-router'
import ErrorPage from './routes/ErrorPage.tsx'
import Hello from './routes/Hello.tsx'
import Home from './routes/Home.tsx'
import Login from './routes/Login.tsx'
import NotFound from './routes/NotFound.tsx'
import RequireAuth from './routes/RequireAuth.tsx'
import Styles from './routes/Styles.tsx'
import Welcome from './routes/Welcome.tsx'

export const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Hello /> },
      { path: '/styles', element: <Styles /> },
      { path: '/login', element: <Login /> },
      {
        // Everything below needs a signed-in person (with a name).
        element: <RequireAuth />,
        children: [
          { path: '/welcome', element: <Welcome /> },
          { path: '/home', element: <Home /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
