import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fresh module per test to reset module-level `routes` state
let defineRoute, navigate, startRouter;
beforeEach(async () => {
  vi.resetModules();
  const mod = await import('../router.js');
  defineRoute = mod.defineRoute;
  navigate = mod.navigate;
  startRouter = mod.startRouter;
  window.location.hash = '';
});

describe('navigate', () => {
  it('sets window.location.hash', () => {
    navigate('/home');
    expect(window.location.hash).toBe('#/home');
  });
});

describe('startRouter — route matching', () => {
  it('calls handler for the root route on startup', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    window.location.hash = '#/';
    defineRoute('/', handler);
    startRouter(document.createElement('div'));

    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
  });

  it('passes the app element to the handler', async () => {
    const appEl = document.createElement('div');
    const handler = vi.fn().mockResolvedValue(undefined);
    window.location.hash = '#/';
    defineRoute('/', handler);
    startRouter(appEl);

    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(appEl, {}));
  });

  it('extracts a single :param from the route', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    window.location.hash = '#/entry/abc123';
    defineRoute('/entry/:id', handler);
    startRouter(document.createElement('div'));

    await vi.waitFor(() =>
      expect(handler).toHaveBeenCalledWith(expect.anything(), { id: 'abc123' })
    );
  });

  it('extracts multiple params', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    window.location.hash = '#/users/u1/entries/e2';
    defineRoute('/users/:userId/entries/:entryId', handler);
    startRouter(document.createElement('div'));

    await vi.waitFor(() =>
      expect(handler).toHaveBeenCalledWith(expect.anything(), {
        userId: 'u1',
        entryId: 'e2',
      })
    );
  });

  it('does not call a handler for an unmatched route', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    window.location.hash = '#/other';
    defineRoute('/home', handler);
    startRouter(document.createElement('div'));

    // Give the async handler a chance to run
    await new Promise(r => setTimeout(r, 20));
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls the previous cleanup function before rendering a new route', async () => {
    const cleanup = vi.fn();
    const firstHandler = vi.fn().mockResolvedValue(cleanup);
    const secondHandler = vi.fn().mockResolvedValue(undefined);
    const appEl = document.createElement('div');

    window.location.hash = '#/';
    defineRoute('/', firstHandler);
    defineRoute('/new', secondHandler);
    startRouter(appEl);

    await vi.waitFor(() => expect(firstHandler).toHaveBeenCalled());

    // Navigate to /new — should trigger cleanup of first view
    window.location.hash = '#/new';
    window.dispatchEvent(new Event('hashchange'));

    await vi.waitFor(() => expect(cleanup).toHaveBeenCalled());
    await vi.waitFor(() => expect(secondHandler).toHaveBeenCalled());
  });
});
