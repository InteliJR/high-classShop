import { getFrontendUrl, stripEnvQuotes } from './frontend-url';

describe('stripEnvQuotes', () => {
  it('strips matching double quotes', () => {
    expect(stripEnvQuotes('"https://bmfbrokerage.com"')).toBe(
      'https://bmfbrokerage.com',
    );
  });

  it('strips matching single quotes', () => {
    expect(stripEnvQuotes("'https://bmfbrokerage.com'")).toBe(
      'https://bmfbrokerage.com',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(stripEnvQuotes('  https://bmfbrokerage.com  ')).toBe(
      'https://bmfbrokerage.com',
    );
  });

  it('leaves unquoted values untouched', () => {
    expect(stripEnvQuotes('https://bmfbrokerage.com')).toBe(
      'https://bmfbrokerage.com',
    );
  });

  it('does not strip mismatched quotes', () => {
    expect(stripEnvQuotes('"https://bmfbrokerage.com\'')).toBe(
      '"https://bmfbrokerage.com\'',
    );
  });
});

describe('getFrontendUrl', () => {
  const original = process.env.FRONTEND_URL;
  afterEach(() => {
    process.env.FRONTEND_URL = original;
  });

  it('unwraps a quoted env value and strips trailing slash', () => {
    process.env.FRONTEND_URL = '"https://bmfbrokerage.com/"';
    expect(getFrontendUrl()).toBe('https://bmfbrokerage.com');
  });

  it('falls back to localhost when unset', () => {
    delete process.env.FRONTEND_URL;
    expect(getFrontendUrl()).toBe('http://localhost:5173');
  });
});
