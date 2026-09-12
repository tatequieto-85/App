import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import './ContactoModal.css';

const emptyForm = { nombre: '', cumpleanos: '', edadIngreso: '', empresa: '', posicion: '', telefono: '', ciudad: '' };

// Equivalente a openContactoModal()/openEditContactoModal() en
// ../../../contactos.js: un solo modal, editingContacto null = crear. Los
// vínculos solo se pueden agregar editando un contacto ya guardado (ver
// contactoAgregarVinculoSection.hidden en el original).
export default function ContactoModal({
  open, onClose, editingContacto, empresas, ciudades, categorias,
  vinculos, otrosContactos, onSave, onAddRelacion, onRemoveRelacion
}) {
  const [form, setForm] = useState(emptyForm);
  const [tipoVinculo, setTipoVinculo] = useState('relacion');
  const [otroId, setOtroId] = useState('');
  const [categoriaVinculo, setCategoriaVinculo] = useState('');
  const [busy, setBusy] = useState(false);
  const [vinculoBusy, setVinculoBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    if (editingContacto) {
      setForm({
        nombre: editingContacto.nombre,
        cumpleanos: editingContacto.cumpleanos ? `2000-${editingContacto.cumpleanos}` : '',
        edadIngreso: editingContacto.edadIngreso ?? '',
        empresa: editingContacto.empresa,
        posicion: editingContacto.posicion,
        telefono: editingContacto.telefono,
        ciudad: editingContacto.ciudad
      });
    } else {
      setForm(emptyForm);
    }
    setTipoVinculo('relacion');
    setCategoriaVinculo('');
    setOtroId('');
  }, [open, editingContacto]);

  const isDirty = () => Object.values(form).some(v => String(v || '').trim());
  const close = useDirtyGuard(isDirty, onClose);

  function setField(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) return showFeedback('El nombre es obligatorio.', 'err');

    setBusy(true);
    try {
      await onSave({
        nombre,
        cumpleanos: form.cumpleanos ? form.cumpleanos.slice(5) : '',
        edadIngreso: String(form.edadIngreso).trim() ? +form.edadIngreso : null,
        empresa: form.empresa.trim(),
        posicion: form.posicion.trim(),
        telefono: form.telefono.trim(),
        ciudad: form.ciudad.trim()
      }, editingContacto?.id || null);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddRelacion() {
    if (!otroId) return showFeedback('Elegí con quién vincularlo.', 'err');
    const categoria = categoriaVinculo.trim();
    if (!categoria) return showFeedback('Ponele una categoría al vínculo.', 'err');

    setVinculoBusy(true);
    try {
      await onAddRelacion(editingContacto.id, otroId, categoria, tipoVinculo);
      setCategoriaVinculo('');
      showFeedback('Vínculo agregado.', 'ok');
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setVinculoBusy(false);
    }
  }

  const categoriaOpciones = tipoVinculo === 'trabajo' ? empresas : categorias;

  return (
    <Modal open={open} onClose={close} showBack title={editingContacto ? 'Editar contacto' : 'Nuevo contacto'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" value={form.nombre} onChange={setField('nombre')} disabled={busy} autoFocus />
        <div className="field-row">
          <TextField label="Cumpleaños" type="date" value={form.cumpleanos} onChange={setField('cumpleanos')} disabled={busy} />
          <TextField label="Edad de ingreso" type="number" min="0" value={form.edadIngreso} onChange={setField('edadIngreso')} disabled={busy} />
        </div>
        <div className="field-row">
          <TextField label="Empresa" list="contactoEmpresaList" value={form.empresa} onChange={setField('empresa')} disabled={busy} />
          <TextField label="Posición" value={form.posicion} onChange={setField('posicion')} disabled={busy} />
        </div>
        <div className="field-row">
          <TextField label="Teléfono" value={form.telefono} onChange={setField('telefono')} disabled={busy} />
          <TextField label="Ciudad" list="contactoCiudadList" value={form.ciudad} onChange={setField('ciudad')} disabled={busy} />
        </div>
        <datalist id="contactoEmpresaList">{empresas.map(v => <option key={v} value={v} />)}</datalist>
        <datalist id="contactoCiudadList">{ciudades.map(v => <option key={v} value={v} />)}</datalist>

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editingContacto ? 'Guardar cambios' : 'Guardar contacto')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>

      {editingContacto && (
        <div className="contacto-vinculos-section">
          <p className="modal-contexto">Vínculos</p>
          <div className="contacto-vinculos-list">
            {vinculos.length ? vinculos.map(v => (
              <div key={v.rowIndex} className="contacto-relacion-item">
                <span className="badge">{v.tipo === 'trabajo' ? '💼 ' : ''}{v.categoria}</span>
                <span className="contacto-relacion-nombre">{v.otro.nombre}</span>
                <button type="button" onClick={() => onRemoveRelacion(v.rowIndex)}>Quitar</button>
              </div>
            )) : <div className="empty-state" style={{ padding: '8px 0' }}>Sin vínculos todavía</div>}
          </div>

          <div className="field-row">
            <Select
              label="Tipo" value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value)} disabled={vinculoBusy}
              options={[{ value: 'relacion', label: 'Relación' }, { value: 'trabajo', label: 'Trabajo' }]}
            />
            <Select
              label="Vincular con" value={otroId} onChange={e => setOtroId(e.target.value)} disabled={vinculoBusy}
              options={otrosContactos.length
                ? otrosContactos.map(c => ({ value: c.id, label: c.nombre }))
                : [{ value: '', label: 'No hay otros contactos todavía' }]}
            />
          </div>
          <TextField
            label={tipoVinculo === 'trabajo' ? 'Empresa' : 'Categoría'}
            placeholder={tipoVinculo === 'trabajo' ? 'Empresa (ej: Acme)' : 'Categoría (ej: Amigos)'}
            list="contactoCategoriaList"
            value={categoriaVinculo} onChange={e => setCategoriaVinculo(e.target.value)} disabled={vinculoBusy}
          />
          <datalist id="contactoCategoriaList">{categoriaOpciones.map(v => <option key={v} value={v} />)}</datalist>
          <Button type="button" variant="outline" disabled={vinculoBusy} onClick={handleAddRelacion}>
            {vinculoBusy ? 'Agregando…' : 'Agregar vínculo'}
          </Button>
        </div>
      )}
    </Modal>
  );
}
