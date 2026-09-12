// Íconos de línea reutilizables — mismos paths que ICON_* en ../../../utils.js,
// portados a componentes React para poder usarlos como JSX en vez de strings HTML.
const PATHS = {
  trash: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  check: (
    <>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 9.01" />
    </>
  ),
  spinner: <path d="M21 12a9 9 0 11-9-9" />,
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  )
};

export default function Icon({ name, size = 15, className = '' }) {
  const path = PATHS[name];
  if (!path) return null;
  const spin = name === 'spinner' ? ' icon-spin' : '';
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className + spin}
    >
      {path}
    </svg>
  );
}
