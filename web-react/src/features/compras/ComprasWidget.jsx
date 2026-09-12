import { useState } from 'react';
import Widget from '../../components/ui/Widget';
import InsumoModal from './InsumoModal';
import { useIngredientes } from '../ingredientes/useIngredientes';

// Widget de acción (1/3, angosto): no muestra datos — un toque abre directo
// el formulario de agregar ingrediente, sin pasar por la pantalla de Insumos.
export default function ComprasWidget({ removing, onRequestRemove, onConfirmRemove }) {
  const { addIngrediente } = useIngredientes();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Widget
        icon="cart" title="Insumos"
        onTap={() => setOpen(true)}
        removing={removing} onRequestRemove={onRequestRemove} onConfirmRemove={onConfirmRemove}
      >
        <p className="widget-line widget-line--sub">Toca para agregar un ingrediente</p>
      </Widget>
      <InsumoModal open={open} onClose={() => setOpen(false)} onSave={(nombre, unidad) => addIngrediente(nombre, unidad)} />
    </>
  );
}
