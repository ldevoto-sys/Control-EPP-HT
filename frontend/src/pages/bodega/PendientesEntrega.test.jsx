import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/utils';
import PendientesEntrega from './PendientesEntrega';

vi.mock('../../api', () => ({ default: { get: vi.fn() } }));
import api from '../../api';

describe('PendientesEntrega', () => {
  it('lista entregas pendientes con items_count y fecha_resolucion', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 4, trabajador_nombre: 'Juan', trabajador_rut: '11.111.111-1', fecha_resolucion: '2026-01-15', items_count: 3 },
    ] });
    renderPage(<PendientesEntrega />);
    expect(await screen.findByText('Juan')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar entrega' })).toBeInTheDocument();
  });
});
