import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/auth.store.js';
import toast from 'react-hot-toast';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Connexion réussie');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4">
            <ClipboardList className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Planning RH</h1>
          <p className="text-primary-200 mt-1">Hôtel-Restaurant</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Connexion</h2>

          <div className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@planning.local"
                required
              />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-6">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            Par défaut : admin@planning.local / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
