import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/utils';
import EntregaDirecta from './EntregaDirecta';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../api';

describe('EntregaDirecta', () => {
  it('renderiza el formulario con trabajadores y catálogo', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/users/trabajadores') return Promise.resolve({ data: [{ id: 1, nombre: 'Juan Pérez', rut: '11.111.111-1' }] });
      if (url === '/epp') return Promise.resolve({ data: [{ id: 10, nombre: 'Casco' }] });
      return Promise.resolve({ data: [] });
    });

    renderPage(<EntregaDirecta />);
    expect(screen.getByText('Entrega Directa de EPP')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Juan Pérez/ })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Casco' })).toBeInTheDocument();
  });
});
