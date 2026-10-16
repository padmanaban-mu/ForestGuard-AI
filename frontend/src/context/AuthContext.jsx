import { createContext, useContext, useMemo, useState } from 'react';
import { readLocal, writeLocal } from '../utils/storage.js';
import { recordAudit } from '../services/audit.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => readLocal('forestguard:role', null));
  const login = (nextRole) => {
    if (!['Admin', 'Forest Officer'].includes(nextRole)) return;
    setRole(nextRole); writeLocal('forestguard:role', nextRole);
    recordAudit({ user: nextRole, role: nextRole, action: 'Demo login', module: 'Authentication', details: 'Mock role selection; not secure authentication.' });
  };
  const logout = () => {
    if (role) recordAudit({ user: role, role, action: 'Demo logout', module: 'Authentication' });
    setRole(null); writeLocal('forestguard:role', null);
  };
  const value = useMemo(() => ({ role, user: role || 'Guest', login, logout, isAuthenticated: Boolean(role) }), [role]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
