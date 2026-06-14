import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Stock from './Stock';

vi.mock('../../api', () => ({ default: { get: vi.fn() } }));
import api from '../../api';

describe('Stock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra epp_nombre y, al hacer clic, los movimientos (objeto {epp, movimientos}) sin crashear', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/stock') {
        return Promise.resolve({ data: [
          { epp_id: 1, epp_nombre: 'Casco', categoria: 'Cabeza', unidad: 'unidad', stock_actual: 5, stock_minimo: 1 },
        ] });
      }
      if (url === '/stock/1/movimientos') {
        return Promise.resolve({ data: {
          epp: { id: 1, nombre: 'Casco' },
          movimientos: [
            { tipo: 'ingreso', cantidad: 5, stock_resultante: 5, fecha: '2026-01-01', usuario_nombre: 'Admin', referencia: 'F1' },
          ],
        } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<Stock />);
    expect(await screen.findByText('Casco')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Casco'));
    // El movimiento se renderiza (usuario_nombre, no usuario)
    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('ingreso')).toBeInTheDocument();
  });

  it('no crashea cuando movimientos viene vacío', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/stock') {
        return Promise.resolve({ data: [
          { epp_id: 2, epp_nombre: 'Guante', categoria: 'Manos', unidad: 'par', stock_actual: 0, stock_minimo: 2 },
        ] });
      }
      return Promise.resolve({ data: { epp: {}, movimientos: [] } });
    });

    render(<Stock />);
    fireEvent.click(await screen.findByText('Guante'));
    expect(await screen.findByText('Sin movimientos')).toBeInTheDocument();
  });
});
