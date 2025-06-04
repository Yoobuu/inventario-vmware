import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../api/axios'

export default function VMDetailModal({ vmId, onClose, onAction }) {
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!vmId) return
    setLoading(true)
    setError('')
    api
      .get(`/vms/${vmId}`)
      .then(res => setDetail(res.data))
      .catch(() => setError('No se pudo cargar el detalle.'))
      .finally(() => setLoading(false))
  }, [vmId])

  if (!vmId) return null

  // Botón de acción con confirmación
  const actionButton = (text, color, apiPath) => (
    <button
      className={`flex-1 py-2 rounded font-medium text-white shadow transition hover:opacity-90 ${color}`}
      onClick={async () => {
        const name = detail?.name ?? vmId
        if (!window.confirm(`¿Estás seguro de ${text.toLowerCase()} la VM "${name}"?`)) return
        try {
          await api.post(`/vms/${vmId}/power/${apiPath}`)
          onAction()
          onClose()
        } catch {
          alert(`Error al intentar ${text.toLowerCase()}.`)
        }
      }}
    >
      {text}
    </button>
  )

  const content = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white text-gray-800 p-6 rounded-2xl shadow-xl max-w-md w-full relative">
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 transition text-xl"
        >
          ✕
        </button>

        {/* Título */}
        <h3 className="text-2xl font-semibold mb-4">Detalle VM {vmId}</h3>

        {/* Estado de carga y error */}
        {loading && <p className="text-center py-4">Cargando…</p>}
        {error && <p className="text-center text-red-600 mb-4">{error}</p>}

        {/* Contenido detalle */}
        {detail && (
          <div className="space-y-2 mb-6">
            {[
              ['Nombre:', detail.name],
              ['Estado:', detail.power_state],
              ['CPU:', detail.cpu_count],
              ['RAM:', `${detail.memory_size_MiB} MiB`],
              ['OS:', detail.guest_os],
              ['IPs:', detail.ip_addresses.join(', ') || '—'],
              ['Discos:', detail.disks.join(', ') || '—'],
              ['NICs:', detail.nics.join(', ') || '—'],
              ['Host:', detail.host || '—'],
              ['cluster:', detail.cluster || '—'],
              ['VLAN(s):', detail.networks.join(', ') || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-4">
          {actionButton('Encender', 'bg-green-500', 'start')}
          {actionButton('Apagar', 'bg-red-500', 'stop')}
          {actionButton('Reset', 'bg-yellow-500', 'reset')}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
