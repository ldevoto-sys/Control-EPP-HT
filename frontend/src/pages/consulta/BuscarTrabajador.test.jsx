import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/utils';
import BuscarTrabajador from './BuscarTrabajador';

vi.mock('../../api', () => ({ default: { get: vi.fn() } }));
import api from '../../api';

describe('BuscarTrabajador', () => {
  it('lista trabajadores y muestra EPP asignado al pulsar "Ver EPP asignado"', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/users/trabajadores') return Promise.resolve({ data: [{ id: 1, nombre: 'Juan Pérez', rut: '11.111.111-1', rol: 'operador' }] });
      if (url === '/asignaciones/trabajador/1') return Promise.resolve({ data: {
        trabajador: { id: 1, nombre: 'Juan Pérez' },
        asignaciones: [{ epp_id: 10, epp_nombre: 'Casco', categoria: 'Cabeza', cantidad: 1, fecha_asignacion: '2026-01-01', estado_vencimiento: 'vigente' }],
        historial_entregas: [],
      } });
      return Promise.resolve({ data: [] });
    });

    renderPage(<BuscarTrabajador />);
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver EPP asignado' }));
    expect(await screen.findByText('Casco')).toBeInTheDocument();
  });
});
