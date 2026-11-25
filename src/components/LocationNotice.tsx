'use client';

/** Shown once when the first city was chosen from the visitor's approximate location. */
export function LocationNotice({ cityName, onDismiss }: { cityName: string; onDismiss: () => void }) {
  return (
    <p className="note location-notice" role="status">
      Showing {cityName} based on your approximate location. Choose another city with the search above.{' '}
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </p>
  );
}
