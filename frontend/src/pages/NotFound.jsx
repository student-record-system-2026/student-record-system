import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="center-page">
      <div className="card narrow">
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <Link className="btn btn-primary" to="/">
          Go home
        </Link>
      </div>
    </div>
  );
}
