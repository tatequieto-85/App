import { useState } from 'react';
import Widget from '../../components/ui/Widget';
import { useContactos } from './useContactos';
import { proximoCumpleanos, fmtCumpleanos } from '../../services/contactosApi';
import ContactoDetailModal from './ContactoDetailModal';

// Widget de datos (angosto): el contacto cuyo cumpleaños sigue, entre todos
// los que tienen uno cargado. Un toque abre su detalle directo — no pasa
// por la lista de Contactos.
export default function ContactosWidget({ removing, onRequestRemove, onConfirmRemove }) {
  const { contactos, loading, relacionesDe, addObservacion } = useContactos();
  const [detailOpen, setDetailOpen] = useState(false);

  const proximo = proximoCumpleanos(contactos);

  return (
    <>
      <Widget
        icon="user" title="Contactos"
        onTap={() => proximo && setDetailOpen(true)}
        removing={removing} onRequestRemove={onRequestRemove} onConfirmRemove={onConfirmRemove}
      >
        {loading ? (
          <p className="widget-line widget-line--sub">Cargando…</p>
        ) : proximo ? (
          <>
            <div className="widget-line" style={{ fontWeight: 700 }}>{proximo.contacto.nombre}</div>
            <div className="widget-line widget-line--sub">
              {proximo.dias === 0 ? 'Hoy' : proximo.dias === 1 ? 'Mañana' : `En ${proximo.dias} días`} · {fmtCumpleanos(proximo.contacto.cumpleanos)}
            </div>
          </>
        ) : (
          <p className="widget-line widget-line--sub">Nadie tiene cumpleaños cargado</p>
        )}
      </Widget>

      {proximo && (
        <ContactoDetailModal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          contacto={proximo.contacto}
          vinculos={relacionesDe(proximo.contacto.id)}
          onAddObservacion={addObservacion}
        />
      )}
    </>
  );
}
