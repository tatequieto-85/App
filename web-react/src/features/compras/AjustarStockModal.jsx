import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { parseThousandsInput } from '../../utils/format';
import './AjustarStockModal.css';

// Corrección manual del stock de un insumo — a pedido explícito del
// usuario ("cómo puedo descontar del inventario manualmente"): hasta
// ahora el stock solo se movía solo (compras suman, ejecuciones
// descuentan, ver ingredientesApi.js), sin forma de corregirlo a mano
// (p. ej. se dañó un envase, un conteo físico no coincide). Mismo patrón
// de "cápsulas" que el Tipo de MovimientoModal.jsx en Contabilidad.
export default function AjustarStockModal({ open, onClose, ingrediente, onSave }) {
  const [tipo, setTipo] = useState('salida');
  const [cantidad, setCantidad] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (open) { setTipo('salida'); setCantidad(''); }
  }, [open]);

  const isDirty = () => !!cantidad;
  const close = useDirtyGuard(isDirty, onClose);

  if (!ingrediente) return null;

  const cantidadNum = parseThousandsInput(cantidad) || 0;
  const nuevoStock = (ingrediente.stock || 0) + (tipo === 'entrada' ? cantidadNum : -cantidadNum);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!cantidadNum || cantidadNum <= 0) return showFeedback('La cantidad debe ser mayor a 0.', 'err');
    if (!window.confirm(`¿Confirmás este ajuste? Nuevo stock: ${nuevoStock} ${ingrediente.unidad}.`)) return;
    setBusy(true);
    try {
      await onSave(ingrediente, tipo === 'entrada' ? cantidadNum : -cantidadNum);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={`Ajustar stock — ${ingrediente.nombre}`}>
      <form onSubmit={handleSubmit}>
        <p className="ajustar-stock-actual">
          Stock actual: <strong>{ingrediente.stock ?? 0} {ingrediente.unidad}</strong>
        </p>

        <div className="field">
          <label className="field-label">Tipo</label>
          <div className="ajustar-stock-tipo-picker">
            <button
              type="button" disabled={busy}
              className={`ajustar-stock-tipo-pill${tipo === 'entrada' ? ' is-selected is-entrada' : ''}`}
              onClick={() => setTipo('entrada')}
            >
              Suma
            </button>
            <button
              type="button" disabled={busy}
              className={`ajustar-stock-tipo-pill${tipo === 'salida' ? ' is-selected is-salida' : ''}`}
              onClick={() => setTipo('salida')}
            >
              Resta
            </button>
          </div>
        </div>

        <ThousandsField
          label={`Cantidad${ingrediente.unidad ? ` (${ingrediente.unidad})` : ''}`}
          placeholder="0" value={cantidad} onChange={setCantidad} disabled={busy}
        />

        {!!cantidadNum && (
          <p className="ajustar-stock-preview">
            Nuevo stock: <strong className={nuevoStock < 0 ? 'ajustar-stock-negativo' : ''}>{nuevoStock} {ingrediente.unidad}</strong>
          </p>
        )}

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar ajuste'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
