import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../test/utils';
import Login from './Login';

vi.mock('../api', () => ({ default: { post: vi.fn() } }));

describe('Login', () => {
  it('renderiza el formulario de ingreso', () => {
    renderPage(<Login />);
    expect(screen.getByText('Control de EPP')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('usuario@hidrotecnica.cl')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });
});
