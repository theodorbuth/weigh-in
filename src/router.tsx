import { createBrowserRouter } from 'react-router'
import ErrorPage from './routes/ErrorPage.tsx'
import Hello from './routes/Hello.tsx'
import Home from './routes/Home.tsx'
import JoinProject from './routes/JoinProject.tsx'
import Login from './routes/Login.tsx'
import NewProject from './routes/NewProject.tsx'
import NotFound from './routes/NotFound.tsx'
import MyStones from './routes/MyStones.tsx'
import ProjectLayout from './routes/ProjectLayout.tsx'
import TeamView from './routes/TeamView.tsx'
import RequireAuth from './routes/RequireAuth.tsx'
import Styles from './routes/Styles.tsx'
import Welcome from './routes/Welcome.tsx'

export const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      { path: '/hello', element: <Hello /> },
      { path: '/styles', element: <Styles /> },
      { path: '/login', element: <Login /> },
      {
        // Everything below needs a signed-in person (with a name).
        element: <RequireAuth />,
        children: [
          { path: '/welcome', element: <Welcome /> },
          { path: '/', element: <Home /> },
          { path: '/new', element: <NewProject /> },
          { path: '/join', element: <JoinProject /> },
          { path: '/join/:code', element: <JoinProject /> },
          {
            path: '/p/:projectId',
            element: <ProjectLayout />,
            children: [
              { index: true, element: <MyStones /> },
              { path: 'team', element: <TeamView /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
