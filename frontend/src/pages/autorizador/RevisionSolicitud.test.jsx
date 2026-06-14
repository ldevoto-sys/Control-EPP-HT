import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/utils';
import RevisionSolicitud from './RevisionSolicitud';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../api';

describe('RevisionSolicitud', () => {
  it('muestra los items con stock_disponible', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/solicitudes/5') {
        return Promise.resolve({ data: {
          id: 5, estado: 'pendiente', solicitante_id: 2,
          solicitante_nombre: 'Ana', trabajador_nombre: 'Juan',
          items: [{ epp_nombre: 'Casco', cantidad: 1, motivo: 'primera_entrega', stock_disponible: 9 }],
        } });
      }
      if (url === '/solicitudes/5/historial') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    renderPage(<RevisionSolicitud />, {
      user: { id: 1, rol: 'administrador' },
      path: '/solicitudes/:id',
      route: '/solicitudes/5',
    });

    expect(await screen.findByText('Casco')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('Solicitud #5')).toBeInTheDocument();
  });
});
