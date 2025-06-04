import { useEffect, useState, useMemo } from 'react';
import api from '../api/axios';
import VMDetailModal from './VMDetailModal';

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
  const [filter, setFilter] = useState({
    name: '',
    environment: '',
    power_state: '',
    guest_os: ''
  });
  const [sortBy, setSortBy] = useState({ key: 'name', asc: true });
  const [groupByOption, setGroupByOption] = useState('none'); // 'none' | 'estado' | 'ambiente' | 'host' | 'vlan' | 'cluster'
  const [selectedVm, setSelectedVm] = useState(null);

  const fetchVm = async (params = {}) => {
    try {
      const { data } = await api.get('/vms', { params });
      setVms(data);
    } catch (err) {
      console.error('Error al obtener VMs:', err);
    }
  };

  useEffect(() => {
    fetchVm();
  }, []);

  const processed = useMemo(() => {
    let arr = [...vms];
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
    arr.sort((a, b) => {
      const va = a[sortBy.key];
      const vb = b[sortBy.key];
      if (va == null || vb == null) return 0;
      if (va < vb) return sortBy.asc ? -1 : 1;
      if (va > vb) return sortBy.asc ? 1 : -1;
      return 0;
    });
    return arr;
  }, [vms, filter, sortBy]);

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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Inventario de VMs</h2>
        <div className="h-1 w-32 bg-[#5da345] rounded-full"></div>
      </div>

      {/* Controles: filtros + agrupado */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Filtros y Agrupamiento</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* ... tus filtros existentes ... */}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
          {/* ... botón Aplicar Filtros ... */}
        </div>
      </div>

      {/* Tabla dividida en grupos */}
      {Object.entries(groups).map(([groupName, list]) => (
        <div key={groupName} className="mb-10 bg-white rounded-xl shadow-md overflow-hidden">
          {groupByOption !== 'none' && (
            <div className="bg-gray-800 px-6 py-4">
              <h3 className="text-xl font-bold text-white">{groupName}</h3>
            </div>
          )}
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full table-auto border-collapse">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  {[
                    { key: 'id',              label: 'ID'          },
                    { key: 'name',            label: 'Nombre'      },
                    { key: 'power_state',     label: 'Estado'      },
                    { key: 'cpu_count',       label: 'CPU'         },
                    { key: 'memory_size_MiB', label: 'RAM (MiB)'   },
                    { key: 'environment',     label: 'Ambiente'    },
                    { key: 'guest_os',        label: 'SO'          },
                    { key: 'host',            label: 'Host'        },
                    { key: 'cluster',         label: 'Cluster'     },
                    { key: 'networks',        label: 'VLAN(s)'     },
                    { key: 'compatibility_human', label: 'Compatibilidad HW' },
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{vm.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">{vm.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        vm.power_state === 'POWERED_ON' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {vm.power_state === 'POWERED_ON' ? 'Encendida' : 'Apagada'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vm.cpu_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vm.memory_size_MiB?.toLocaleString() || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <span className={`px-2 py-1 rounded text-xs ${
                        vm.environment === 'producción' 
                          ? 'bg-blue-100 text-blue-800' 
                          : vm.environment === 'test' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : vm.environment === 'desarrollo' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-purple-100 text-purple-800'
                      }`}>{vm.environment}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vm.guest_os || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vm.host || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vm.cluster || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {(vm.networks?.length > 0 ? vm.networks.join(', ') : '—')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {vm.compatibility_human || '—'}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-500">
                      No se encontraron VMs que cumplan los criterios seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Contador de resultados */}
      <div className="text-sm text-gray-600 mb-8">
        Mostrando {processed.length} de {vms.length} VMs
      </div>

      {/* Modal de detalle */}
      {selectedVm && (
        <VMDetailModal
          vmId={selectedVm}
          onClose={() => setSelectedVm(null)}
          onAction={() =>
            fetchVm({
              name: filter.name,
              environment: filter.environment,
              guest_os: filter.guest_os
            })
          }
        />
      )}
    </div>
  );
}
