import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Icon from '../../components/icons/Icon';
import './EtapaEditor.css';

// Etapas editables de una receta (sin contar las fijas de Limpieza
// inicial/final, que se agregan solas e invisibles al guardar — ver
// buildEtapasFull en recetasApi.js). Cada una: nombre + lista de
// instrucciones (agregadas/quitadas a voluntad), cada instrucción con tipo
// paso numerado o viñeta. Portado de addEtapaToList()/buildInstruccionRow()
// en ../../../procesos.js, sin el arrastre para reordenar (no se pidió acá).
export default function EtapaEditor({ etapas, onChange, disabled }) {
  function addEtapa() {
    onChange([...etapas, { id: crypto.randomUUID(), nombre: '', instrucciones: [] }]);
  }
  function removeEtapa(id) {
    if (!window.confirm('¿Eliminar esta etapa? Se pierden sus instrucciones.')) return;
    onChange(etapas.filter(et => et.id !== id));
  }
  function updateEtapa(id, patch) {
    onChange(etapas.map(et => et.id === id ? { ...et, ...patch } : et));
  }
  function addInstruccion(etapaId) {
    const et = etapas.find(e => e.id === etapaId);
    updateEtapa(etapaId, { instrucciones: [...(et.instrucciones || []), { text: '', tipo: 'paso' }] });
  }
  function updateInstruccion(etapaId, idx, patch) {
    const et = etapas.find(e => e.id === etapaId);
    const instrucciones = et.instrucciones.map((instr, i) => i === idx ? { ...instr, ...patch } : instr);
    updateEtapa(etapaId, { instrucciones });
  }
  function removeInstruccion(etapaId, idx) {
    const et = etapas.find(e => e.id === etapaId);
    updateEtapa(etapaId, { instrucciones: et.instrucciones.filter((_, i) => i !== idx) });
  }

  return (
    <div className="etapa-editor">
      {etapas.map((et, etIdx) => (
        <div key={et.id} className="etapa-editor-item">
          <div className="etapa-editor-header">
            <span className="etapa-editor-num">Etapa {etIdx + 1}</span>
            <button type="button" className="etapa-editor-del" disabled={disabled} onClick={() => removeEtapa(et.id)} aria-label="Eliminar etapa">
              <Icon name="trash" size={14} />
            </button>
          </div>
          <TextField
            label="Nombre de la etapa" placeholder="Ej: Lavado de materia prima"
            value={et.nombre} onChange={e => updateEtapa(et.id, { nombre: e.target.value })} disabled={disabled}
          />
          <label className="field-label etapa-editor-instr-label">Instrucciones</label>
          <div className="etapa-editor-instrucciones">
            {(et.instrucciones || []).map((instr, i) => (
              <div key={i} className="etapa-editor-instr-row">
                <button
                  type="button" className="etapa-editor-tipo-btn" disabled={disabled}
                  onClick={() => updateInstruccion(et.id, i, { tipo: instr.tipo === 'viñeta' ? 'paso' : 'viñeta' })}
                  title={instr.tipo === 'viñeta' ? 'Cambiar a paso numerado' : 'Cambiar a viñeta'}
                >
                  {instr.tipo === 'viñeta' ? '•' : '#'}
                </button>
                <input
                  className="field-input" type="text" placeholder="Describir el paso…"
                  value={instr.text} disabled={disabled}
                  onChange={e => updateInstruccion(et.id, i, { text: e.target.value })}
                />
                <button type="button" className="etapa-editor-instr-del" disabled={disabled} onClick={() => removeInstruccion(et.id, i)} aria-label="Quitar paso">
                  <Icon name="close" size={13} />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => addInstruccion(et.id)} className="etapa-editor-add-instr">
            + Agregar instrucción
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" disabled={disabled} onClick={addEtapa}>+ Agregar etapa</Button>
    </div>
  );
}
