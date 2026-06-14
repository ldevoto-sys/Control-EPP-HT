import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/utils';
import CatalogoEpp from './CatalogoEpp';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import api from '../../api';

describe('CatalogoEpp', () => {
  it('lista los EPP del catálogo', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 1, nombre: 'Casco de Seguridad', categoria: 'Cabeza', unidad: 'unidad', vida_util_meses: 48, stock_actual: 5, stock_minimo: 1, activo: 1 },
    ] });
    renderPage(<CatalogoEpp />);
    expect(await screen.findByText('Casco de Seguridad')).toBeInTheDocument();
    expect(screen.getByText('Eliminar')).toBeInTheDocument();
  });
});
