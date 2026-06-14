import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../test/utils';
import ForgotPassword from './ForgotPassword';

vi.mock('../api', () => ({ default: { post: vi.fn().mockResolvedValue({ data: {} }) } }));

describe('ForgotPassword', () => {
  it('muestra confirmación tras enviar', async () => {
    renderPage(<ForgotPassword />);
    await userEvent.type(screen.getByPlaceholderText('usuario@hidrotecnica.cl'), 'a@b.cl');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar instrucciones' }));
    expect(await screen.findByText(/Si el correo está registrado/)).toBeInTheDocument();
  });
});
