import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/utils';
import Pendientes from './Pendientes';

vi.mock('../../api', () => ({ default: { get: vi.fn() } }));
import api from '../../api';

describe('Pendientes (autorizador)', () => {
  it('lista solicitudes pendientes con items_count', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 3, solicitante_nombre: 'Ana', trabajador_nombre: 'Juan', fecha_solicitud: '2026-01-01', items_count: 2 },
    ] });
    renderPage(<Pendientes />);
    expect(await screen.findByText('Juan')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar' })).toBeInTheDocument();
  });
});
