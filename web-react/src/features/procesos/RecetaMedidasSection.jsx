import { useState } from 'react';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import ThousandsField from '../../components/ui/ThousandsField';
import Icon from '../../components/icons/Icon';
import IngredienteAutocomplete from '../ingredientes/IngredienteAutocomplete';
import { parseThousandsInput, formatThousandsValue } from '../../utils/format';
import './RecetaMedidasSection.css';

const CREAR_NUEVA = '__crear_nueva__';

// Tamaños de empaque (medidas) atados a la receta — a pedido explícito del
// usuario: "quiero crear varias medidas o tamaños de empaques, cada medida
// contiene un grupo de insumos unitarios". Reemplaza la vieja sección "Por
// unidad" de RecetaIngredientesTable.jsx (forzada a Unidades por lote) —
// cada medida tiene su PROPIO grupo de insumos (frasco/etiqueta/tapa de ESE
// tamaño, distinto por sabor), y en Ejecuciones (EjecucionProduccionBox.jsx)
// se pregunta cuánto salió de CADA medida — esa cantidad multiplica el grupo
// de insumos de esa medida para descontar stock. `medidasCatalogo`: nombres
// reutilizables entre recetas (ver medidasApi.js); `value`: lista de medidas
// atadas a ESTA receta, cada una con su propio array `insumos`.
export default function RecetaMedidasSection({ value, onChange, medidasCatalogo, ingredientes, onAddNew, onAddNewMedida, disabled }) {
  const [addingMedida, setAddingMedida] = useState(false);
  const [nuevaMedidaSel, setNuevaMedidaSel] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPesoMl, setNuevoPesoMl] = useState('');

  const disponibles = (medidasCatalogo || []).filter(m => !value.some(v => v.medidaId === m.id));

  function addMedidaRow(medida) {
    onChange([...value, { medidaId: medida.id, nombre: medida.nombre, pesoMl: medida.pesoMl || 0, insumos: [] }]);
    setAddingMedida(false);
    setNuevaMedidaSel('');
    setNuevoNombre('');
    setNuevoPesoMl('');
  }

  async function handleConfirmNueva() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const pesoMl = parseFloat(nuevoPesoMl.replace(',', '.')) || 0;
    const creada = await onAddNewMedida(nombre, pesoMl);
    addMedidaRow(creada);
  }

  function handleSelectExistente(e) {
    const id = e.target.value;
    if (id === CREAR_NUEVA) {
      setNuevaMedidaSel(CREAR_NUEVA);
      return;
    }
    setNuevaMedidaSel(id);
    const medida = (medidasCatalogo || []).find(m => m.id === id);
    if (medida) addMedidaRow(medida);
  }

  function removeMedida(idx) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function addInsumoRow(idx) {
    onChange(value.map((m, i) => i === idx ? { ...m, insumos: [...m.insumos, { nombre: '', unidad: '', cantidad: 1 }] } : m));
  }
  function updateInsumoRow(idx, insIdx, patch) {
    onChange(value.map((m, i) => i === idx
      ? { ...m, insumos: m.insumos.map((ins, j) => j === insIdx ? { ...ins, ...patch } : ins) }
      : m));
  }
  function removeInsumoRow(idx, insIdx) {
    onChange(value.map((m, i) => i === idx ? { ...m, insumos: m.insumos.filter((_, j) => j !== insIdx) } : m));
  }

  return (
    <div className="receta-medidas-section">
      <label className="field-label receta-modal-section-label">Medidas (tamaños de empaque)</label>

      {value.map((medida, idx) => (
        <div key={medida.medidaId} className="receta-medida-card">
          <div className="receta-medida-card-header">
            <span className="receta-medida-card-nombre">{medida.nombre}</span>
            {!!medida.pesoMl && <span className="receta-medida-card-peso">{medida.pesoMl} ml</span>}
            <button
              type="button" className="receta-ing-row-del" disabled={disabled}
              onClick={() => removeMedida(idx)} aria-label="Quitar medida"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>

          {medida.insumos.map((ins, insIdx) => (
            <div key={insIdx} className="receta-medida-insumo-row">
              <IngredienteAutocomplete
                label="Insumo" placeholder="Nombre…"
                value={ins.nombre}
                onChange={v => {
                  const unidad = (ingredientes || []).find(i => i.nombre === v)?.unidad || '';
                  updateInsumoRow(idx, insIdx, { nombre: v, unidad });
                }}
                ingredientes={ingredientes}
                onAddNew={onAddNew}
              />
              <ThousandsField
                label="Cantidad por unidad" placeholder="1"
                value={formatThousandsValue(ins.cantidad)}
                onChange={v => updateInsumoRow(idx, insIdx, { cantidad: parseThousandsInput(v) || 0 })}
                disabled={disabled}
              />
              <button
                type="button" className="receta-ing-row-del" disabled={disabled}
                onClick={() => removeInsumoRow(idx, insIdx)} aria-label="Quitar insumo"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" disabled={disabled} onClick={() => addInsumoRow(idx)}>
            + Agregar insumo
          </Button>
        </div>
      ))}

      {addingMedida ? (
        <div className="receta-medida-add-form">
          <Select
            label="Medida" value={nuevaMedidaSel} onChange={handleSelectExistente}
            options={[
              { value: '', label: 'Elegir…' },
              ...disponibles.map(m => ({ value: m.id, label: m.pesoMl ? `${m.nombre} (${m.pesoMl} ml)` : m.nombre })),
              { value: CREAR_NUEVA, label: '+ Crear nueva medida…' }
            ]}
          />
          {nuevaMedidaSel === CREAR_NUEVA && (
            <div className="field-row">
              <TextField label="Nombre" placeholder="Ej: 230 ml" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
              <TextField
                label="¿Cuánto de la mezcla entra en este frasco? (ml)" type="number" min="0" placeholder="230"
                value={nuevoPesoMl} onChange={e => setNuevoPesoMl(e.target.value)}
              />
              <Button type="button" variant="primary" disabled={!nuevoNombre.trim()} onClick={handleConfirmNueva}>
                Crear
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button type="button" variant="outline" disabled={disabled} onClick={() => setAddingMedida(true)}>
          <Icon name="plus" size={13} /> Agregar medida
        </Button>
      )}
    </div>
  );
}
