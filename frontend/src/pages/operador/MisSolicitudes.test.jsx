import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/utils';
import MisSolicitudes from './MisSolicitudes';

vi.mock('../../api', () => ({ default: { get: vi.fn() } }));
import api from '../../api';

describe('MisSolicitudes', () => {
  it('lista las solicitudes del usuario', async () => {
    api.get.mockResolvedValue({ data: [
      { id: 7, trabajador_nombre: 'Juan Pérez', fecha_solicitud: '2026-01-01', estado: 'pendiente' },
    ] });
    renderPage(<MisSolicitudes />);
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });
});
