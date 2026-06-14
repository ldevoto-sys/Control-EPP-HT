import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/utils';
import RegistrarEntrega from './RegistrarEntrega';

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../api';

describe('RegistrarEntrega', () => {
  it('carga la solicitud y muestra sus items', async () => {
    api.get.mockResolvedValue({ data: {
      id: 5, trabajador_nombre: 'Juan Pérez', trabajador_rut: '11.111.111-1',
      items: [{ epp_id: 10, epp_nombre: 'Casco', cantidad: 2 }],
    } });

    renderPage(<RegistrarEntrega />, { path: '/entregas/:id', route: '/entregas/5' });
    expect(await screen.findByText('Casco')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
  });
});
