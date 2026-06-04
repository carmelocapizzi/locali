// Aiguillage : tant qu'on n'est pas connecté -> écran de connexion.
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Shell from './components/Shell';

export default function App() {
  const { user } = useAuth();
  return user ? <Shell /> : <Login />;
}
