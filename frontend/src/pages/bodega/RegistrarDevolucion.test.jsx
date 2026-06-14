import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistrarDevolucion from './RegistrarDevolucion';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../api';

describe('RegistrarDevolucion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('llena el selector de EPP desde r.data.asignaciones al elegir trabajador', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/users/trabajadores') {
        return Promise.resolve({ data: [{ id: 1, nombre: 'Juan Pérez', rut: '11.111.111-1' }] });
      }
      if (url === '/asignaciones/trabajador/1') {
        return Promise.resolve({ data: {
          trabajador: { id: 1 },
          asignaciones: [{ epp_id: 10, epp_nombre: 'Casco' }],
          historial_entregas: [],
        } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<RegistrarDevolucion />);
    // Al montar hay dos selects (Trabajador y Motivo); el primero es Trabajador
    const selects = await screen.findAllByRole('combobox');
    await userEvent.selectOptions(selects[0], '1');

    // El EPP asignado aparece como opción (prueba el fix epp_actual -> asignaciones)
    expect(await screen.findByRole('option', { name: 'Casco' })).toBeInTheDocument();
  });
});
