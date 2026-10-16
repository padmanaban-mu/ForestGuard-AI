import { EmptyState, ErrorNotice, Loader } from './ui.jsx';

export default function DataPanel({ loading, error, hasData, children, emptyTitle, emptyDescription, onRetry }) {
  if (loading) return <Loader />;
  if (error && !hasData) return <ErrorNotice error={error} onRetry={onRetry} />;
  if (!hasData) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return children;
}
