import { useState } from 'react';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { feriaTotalLlevados, feriaTotalVendidos, feriaTotalMuestras, feriaHaTerminado } from '../../services/feriasApi';
import { parseISODate, fmtCOP } from '../../utils/format';
import Icon from '../../components/icons/Icon';
import './FeriaBlock.css';

function fmtDayMonth(iso) {
  if (!iso) return '';
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Long-press revela Editar/Borrar; un toque dispara handleAbrirFeria
// (conteo si está en curso, plan de stock si es futura, resumen si terminó
// o se cerró a mano) — ver VentasPage. Orden de filas fijo a pedido del
// usuario: Lugar, Fechas, Precio y por último los íconos de
// ventas/pruebas/llevados — todo con íconos de línea, nunca emojis (pedido
// explícito: "no quiero ningún emoji en la app").
export default function FeriaBlock({ feria, esProxima, contactoNombre, onAbrir, onEdit, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Bug real reportado: la barra de Editar/Eliminar se quedaba abierta para
  // siempre si no se tocaba uno de esos dos botones — ahora se cierra sola
  // al tocar/clicar afuera de la tarjeta.
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => setActionsOpen(false));
  const gestureProps = useRowGestures({
    onTap: () => onAbrir(feria.id),
    onLongPress: () => setActionsOpen(true)
  });

  const terminada = feriaHaTerminado(feria);
  const fechas = (feria.fechaInicio && feria.fechaFin)
    ? `${fmtDayMonth(feria.fechaInicio)} a ${fmtDayMonth(feria.fechaFin)}`
    : '—';

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta feria?')) return;
    setBusy(true);
    try {
      await onDelete(feria);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} className={`feria-block-wrap${esProxima ? ' feria-block-wrap--proxima' : ''}`}>
      <div
        className={`feria-block${terminada ? ' feria-block--terminada' : ''}`}
        {...gestureProps}
      >
        <div className="feria-block-title">{feria.empresa}</div>
        {contactoNombre && (
          <div className="feria-block-meta"><Icon name="user" size={12} />{contactoNombre}</div>
        )}
        <div className="feria-block-row"><Icon name="mapPin" size={12} />{feria.lugar || '—'}</div>
        <div className="feria-block-row"><Icon name="calendar" size={12} />{fechas}</div>
        {feria.precio > 0 && (
          <div className="feria-block-row feria-block-row--precio"><Icon name="dollarSign" size={12} />{fmtCOP(feria.precio)}</div>
        )}
        <div className="feria-block-stats">
          <span><Icon name="cart" size={13} />{feriaTotalVendidos(feria)}</span>
          <span><Icon name="flask" size={13} />{feriaTotalMuestras(feria)}</span>
          <span><Icon name="box" size={13} />{feriaTotalLlevados(feria)}</span>
        </div>
      </div>
      {actionsOpen && (
        <div className="row-actions-bar feria-block-actions">
          <button type="button" onClick={() => { setActionsOpen(false); onEdit(feria); }}>Editar</button>
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Eliminar</button>
        </div>
      )}
    </div>
  );
}
