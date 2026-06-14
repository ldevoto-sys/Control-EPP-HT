import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Documentacion from './Documentacion';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../api';

describe('Documentacion (matriz)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza la matriz cuando asignaciones es un array (sin crashear en .find)', async () => {
    api.get.mockResolvedValue({ data: {
      trabajadores: [{ id: 1, nombre: 'Juan Pérez', rut: '11.111.111-1' }],
      epps: [{ id: 10, nombre: 'Casco' }],
      asignaciones: [
        { trabajador_id: 1, epp_id: 10, entrega_id: 5, fecha_asignacion: '2026-01-01', estado_vencimiento: 'vigente', pdf_firmado: null },
      ],
    } });

    render(<Documentacion />);
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    // La celda con asignación muestra un botón con título "Entregado: ..."
    expect(await screen.findByTitle(/Entregado/)).toBeInTheDocument();
  });

  it('no crashea con matriz vacía', async () => {
    api.get.mockResolvedValue({ data: { trabajadores: [], epps: [], asignaciones: [] } });
    render(<Documentacion />);
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });
});
