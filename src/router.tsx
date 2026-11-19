import { createBrowserRouter } from 'react-router'
import ErrorPage from './routes/ErrorPage.tsx'
import Hello from './routes/Hello.tsx'
import NotFound from './routes/NotFound.tsx'
import Styles from './routes/Styles.tsx'

export const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Hello /> },
      { path: '/styles', element: <Styles /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
