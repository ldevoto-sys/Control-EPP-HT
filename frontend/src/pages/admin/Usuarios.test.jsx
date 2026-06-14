import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/utils';
import Usuarios from './Usuarios';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';

describe('Usuarios', () => {
  it('lista usuarios y filtra por texto', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, nombre: 'Ana Soto', rut: '11.111.111-1', email: 'ana@ht.cl', rol: 'operador', activo: 1 },
      { id: 2, nombre: 'Beto Díaz', rut: '22.222.222-2', email: 'beto@ht.cl', rol: 'bodega', activo: 1 },
    ] });

    renderPage(<Usuarios />);
    expect(await screen.findByText('Ana Soto')).toBeInTheDocument();
    expect(screen.getByText('Beto Díaz')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/Buscar nombre/), 'Ana');
    expect(screen.getByText('Ana Soto')).toBeInTheDocument();
    expect(screen.queryByText('Beto Díaz')).not.toBeInTheDocument();
  });
});
