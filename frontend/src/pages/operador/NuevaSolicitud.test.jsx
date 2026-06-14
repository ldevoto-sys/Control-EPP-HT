import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/utils';
import NuevaSolicitud from './NuevaSolicitud';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../api';

describe('NuevaSolicitud', () => {
  it('muestra el paso 1 con la lista de trabajadores', async () => {
    api.get.mockResolvedValue({ data: [{ id: 1, nombre: 'Juan Pérez', rut: '11.111.111-1' }] });
    renderPage(<NuevaSolicitud />, { user: { id: 5, rol: 'operador', nombre: 'Operador' } });
    expect(await screen.findByText('Seleccionar trabajador')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Juan Pérez/ })).toBeInTheDocument();
  });
});
