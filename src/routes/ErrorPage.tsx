import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

// Shown instead of a blank page when a screen throws while rendering.
export default function ErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'

  return (
    <main className="centered">
      <h1>Something went wrong</h1>
      <p>{message}</p>
      <p>
        <Link to="/">Go home</Link>
      </p>
    </main>
  )
}
