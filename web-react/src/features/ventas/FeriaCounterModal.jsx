import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { feriaConteoTotal, getFeriaDefaultDay } from '../../services/feriasApi';
import { fmtDateShortEs } from '../../utils/format';
import FeriaSalidaModal from './FeriaSalidaModal';
import FeriaObsModal from './FeriaObsModal';
import './FeriaCounterModal.css';

const CAMPOS = [
  { key: 'menores30', label: 'Menores de 30' },
  { key: 'entre30y55', label: 'Entre 30 y 55' },
  { key: 'mayores55', label: 'Mayores de 55' }
];

function draftKey(feriaId) { return 'ss_feria_counter_draft_' + feriaId; }

function loadDraft(feriaId) {
  try { return JSON.parse(localStorage.getItem(draftKey(feriaId)) || 'null'); } catch { return null; }
}
function saveDraft(feriaId, session) {
  try { localStorage.setItem(draftKey(feriaId), JSON.stringify(session)); } catch { /* localStorage no disponible */ }
}
function clearDraft(feriaId) {
  try { localStorage.removeItem(draftKey(feriaId)); } catch { /* localStorage no disponible */ }
}

// Vista principal mientras la feria está en curso — equivalente a
// openFeriaCounter() en ../../../ferias.js. El conteo por rango etario no
// toca en vivo el total guardado: arranca en 0 en una "tanda" que solo suma
// (el "−" corrige un toque de más dentro de esa tanda, nunca negativo) y se
// vuelca al total recién al cerrar (onCommitSession). Si la ventana se
// cierra de cualquier otra forma sin pasar por ahí, el borrador en
// localStorage se ofrece recuperar la próxima vez que se abra.
export default function FeriaCounterModal({ open, onClose, feria, ejecuciones, onRegistrarSalida, onAddObservacionDiaria, onTerminar, onCommitSession }) {
  const [session, setSession] = useState({ menores30: 0, entre30y55: 0, mayores55: 0 });
  const [salidaModal, setSalidaModal] = useState(null); // 'ventas' | 'muestras' | null
  const [obsOpen, setObsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !feria) return;
    let nueva = { menores30: 0, entre30y55: 0, mayores55: 0 };
    const draft = loadDraft(feria.id);
    const draftTotal = draft ? (draft.menores30 || 0) + (draft.entre30y55 || 0) + (draft.mayores55 || 0) : 0;
    if (draftTotal > 0 && window.confirm(`Quedó una tanda sin guardar de la vez pasada (${draftTotal} personas). ¿Querés guardarla en el total?`)) {
      onCommitSession(feria.id, draft);
    }
    if (draftTotal > 0) clearDraft(feria.id);
    setSession(nueva);
  }, [open, feria?.id]);

  if (!feria) return null;
  const fecha = getFeriaDefaultDay(feria);
  const total = feriaConteoTotal(feria) + session.menores30 + session.entre30y55 + session.mayores55;

  function adjust(key, delta) {
    setSession(s => {
      const next = { ...s, [key]: Math.max(0, s[key] + delta) };
      saveDraft(feria.id, next);
      return next;
    });
  }

  async function handleClose() {
    await onCommitSession(feria.id, session);
    clearDraft(feria.id);
    onClose();
  }

  async function handleTerminar() {
    if (!window.confirm('¿Terminar esta feria? Vas a poder ver el resumen y el conteo de productos, pero no seguir registrando el conteo del día.')) return;
    setBusy(true);
    try {
      await onCommitSession(feria.id, session);
      clearDraft(feria.id);
      // No se llama a onClose(): onTerminar deja la feria abierta pero pasa
      // la vista a "resumen" en VentasPage, lo que ya oculta este modal solo.
      await onTerminar(feria.id);
    } catch (err) {
      alert('Error al terminar la feria: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={handleClose} showBack title={feria.empresa}>
        <div className="feria-counter-date">{fmtDateShortEs(fecha)}</div>

        <div className="feria-counter-rows">
          {CAMPOS.map(({ key, label }) => (
            <div key={key} className="feria-counter-row">
              <span className="feria-counter-label">{label}</span>
              <div className="feria-counter-stepper">
                <button type="button" className="feria-counter-btn" disabled={session[key] <= 0} onClick={() => adjust(key, -1)}>−</button>
                <span className="feria-counter-value">{session[key]}</span>
                <button type="button" className="feria-counter-btn" onClick={() => adjust(key, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="feria-counter-total">
          <span className="feria-counter-total-label">Total contado</span>
          <span className="feria-counter-total-value">{total}</span>
        </div>

        <div className="feria-counter-actions">
          <Button type="button" variant="outline" onClick={() => setSalidaModal('ventas')}>Registrar venta</Button>
          <Button type="button" variant="outline" onClick={() => setSalidaModal('muestras')}>Registrar muestra</Button>
          <Button type="button" variant="outline" onClick={() => setObsOpen(true)}>Agregar observación</Button>
          <Button type="button" variant="outline" className="feria-counter-btn-terminar" disabled={busy} onClick={handleTerminar}>
            {busy ? 'Terminando…' : 'Terminar feria'}
          </Button>
        </div>
      </Modal>

      <FeriaSalidaModal
        open={salidaModal === 'ventas'}
        onClose={() => setSalidaModal(null)}
        feria={feria}
        ejecuciones={ejecuciones}
        arrField="ventas"
        title="Registrar venta"
        fecha={fecha}
        onSave={onRegistrarSalida}
      />
      <FeriaSalidaModal
        open={salidaModal === 'muestras'}
        onClose={() => setSalidaModal(null)}
        feria={feria}
        ejecuciones={ejecuciones}
        arrField="muestras"
        title="Registrar muestra"
        fecha={fecha}
        onSave={onRegistrarSalida}
      />
      <FeriaObsModal
        open={obsOpen}
        onClose={() => setObsOpen(false)}
        feriaId={feria.id}
        fecha={fecha}
        onSave={onAddObservacionDiaria}
      />
    </>
  );
}
