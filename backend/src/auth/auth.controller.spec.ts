import { AuthController } from './auth.controller';

describe('AuthController.registerSpecialist — auto-login', () => {
  it('seta o cookie de refresh token e retorna o access_token', async () => {
    const authService = {
      registerSpecialist: jest.fn().mockResolvedValue({
        user: { id: 'u1' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    } as any;
    const controller = new AuthController(authService);
    const response = { cookie: jest.fn() } as any;

    const result = await controller.registerSpecialist({} as any, response);

    expect(response.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh-token',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result.data.access_token).toBe('access-token');
    expect(result.data.user).toEqual({ id: 'u1' });
  });
});
