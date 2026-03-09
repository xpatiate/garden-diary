const routes = {};
let currentCleanup = null;

export function defineRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function startRouter(appEl) {
  async function handleRoute() {
    if (currentCleanup) currentCleanup();

    const hash = window.location.hash.slice(1) || '/';
    // Match routes with params e.g. /entry/abc123
    let handler = null;
    let params = {};

    for (const [pattern, h] of Object.entries(routes)) {
      const paramNames = [];
      const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });
      const match = hash.match(new RegExp(`^${regexStr}$`));
      if (match) {
        handler = h;
        paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
        break;
      }
    }

    if (handler) {
      currentCleanup = await handler(appEl, params) || null;
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
