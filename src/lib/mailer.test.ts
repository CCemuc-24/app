import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMailSpy = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
const createTransportSpy = vi.fn(() => ({ sendMail: sendMailSpy }));

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportSpy },
}));

describe('sendMail', () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_HOST = 'smtp.example.com';
    process.env.EMAIL_PORT = '465';
    process.env.EMAIL_USER = 'admin@example.com';
    process.env.EMAIL_PASS = 'secret';
    process.env.EMAIL_FROM = 'CCemuc <no-reply@example.com>';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('builds an SMTP transport from env (host, numeric port, secure, auth)', async () => {
    const { sendMail } = await import('./mailer');
    await sendMail('student@uc.cl', 'Confirmación', '<p>Hola</p>');
    expect(createTransportSpy).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'admin@example.com', pass: 'secret' },
    });
  });

  it('sends with from/to/subject and HTML body', async () => {
    const { sendMail } = await import('./mailer');
    await sendMail('student@uc.cl', 'Confirmación', '<p>Hola</p>');
    expect(sendMailSpy).toHaveBeenCalledWith({
      from: 'CCemuc <no-reply@example.com>',
      to: 'student@uc.cl',
      subject: 'Confirmación',
      html: '<p>Hola</p>',
    });
  });

  it('propagates transport errors', async () => {
    sendMailSpy.mockRejectedValueOnce(new Error('SMTP refused'));
    const { sendMail } = await import('./mailer');
    await expect(sendMail('x@y.cl', 's', '<p>h</p>')).rejects.toThrow('SMTP refused');
  });
});
