import { useState } from 'react';
import Widget from '../../components/ui/Widget';
import AgregarCompraModal from './AgregarCompraModal';
import InsumoModal from './InsumoModal';
import CompraModal from './CompraModal';
import { useIngredientes } from '../ingredientes/useIngredientes';
import { useCompras } from './useCompras';

// Widget de acción (angosto): un toque no muestra datos — busca el insumo
// con texto predictivo (AgregarCompraModal) y sigue directo a CompraModal
// para registrar la compra. Si el insumo no existe, advierte y abre el
// formulario completo de insumo nuevo (InsumoModal) antes de continuar.
export default function ComprasWidget({ removing, onRequestRemove, onConfirmRemove }) {
  const { ingredientes, addIngrediente } = useIngredientes();
  const { saveCompra } = useCompras(ingredientes);

  const [step, setStep] = useState(null); // null | 'buscar' | 'insumo' | 'compra'
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [compraIngrediente, setCompraIngrediente] = useState(null);

  function close() {
    setStep(null);
    setNuevoNombre('');
    setCompraIngrediente(null);
  }

  return (
    <>
      <Widget
        icon="cart" title="Agregar compra"
        onTap={() => setStep('buscar')}
        removing={removing} onRequestRemove={onRequestRemove} onConfirmRemove={onConfirmRemove}
      >
        <p className="widget-line widget-line--sub">Doble clic para buscar un insumo</p>
      </Widget>

      <AgregarCompraModal
        open={step === 'buscar'}
        onClose={close}
        ingredientes={ingredientes}
        onPick={ing => { setCompraIngrediente(ing); setStep('compra'); }}
        onCreateNew={nombre => { setNuevoNombre(nombre); setStep('insumo'); }}
      />

      <InsumoModal
        open={step === 'insumo'}
        onClose={close}
        initialNombre={nuevoNombre}
        onSave={async (nombre, unidad) => {
          await addIngrediente(nombre, unidad);
          setCompraIngrediente({ nombre, unidad });
          setStep('compra');
        }}
      />

      <CompraModal
        open={step === 'compra'}
        onClose={close}
        ingrediente={compraIngrediente}
        editRecord={null}
        onSave={saveCompra}
      />
    </>
  );
}
