import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { feriaToText } from '../../services/feriasApi';
import { fmtCOP, fmtDateShortEs } from '../../utils/format';
import './FeriaResumenModal.css';

// Se muestra en vez del conteo una vez que la feria ya pasó por calendario
// (o se cerró a mano con "Terminar feria") — equivalente a openFeriaResumen()
// en ../../../ferias.js. Sobrantes = llevados - vendidos - muestras, nunca
// se pregunta a mano.
function ConteoProductos({ feria, ejecuciones }) {
  const plan = feria.planStock || {};
  const ids = Object.keys(plan).filter(id => plan[id] > 0);
  if (!ids.length) return <p className="empty-state" style={{ padding: '8px 0' }}>No hay stock planeado para esta feria.</p>;

  let hayNegativos = false;
  const filas = ids.map(id => {
    const ej = ejecuciones.find(e => e.id === id);
    const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
    const llevados = plan[id];
    const vendidos = (feria.ventas || []).filter(v => v.ejecucionId === id).reduce((s, v) => s + v.cantidad, 0);
    const muestras = (feria.muestras || []).filter(m => m.ejecucionId === id).reduce((s, m) => s + m.cantidad, 0);
    const sobrantes = llevados - vendidos - muestras;
    if (sobrantes < 0) hayNegativos = true;
    return { id, label, llevados, vendidos, muestras, sobrantes };
  });

  return (
    <>
      <table className="tasks-table">
        <thead><tr><th>Lote</th><th>Llevados</th><th>Vendidos</th><th>Muestras</th><th>Sobrantes</th></tr></thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.id}>
              <td>{f.label}</td><td>{f.llevados}</td><td>{f.vendidos}</td><td>{f.muestras}</td><td>{f.sobrantes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hayNegativos && (
        <div className="feria-resumen-warn">⚠️ Hay lotes con más vendido + regalado que lo llevado — revisa el registro de ventas/muestras.</div>
      )}
    </>
  );
}

function downloadFeriaTxt(feria, ejecuciones) {
  const text = feriaToText(feria, ejecuciones, fmtCOP, fmtDateShortEs);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `feria-${(feria.empresa || 'feria').replace(/[^a-z0-9]+/gi, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FeriaResumenModal({ open, onClose, feria, ejecuciones }) {
  if (!feria) return null;

  return (
    <Modal open={open} onClose={onClose} showBack title={feria.empresa}>
      <div className="feria-resumen-content">{feriaToText(feria, ejecuciones, fmtCOP, fmtDateShortEs)}</div>

      <div className="feria-section">
        <h4 className="feria-section-title">Conteo de productos</h4>
        <ConteoProductos feria={feria} ejecuciones={ejecuciones} />
      </div>

      <Button variant="primary" onClick={() => downloadFeriaTxt(feria, ejecuciones)}>Descargar resumen</Button>
    </Modal>
  );
}
