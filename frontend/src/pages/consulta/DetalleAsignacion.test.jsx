import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/utils';
import DetalleAsignacion from './DetalleAsignacion';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../api';

describe('DetalleAsignacion', () => {
  it('muestra EPP asignado e info del trabajador', async () => {
    api.get.mockResolvedValue({ data: {
      trabajador: { nombre: 'Juan Pérez', rut: '11.111.111-1', rol: 'operador' },
      asignaciones: [{ epp_nombre: 'Casco', categoria: 'Cabeza', cantidad: 1, fecha_asignacion: '2026-01-01', estado_vencimiento: 'vigente' }],
      historial_entregas: [],
    } });

    renderPage(<DetalleAsignacion />, { path: '/asignaciones/:id', route: '/asignaciones/1' });
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Casco')).toBeInTheDocument();
  });
});
