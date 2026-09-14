import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { edadActual, fmtCumpleanos } from '../../services/contactosApi';
import { fmtDateShortEs, getDueStatus } from '../../utils/format';
import './ContactoDetailModal.css';

// Pendientes primero (por fecha más próxima; sin fecha al final de las
// pendientes), hechas al final (más recientes primero) — así lo que hace
// falta hacer siempre está arriba.
function ordenarTareas(tareas) {
  return tareas.slice().sort((a, b) => {
    if (a.hecha !== b.hecha) return a.hecha ? 1 : -1;
    if (!a.hecha) return (a.fecha || '9999').localeCompare(b.fecha || '9999');
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

// Resumen de solo lectura (un toque en la tarjeta abre esto) — los datos y
// vínculos se editan desde "Editar" (ver ContactoModal); acá se agregan
// observaciones al historial y se administran las tareas por hacer de este
// contacto (propias de Contactos, no del módulo Tareas grande — ver
// memoria del piloto).
export default function ContactoDetailModal({
  open, onClose, contacto, vinculos, onAddObservacion, onAddTarea, onToggleTarea, onDeleteTarea
}) {
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  const [tareaTexto, setTareaTexto] = useState('');
  const [tareaFecha, setTareaFecha] = useState('');
  const [busyTarea, setBusyTarea] = useState(false);
  const [tareaFeedback, showTareaFeedback] = useFeedback();

  if (!contacto) return null;

  const edad = edadActual(contacto);
  const titulo = edad != null ? `${contacto.nombre}, ${edad} años` : contacto.nombre;
  const empresaLinea = [contacto.empresa, contacto.posicion].filter(Boolean).join('. ');
  const ubicacionLinea = [contacto.ciudad, contacto.telefono].filter(Boolean).join(', ');
  const obs = contacto.observaciones || [];
  const tareas = ordenarTareas(contacto.tareas || []);

  async function handleAdd(e) {
    e.preventDefault();
    const text = texto.trim();
    if (!text) return;
    setBusy(true);
    try {
      await onAddObservacion(contacto, text);
      setTexto('');
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTarea(e) {
    e.preventDefault();
    const t = tareaTexto.trim();
    if (!t) return showTareaFeedback('Escribí qué hay que hacer.', 'err');
    setBusyTarea(true);
    try {
      await onAddTarea(contacto, t, tareaFecha);
      setTareaTexto('');
      setTareaFecha('');
    } catch (err) {
      showTareaFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusyTarea(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} showBack title={titulo}>
      {contacto.cumpleanos && (
        <div className="contacto-detail-row">
          <span className="contacto-detail-label">Cumpleaños</span>
          <span>{fmtCumpleanos(contacto.cumpleanos)}</span>
        </div>
      )}
      {empresaLinea && (
        <div className="contacto-detail-row">
          <span className="contacto-detail-label">Empresa</span>
          <span>{empresaLinea}</span>
        </div>
      )}
      {!!vinculos.length && (
        <div className="contacto-detail-row">
          <span className="contacto-detail-label">Vínculos</span>
          <div>
            {vinculos.map(v => (
              <div key={v.rowIndex}>{v.tipo === 'trabajo' ? '💼 ' : ''}{v.categoria} de {v.otro.nombre}</div>
            ))}
          </div>
        </div>
      )}
      {ubicacionLinea && (
        <div className="contacto-detail-row">
          <span className="contacto-detail-label">Ubicación</span>
          <span>{ubicacionLinea}</span>
        </div>
      )}

      <div className="contacto-obs-section">
        <p className="modal-contexto">Tareas</p>
        <div className="contacto-tareas-list">
          {tareas.length ? tareas.map(t => {
            const dueStatus = !t.hecha && t.fecha ? getDueStatus(t.fecha) : '';
            return (
              <div key={t.id} className={`contacto-tarea-item${t.hecha ? ' is-hecha' : ''}`}>
                <input
                  type="checkbox" className="contacto-tarea-check"
                  checked={t.hecha} onChange={() => onToggleTarea(contacto, t.id)}
                />
                <div className="contacto-tarea-body">
                  <div className="contacto-tarea-texto">{t.texto}</div>
                  {t.fecha && (
                    <div className={`contacto-tarea-fecha${dueStatus === 'vencido' ? ' is-vencida' : ''}`}>
                      {fmtDateShortEs(t.fecha)}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => onDeleteTarea(contacto, t.id)}>Borrar</button>
              </div>
            );
          }) : <div className="empty-state" style={{ padding: '8px 0' }}>Sin tareas pendientes</div>}
        </div>
        <form onSubmit={handleAddTarea} className="contacto-tarea-form">
          <TextField placeholder="Nueva tarea…" value={tareaTexto} onChange={e => setTareaTexto(e.target.value)} disabled={busyTarea} />
          <TextField type="date" value={tareaFecha} onChange={e => setTareaFecha(e.target.value)} disabled={busyTarea} aria-label="Fecha (opcional)" />
          <Button type="submit" variant="outline" disabled={busyTarea}>{busyTarea ? 'Guardando…' : 'Agregar'}</Button>
        </form>
        <Feedback message={tareaFeedback.message} type={tareaFeedback.type} />
      </div>

      <div className="contacto-obs-section">
        <p className="modal-contexto">Observaciones</p>
        <div className="contacto-obs-list">
          {obs.length ? obs.map((o, i) => (
            <div key={i} className="contacto-obs-item">
              <div className="contacto-obs-text">{o.text}</div>
              <div className="contacto-obs-date">{o.createdAt ? fmtDateShortEs(o.createdAt) : ''}</div>
            </div>
          )) : <div className="empty-state" style={{ padding: '8px 0' }}>Aún sin observaciones</div>}
        </div>
        <form onSubmit={handleAdd} className="contacto-obs-form">
          <TextField placeholder="Agregar observación…" value={texto} onChange={e => setTexto(e.target.value)} disabled={busy} />
          <Button type="submit" variant="outline" disabled={busy}>{busy ? 'Guardando…' : 'Agregar'}</Button>
        </form>
        <Feedback message={feedback.message} type={feedback.type} />
      </div>
    </Modal>
  );
}
