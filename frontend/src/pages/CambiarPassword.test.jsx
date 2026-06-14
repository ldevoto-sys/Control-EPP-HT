import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../test/utils';
import CambiarPassword from './CambiarPassword';

vi.mock('../api', () => ({ default: { post: vi.fn() } }));

describe('CambiarPassword', () => {
  it('renderiza y el botón está deshabilitado hasta cumplir requisitos', () => {
    renderPage(<CambiarPassword />, { user: { id: 1, nombre: 'X' } });
    expect(screen.getByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeDisabled();
  });
});
