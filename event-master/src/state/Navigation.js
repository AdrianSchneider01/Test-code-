import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';

// A small stack navigator. Keeps the app dependency-light and behaves the
// same on iOS, Android and web. Android's hardware back button pops the stack.
const NavContext = createContext(null);

let keySeq = 0;
const entry = (name, params = {}) => ({ name, params, key: `${name}-${++keySeq}` });

export function NavigationProvider({ initial = 'splash', children }) {
  const [stack, setStack] = useState([entry(initial)]);

  const navigate = useCallback((name, params) => setStack((s) => [...s, entry(name, params)]), []);
  const replace = useCallback((name, params) => setStack((s) => [...s.slice(0, -1), entry(name, params)]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const pop = useCallback((n = 1) => setStack((s) => s.slice(0, Math.max(1, s.length - n))), []);
  // reset('home') or reset([{ name: 'home' }, { name: 'party', params }])
  const reset = useCallback(
    (routes, params) =>
      setStack(Array.isArray(routes) ? routes.map((r) => entry(r.name, r.params)) : [entry(routes, params)]),
    [],
  );
  // Pop back to the nearest route with this name, or replace the stack with it.
  const backTo = useCallback(
    (name, params) =>
      setStack((s) => {
        for (let i = s.length - 1; i >= 0; i--) if (s[i].name === name) return s.slice(0, i + 1);
        return [entry(name, params)];
      }),
    [],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, back]);

  const value = useMemo(
    () => ({ route: stack[stack.length - 1], canGoBack: stack.length > 1, navigate, replace, back, pop, reset, backTo }),
    [stack, navigate, replace, back, pop, reset, backTo],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  return useContext(NavContext);
}
