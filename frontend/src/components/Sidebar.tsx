import { useNavigate } from 'react-router-dom';
import { Home, Building2, Users, Briefcase } from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="w-20 bg-black h-screen flex flex-col items-center py-8 gap-8">
      {/* Logo/Home Icon */}
      <button
        onClick={() => navigate('/admin/dashboard')}
        className="p-3 rounded-lg hover:bg-gray-800 transition-colors"
        title="Home"
      >
        <Home size={24} className="text-white" />
      </button>

      {/* Escritórios (Companies) */}
      <button
        onClick={() => navigate('/admin/companies')}
        className="p-3 rounded-lg hover:bg-gray-800 transition-colors"
        title="Escritórios"
      >
        <Building2 size={24} className="text-white" />
      </button>

      {/* Assessores (Consultants) */}
      <button
        onClick={() => navigate('/admin/consultants')}
        className="p-3 rounded-lg hover:bg-gray-800 transition-colors"
        title="Assessores"
      >
        <Users size={24} className="text-white" />
      </button>

      {/* Especialistas (Specialists) */}
      <button
        onClick={() => navigate('/admin/specialists')}
        className="p-3 rounded-lg hover:bg-gray-800 transition-colors"
        title="Especialistas"
      >
        <Briefcase size={24} className="text-white" />
      </button>
    </aside>
  );
}

