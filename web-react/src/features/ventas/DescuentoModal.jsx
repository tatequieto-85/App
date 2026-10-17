import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { formatThousandsValue, parseThousandsInput } from '../../utils/format';

const TIPO_OPCIONES = [
  { value: 'porcentaje', label: 'Porcentaje (%)' },
  { value: 'monto', label: 'Monto fijo ($)' }
];

// Crear/editar un descuento del catálogo ("Armar combos" → Descuentos, a
// pedido explícito del usuario). Se aplica sobre el TOTAL de una
// venta-combo, nunca por unidad — ver registrarVentaCombo en useVentas.js.
// editingDescuento null = crear.
export default function DescuentoModal({ open, onClose, editingDescuento, onSave }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('porcentaje');
  const [valor, setValor] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '', tipo: 'porcentaje', valor: '' });

  useEffect(() => {
    if (!open) return;
    const n = editingDescuento ? editingDescuento.nombre : '';
    const t = editingDescuento ? editingDescuento.tipo : 'porcentaje';
    const v = editingDescuento ? (t === 'monto' ? formatThousandsValue(editingDescuento.valor) : String(editingDescuento.valor)) : '';
    setNombre(n);
    setTipo(t);
    setValor(v);
    initialRef.current = { nombre: n, tipo: t, valor: v };
  }, [open, editingDescuento]);

  const isDirty = () =>
    nombre.trim() !== initialRef.current.nombre ||
    tipo !== initialRef.current.tipo ||
    valor !== initialRef.current.valor;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    const valorNum = tipo === 'monto' ? parseThousandsInput(valor) : parseFloat(valor);
    if (!nombreTrim) return showFeedback('Ponele un nombre al descuento.', 'err');
    if (!valorNum || valorNum <= 0) return showFeedback('El valor debe ser mayor a 0.', 'err');
    if (tipo === 'porcentaje' && valorNum > 100) return showFeedback('Un porcentaje no puede ser mayor a 100.', 'err');

    setBusy(true);
    try {
      await onSave({ nombre: nombreTrim, tipo, valor: valorNum }, editingDescuento?.id || null);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingDescuento ? 'Editar descuento' : 'Nuevo descuento'}>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nombre" placeholder="Ej: Mayorista"
          value={nombre} onChange={e => setNombre(e.target.value)}
          disabled={busy} autoFocus
        />
        <div className="field-row">
          <Select
            label="Tipo" value={tipo}
            onChange={e => { setTipo(e.target.value); setValor(''); }}
            disabled={busy}
            options={TIPO_OPCIONES}
          />
          {tipo === 'monto' ? (
            <ThousandsField label="Valor" placeholder="0" value={valor} onChange={setValor} disabled={busy} />
          ) : (
            <TextField label="Valor (%)" type="number" min="1" max="100" step="1" placeholder="10" value={valor} onChange={e => setValor(e.target.value)} disabled={busy} />
          )}
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editingDescuento ? 'Guardar cambios' : 'Crear descuento')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
