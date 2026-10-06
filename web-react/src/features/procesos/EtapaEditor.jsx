import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import './EtapaEditor.css';

// Producción = una sola etapa fija llamada "Ejecución", a pedido explícito
// del usuario (antes se podían agregar varias, cada una con su propio
// nombre) — ya no hay "+ Agregar etapa" ni campo de nombre, el título
// queda fijo. Solo quedan las instrucciones (agregadas/quitadas a
// voluntad, tipo paso numerado o viñeta). Portado de
// buildInstruccionRow() en ../../../procesos.js, sin el arrastre para
// reordenar (no se pidió acá). Las etapas fijas de Limpieza
// inicial/final siguen agregándose solas e invisibles al guardar — ver
// buildEtapasFull en recetasApi.js.
export default function EtapaEditor({ instrucciones, onChange, disabled }) {
  function addInstruccion() {
    onChange([...instrucciones, { text: '', tipo: 'paso' }]);
  }
  function updateInstruccion(idx, patch) {
    onChange(instrucciones.map((instr, i) => i === idx ? { ...instr, ...patch } : instr));
  }
  function removeInstruccion(idx) {
    onChange(instrucciones.filter((_, i) => i !== idx));
  }

  return (
    <div className="etapa-editor">
      <div className="etapa-editor-item">
        <div className="etapa-editor-header">
          <span className="etapa-editor-num">Ejecución</span>
        </div>
        <div className="etapa-editor-instrucciones">
          {instrucciones.map((instr, i) => (
            <div key={i} className="etapa-editor-instr-row">
              <button
                type="button" className="etapa-editor-tipo-btn" disabled={disabled}
                onClick={() => updateInstruccion(i, { tipo: instr.tipo === 'viñeta' ? 'paso' : 'viñeta' })}
                title={instr.tipo === 'viñeta' ? 'Cambiar a paso numerado' : 'Cambiar a viñeta'}
              >
                {instr.tipo === 'viñeta' ? '•' : '#'}
              </button>
              <input
                className="field-input" type="text" placeholder="Describir el paso…"
                value={instr.text} disabled={disabled}
                onChange={e => updateInstruccion(i, { text: e.target.value })}
              />
              <button type="button" className="etapa-editor-instr-del" disabled={disabled} onClick={() => removeInstruccion(i)} aria-label="Quitar paso">
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" disabled={disabled} onClick={addInstruccion} className="etapa-editor-add-instr">
          + Agregar instrucción
        </Button>
      </div>
    </div>
  );
}
