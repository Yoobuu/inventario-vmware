import { useEffect, useState, useMemo } from 'react';
import api from '../api/axios';
import VMDetailModal from './VMDetailModal';
// Importamos íconos para los badges
import { IoPowerSharp, IoPowerOutline } from 'react-icons/io5';
import {
  FaServer,
  FaFlask,
  FaCodeBranch,
  FaQuestionCircle,
  FaWindows,
  FaLinux
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingThreeDotsJumping from './LoadingThreeDotsJumping';

// Variantes para el contenedor de cada grupo al desplegar/plegar
const groupVariants = {
  open: {
    opacity: 1,
    height: 'auto',
    transition: { duration: 0.3 }
  },
  collapsed: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.25 }
  }
};
// Helper para agrupar un array por una clave
function groupBy(array, keyFn) {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

export default function VMTable() {
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    name: '',
    environment: '',
    power_state: '',
    guest_os: '',
    host: '',
    cluster: ''
  });
  const handlePowerChange = (id, newState) => {
    setVms(old =>
      old.map(vm =>
        vm.id === id
          ? { ...vm, power_state: newState }
          : vm
      )
    );
  };
  const fetchVm = async (params = {}) => {
    setLoading(true);
    try {
      const { data } = await api.get('/vms', { params });
      setVms(data);
    } catch (err) {
      console.error('Error al obtener VMs:', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchVm();
  }, []);

  const [sortBy, setSortBy] = useState({ key: 'name', asc: true });
  const [groupByOption, setGroupByOption] = useState('none'); // 'none' | 'estado' | 'ambiente' | 'host' | 'vlan' | 'cluster'
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedVm, setSelectedVm] = useState(null);

  

  const resumen = useMemo(() => {
  const total = vms.length;
  const encendidas = vms.filter(vm => vm.power_state === 'POWERED_ON').length;
  const apagadas = vms.filter(vm => vm.power_state === 'POWERED_OFF').length;

  const ambientes = vms.reduce((acc, vm) => {
    const env = vm.environment || 'Sin ambiente';
    acc[env] = (acc[env] || 0) + 1;
    return acc;
  }, {});



  return { total, encendidas, apagadas, ambientes };
}, [vms]);

  // Agrega estos useMemo para unidades únicas de filtro
  const uniqueEnvironments = useMemo(() => {
    return Array.from(
      new Set(vms.map(vm => vm.environment).filter(env => env))
    ).sort();
  }, [vms]);

  const uniquePowerStates = useMemo(() => {
    return Array.from(
      new Set(vms.map(vm => vm.power_state).filter(state => state))
    ).sort();
  }, [vms]);

  const uniqueGuestOS = useMemo(() => {
    return Array.from(
      new Set(vms.map(vm => vm.guest_os).filter(os => os))
    ).sort();
  }, [vms]);

  const uniqueHosts = useMemo(() => {
    return Array.from(
      new Set(vms.map(vm => vm.host).filter(host => host))
    ).sort();
  }, [vms]);

  const uniqueClusters = useMemo(() => {
    return Array.from(
      new Set(vms.map(vm => vm.cluster).filter(cluster => cluster))
    ).sort();
  }, [vms]);
  // --------------------------------------------------


  const processed = useMemo(() => {
    let arr = [...vms];
    if (globalSearch.trim() !== '') {
      const term = globalSearch.toLowerCase();
      arr = arr.filter(vm => {
        return (
          vm.name?.toLowerCase().includes(term) ||
          vm.guest_os?.toLowerCase().includes(term) ||
          vm.host?.toLowerCase().includes(term) ||
          vm.cluster?.toLowerCase().includes(term) ||
          vm.environment?.toLowerCase().includes(term)
        );
      });
    }  
    if (filter.name) {
      arr = arr.filter(vm =>
        vm.name.toLowerCase().includes(filter.name.toLowerCase())
      );
    }
    if (filter.environment) {
      arr = arr.filter(vm => vm.environment === filter.environment);
    }
    if (filter.power_state) {
      arr = arr.filter(vm => vm.power_state === filter.power_state);
    }
    if (filter.guest_os) {
      arr = arr.filter(vm =>
        vm.guest_os?.toLowerCase().includes(filter.guest_os.toLowerCase())
      );
    }
    // 3) Filtro por Host (si se eligió uno)
    if (filter.host) {
      arr = arr.filter(vm => vm.host === filter.host);
    }

    // 4) Filtro por Cluster (si se eligió uno)
    if (filter.cluster) {
      arr = arr.filter(vm => vm.cluster === filter.cluster);
    }
    arr.sort((a, b) => {
      const va = a[sortBy.key];
      const vb = b[sortBy.key];
      if (va == null || vb == null) return 0;
      if (va < vb) return sortBy.asc ? -1 : 1;
      if (va > vb) return sortBy.asc ? 1 : -1;
      return 0;
    });
    return arr;
  }, [vms, filter, sortBy, globalSearch]);

  const groups = useMemo(() => {
    if (groupByOption === 'none') {
      return { '': processed };
    }
    if (groupByOption === 'estado') {
      return groupBy(processed, vm => vm.power_state);
    }
    if (groupByOption === 'ambiente') {
      return groupBy(processed, vm => vm.environment);
    }
    if (groupByOption === 'host') {
      return groupBy(processed, vm => vm.host || 'Sin Host');
    }
    if (groupByOption === 'vlan') {
      return groupBy(
        processed,
        vm => (vm.networks?.length > 0 ? vm.networks.join(', ') : 'Sin VLAN'));
    }
    if (groupByOption === 'cluster') {
      return groupBy(processed, vm => vm.cluster || 'Sin Cluster');
    }
    if (groupByOption === 'SO') {
      return groupBy(processed, vm => vm.guest_os || 'Sin SO');
    }
    return { '': processed };
  }, [processed, groupByOption]);

  const onHeaderClick = key =>
    setSortBy(s =>
      s.key === key
        ? { key, asc: !s.asc }
        : { key, asc: true }
    );
 // Función auxiliar que recibe un nombre de archivo y un contenido CSV, y dispara la descarga
  const downloadFile = (filename, content) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Función que convierte el arreglo `processed` en un CSV y lo descarga
