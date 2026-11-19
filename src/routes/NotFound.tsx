import { Link } from 'react-router'

export default function NotFound() {
  return (
    <main className="centered">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Go home</Link>
      </p>
    </main>
  )
}
