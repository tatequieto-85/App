import './Feedback.css';

// Presentacional puro — el timing de auto-limpieza vive en useFeedback (ver
// ../../hooks/useFeedback.js), que es lo que antes hacía setFb() en utils.js.
export default function Feedback({ message, type }) {
  return <div className={`feedback ${type || ''}`}>{message}</div>;
}