const exportToCsv = () => {
  if (processed.length === 0) {
    // Si no hay datos, no hacemos nada
    return;
  }

  // 1) Definir encabezados en el orden que usa tu tabla
  const headers = [
    'ID',
    'Nombre',
    'Estado',
    'CPU',
    'RAM (MiB)',
    'Ambiente',
    'SO',
    'Host',
    'Cluster',
    'VLAN(s)',
    'IPs',           // ← nuevo
    'Discos',        // ← nuevo
    'NICs',          // ← nuevo
    'Compatibilidad HW'
  ];

  // 2) Mapear cada VM de `processed` a una fila de datos
  const rows = processed.map(vm => {
    const estado    = vm.power_state === 'POWERED_ON' ? 'Encendida' : 'Apagada';
    const ram       = vm.memory_size_MiB != null ? vm.memory_size_MiB.toLocaleString() : '';
    const ambiente  = vm.environment || '';
    const so        = vm.guest_os || '';
    const host      = vm.host || '';
    const cluster   = vm.cluster || '';
    // Usamos punto y coma para separar cada lista, evitando comas dentro del CSV
    const vlans     = vm.networks?.length ? vm.networks.join(';') : '';
    const ips       = vm.ip_addresses?.length ? vm.ip_addresses.join(';') : '';
    const disks     = vm.disks?.length        ? vm.disks.join(';')        : '';
    const nics      = vm.nics?.length         ? vm.nics.join(';')         : '';
    const compat    = vm.compatibility_human || '';

    return [
      vm.id,
      vm.name,
      estado,
      vm.cpu_count,
      ram,
      ambiente,
      so,
      host,
      cluster,
      vlans,
      ips,     // ← nuevo
      disks,   // ← nuevo
      nics,    // ← nuevo
      compat
    ];
  });

  // 3) Construir el contenido CSV: encabezado + filas
  const csvContent = [
    headers.join(','),            // línea de encabezados
    ...rows.map(r => r.join(',')) // cada fila de datos
  ].join('\r\n');

  // 4) Generar un nombre de archivo con timestamp para que sea único
  const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
  downloadFile(`inventario_vms_${timestamp}.csv`, csvContent);
};
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = groupName => {
  setCollapsedGroups(prev => ({
    ...prev,
    [groupName]: !prev[groupName]
  }));
};

  return (
  <div className="p-6 bg-gray-50 min-h-screen">
    {/* === Bloque de título + botón Exportar CSV === */}
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Inventario de VMs</h2>
        <div className="h-1 w-32 bg-[#5da345] rounded-full"></div>
      </div>
      <button
        onClick={exportToCsv}
        className="bg-[#5da345] text-white font-medium py-2 px-4 rounded-lg shadow hover:bg-[#4c8c38] transition"
      >
        Exportar CSV
      </button>
    </div>

    {/* === Resumen de VMs === */}
    <div className="flex flex-wrap justify-start gap-4 mb-6">
      <div className="bg-white rounded-xl shadow p-4 flex items-center gap-4 flex-1 min-w-[200px] max-w-[300px]">
        <div className="text-3xl text-gray-600">📦</div>
        <div>
          <h4 className="text-sm text-gray-500">Total de VMs</h4>
          <p className="text-2xl font-bold text-gray-800">{resumen.total}</p>
        </div>
      </div>
      <div className="bg-green-100 rounded-xl shadow p-4 flex items-center gap-4 flex-1 min-w-[200px] max-w-[300px]">
        <div className="text-3xl text-green-700">⚡</div>
        <div>
          <h4 className="text-sm text-green-700">Encendidas</h4>
          <p className="text-2xl font-bold text-green-800">{resumen.encendidas}</p>
        </div>
      </div>
      <div className="bg-red-100 rounded-xl shadow p-4 flex items-center gap-4 flex-1 min-w-[200px] max-w-[300px]">
        <div className="text-3xl text-red-700">⛔</div>
        <div>
          <h4 className="text-sm text-red-700">Apagadas</h4>
          <p className="text-2xl font-bold text-red-800">{resumen.apagadas}</p>
        </div>
      </div>
      <div className="bg-blue-50 rounded-xl shadow p-4 flex-1 min-w-[200px] max-w-[300px]">
        <h4 className="text-sm text-blue-700 mb-2">Por Ambiente</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          {Object.entries(resumen.ambientes).map(([amb, count]) => (
            <li key={amb} className="flex justify-between">
              <span>{amb}</span>
              <span className="font-semibold">{count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>

      {/* Campo de búsqueda global */}
      <div className="mb-6">
        <label htmlFor="global-search" className="block text-sm font-medium text-gray-700 mb-1">
          Búsqueda Global
        </label>
        <input
          id="global-search"
          type="text"
          placeholder="Buscar por Nombre, SO, Host, Cluster..."
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5da345] focus:outline-none"
        />
    </div>


      

      {/* Controles: filtros + agrupado */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Filtros y Agrupamiento</h3>

        {/* --- Primera fila de filtros dinámicos (Ambiente, Estado, SO) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Filtro: Ambiente */}
          <div>
            <label htmlFor="filter-environment" className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Ambiente
            </label>
            <select
              id="filter-environment"
              value={filter.environment}
              onChange={e => setFilter(f => ({ ...f, environment: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5da345] focus:outline-none"
            >
              <option value="">Todos</option>
              {uniqueEnvironments.map(env => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro: Estado (power_state) */}
          <div>
            <label htmlFor="filter-power_state" className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Estado
            </label>
            <select
              id="filter-power_state"
              value={filter.power_state}
              onChange={e => setFilter(f => ({ ...f, power_state: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5da345] focus:outline-none"
            >
              <option value="">Todos</option>
              {uniquePowerStates.map(state => (
                <option key={state} value={state}>
                  {state === 'POWERED_ON' ? 'Encendida' : state === 'POWERED_OFF' ? 'Apagada' : state}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro: SO (guest_os) */}
          <div>
            <label htmlFor="filter-guest_os" className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por SO
            </label>
            <select
              id="filter-guest_os"
              value={filter.guest_os}
              onChange={e => setFilter(f => ({ ...f, guest_os: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5da345] focus:outline-none"
            >
              <option value="">Todos</option>
              {uniqueGuestOS.map(os => (
                <option key={os} value={os}>
                  {os}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* --- Segunda fila de filtros opcionales (Host, Cluster, Botón limpiar) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Filtro: Host */}
          <div>
            <label htmlFor="filter-host" className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Host
            </label>
            <select
              id="filter-host"
              value={filter.host}
              onChange={e => setFilter(f => ({ ...f, host: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5da345] focus:outline-none"
            >
              <option value="">Todos</option>
              {uniqueHosts.map(h => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro: Cluster */}
          <div>
            <label htmlFor="filter-cluster" className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Cluster
            </label>
            <select
              id="filter-cluster"
              value={filter.cluster}
              onChange={e => setFilter(f => ({ ...f, cluster: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5da345] focus:outline-none"
            >
              <option value="">Todos</option>
              {uniqueClusters.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Botón: Limpiar filtros */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFilter({
                  name: '',
                  environment: '',
                  power_state: '',
                  guest_os: '',
                  host: '',
                  cluster: ''
                });
              }}
              className="w-full bg-red-100 text-red-700 font-medium py-2 px-4 rounded-lg hover:bg-red-200 transition"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* --- Bloque de Agrupamiento (queda igual) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agrupar por</label>
            <select
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5da345] focus:outline-none"
              value={groupByOption}
              onChange={e => setGroupByOption(e.target.value)}
            >
              <option value="none">Sin agrupar</option>
              <option value="estado">Agrupar por Estado</option>
              <option value="ambiente">Agrupar por Ambiente</option>
              <option value="host">Agrupar por Host</option>
              <option value="vlan">Agrupar por VLAN</option>
              <option value="cluster">Agrupar por Cluster</option>
              <option value="SO">Agrupar por SO</option>
            </select>
          </div>
          {/* Si tienes un botón “Aplicar filtros” colócalo aquí; si no, este bloque basta */}
        </div>
      </div>

      {/* Indicador de filtros activos */}
      {(globalSearch.trim() !== '' ||
        filter.environment ||
        filter.power_state ||
        filter.guest_os ||
        filter.host ||
        filter.cluster) && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Filtro: Búsqueda global */}
          {globalSearch.trim() !== '' && (
            <div className="flex items-center bg-gray-200 text-gray-700 text-sm px-3 py-1 rounded-full">
              <span>Búsqueda: “{globalSearch}”</span>
              <button
                onClick={() => setGlobalSearch('')}
                className="ml-2 text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filtro: Ambiente */}
          {filter.environment && (
            <div className="flex items-center bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
              <span>Ambiente: {filter.environment}</span>
              <button
                onClick={() => setFilter(f => ({ ...f, environment: '' }))}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filtro: Estado */}
          {filter.power_state && (
            <div className="flex items-center bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
              <span>
                Estado: {filter.power_state === 'POWERED_ON' ? 'Encendida' : 'Apagada'}
              </span>
              <button
                onClick={() => setFilter(f => ({ ...f, power_state: '' }))}
                className="ml-2 text-green-600 hover:text-green-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filtro: SO */}
          {filter.guest_os && (
            <div className="flex items-center bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full">
              <span>SO: {filter.guest_os}</span>
              <button
                onClick={() => setFilter(f => ({ ...f, guest_os: '' }))}
                className="ml-2 text-yellow-600 hover:text-yellow-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filtro: Host */}
          {filter.host && (
            <div className="flex items-center bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full">
              <span>Host: {filter.host}</span>
              <button
                onClick={() => setFilter(f => ({ ...f, host: '' }))}
                className="ml-2 text-purple-600 hover:text-purple-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filtro: Cluster */}
          {filter.cluster && (
            <div className="flex items-center bg-indigo-100 text-indigo-800 text-sm px-3 py-1 rounded-full">
              <span>Cluster: {filter.cluster}</span>
              <button
                onClick={() => setFilter(f => ({ ...f, cluster: '' }))}
                className="ml-2 text-indigo-600 hover:text-indigo-800"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}




      {/* Tabla dividida en grupos */}
      {loading ? (
        /* Si loading === true, mostramos el loader de 3 puntos */
        <div className="py-20 flex justify-center">
          <LoadingThreeDotsJumping />
        </div>
      ) : (
        /* Si loading === false, mostramos la tabla agrupada */
        <>
          {Object.entries(groups).map(([groupName, list]) => (
            <div key={groupName} className="mb-10 bg-white rounded-xl shadow-md overflow-hidden">
              {groupByOption !== 'none' && (
                <div
                  className="bg-gray-800 px-6 py-4 cursor-pointer select-none flex items-center justify-between"
                  onClick={() => toggleGroup(groupName)}
                >
                  <h3 className="text-xl font-bold text-white">{groupName}</h3>
                  <span className="text-white text-lg">
                    {collapsedGroups[groupName] ? '▶' : '▼'}
                  </span>
                </div>
              )}

              <AnimatePresence initial={false}>
                {!collapsedGroups[groupName] && (
                  <motion.div
                    key="content"
                    variants={groupVariants}
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    className="overflow-x-auto overflow-y-auto"
                    style={{ originY: 0 }}
                  >
                    <div className="max-h-[600px]">
                      <table className="w-full table-auto border-collapse">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                          <tr>
                            {[
                              { key: 'id', label: 'ID' },
                              { key: 'name', label: 'Nombre' },
                              { key: 'power_state', label: 'Estado' },
                              { key: 'cpu_count', label: 'CPU' },
                              { key: 'memory_size_MiB', label: 'RAM (MiB)' },
                              { key: 'environment', label: 'Ambiente' },
                              { key: 'guest_os', label: 'SO' },
                              { key: 'host', label: 'Host' },
                              { key: 'cluster', label: 'Cluster' },
                              { key: 'networks', label: 'VLAN(s)' },
                              { key: 'compatibility_human', label: 'Compatibilidad HW' },
                              { key: 'ip_addresses', label: 'IPs' },
                              { key: 'disks',        label: 'Discos' },
                              { key: 'nics',         label: 'NICs' },
                              
                            ].map(col => (
                              <th
                                key={col.key}
                                className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition"
                                onClick={() => onHeaderClick(col.key)}
                              >
                                <div className="flex items-center">
                                  {col.label}
                                  {sortBy.key === col.key ? (
                                    <span className="ml-1">{sortBy.asc ? '▲' : '▼'}</span>
                                  ) : (
                                    <span className="ml-1 text-gray-400">↕</span>
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {list.map(vm => (
                            <tr
                              key={vm.id}
                              className="odd:bg-white even:bg-gray-50 hover:bg-gray-50 cursor-pointer transition"
                              onClick={() => setSelectedVm(vm.id)}
                        >
                          {/* ID */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {vm.id}
                          </td>

                          {/* Nombre */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
                            {vm.name}
                          </td>

                          {/* Estado (con ícono + badge) */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {vm.power_state === 'POWERED_ON' ? (
                              <div className="flex items-center gap-1">
                                <IoPowerSharp className="text-green-600 text-lg" />
                                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                  Encendida
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <IoPowerOutline className="text-red-600 text-lg" />
                                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                  Apagada
                                </span>
                              </div>
                            )}
                          </td>

                          {/* CPU */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {vm.cpu_count}
                          </td>

                          {/* RAM */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {vm.memory_size_MiB?.toLocaleString() || '—'}
                          </td>

                          {/* Ambiente (con ícono + badge) */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {vm.environment === 'producción' ? (
                              <div className="flex items-center gap-1">
                                <FaServer className="text-blue-600 text-lg" />
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                  producción
                                </span>
                              </div>
                            ) : vm.environment === 'test' ? (
                              <div className="flex items-center gap-1">
                                <FaFlask className="text-yellow-600 text-lg" />
                                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                  test
                                </span>
                              </div>
                            ) : vm.environment === 'desarrollo' ? (
                              <div className="flex items-center gap-1">
                                <FaCodeBranch className="text-green-600 text-lg" />
                                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                  desarrollo
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <FaQuestionCircle className="text-purple-600 text-lg" />
                                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                                  {vm.environment || '–'}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* SO (con ícono Windows/Linux opcional) */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {vm.guest_os?.toLowerCase().includes('win') ? (
                              <div className="flex items-center gap-1">
                                <FaWindows className="text-blue-600 text-lg" />
                                <span className="text-gray-700">{vm.guest_os}</span>
                              </div>
                            ) : vm.guest_os?.toLowerCase().includes('linux') ? (
                              <div className="flex items-center gap-1">
                                <FaLinux className="text-gray-800 text-lg" />
                                <span className="text-gray-700">{vm.guest_os}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <FaQuestionCircle className="text-gray-600 text-lg" />
                                <span className="text-gray-700">{vm.guest_os || '—'}</span>
                              </div>
                            )}
                          </td>

                          {/* Host */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {vm.host || '—'}
                          </td>

                          {/* Cluster */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {vm.cluster || '—'}
                          </td>

                          {/* VLAN(s) */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {vm.networks?.length > 0 ? vm.networks.join(', ') : '—'}
                          </td>

                          {/* Compatibilidad HW */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {vm.compatibility_human || '—'}
                          </td>

                          {/* IPs */}
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {vm.ip_addresses?.length > 0
                              ? vm.ip_addresses.join(', ')
                              : '—'}
                          </td>

                          {/* Discos */}
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {vm.disks?.length > 0
                              ? vm.disks.join(', ')
                              : '—'}
                          </td>

                          {/* NICs */}
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {vm.nics?.length > 0
                              ? vm.nics.join(', ')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                      {list.length === 0 && (
                        <tr>
                          <td colSpan={10} className="text-center py-8 text-gray-500">
                            Error cargando datos de VMs
                           </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    ))}
  </>
)}

      {/* Contador de resultados */}
      <div className="text-sm text-gray-600 mb-8">
        Mostrando {processed.length} de {vms.length} VMs
        {globalSearch.trim() !== '' && (
          <span className="ml-2 text-gray-500">(filtradas por “{globalSearch}”)</span>
        )}
      </div>

      {/* Modal de detalle */}
      {selectedVm && (
        <VMDetailModal
          vmId={selectedVm}
          onClose={() => setSelectedVm(null)}
          onAction={apiPath => {
            // ➋ Calcula el nuevo estado
            const newState =
              apiPath === 'start' ? 'POWERED_ON' :
              apiPath === 'stop'  ? 'POWERED_OFF' :
                                    /* reset: lo dejamos igual */ '';
            // ➌ Actualiza SOLO esa VM en el listado
            handlePowerChange(selectedVm, newState);
            // ➍ Cierra el modal
            setSelectedVm(null);
          }}
        />
      )}
    </div>
  );
}
