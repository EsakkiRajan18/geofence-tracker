import { format } from 'date-fns'
import { Bell } from 'lucide-react'

export default function AlertFeed({ alerts }) {
  return (
    <div className="flex flex-col border-t border-gray-200 overflow-hidden flex-1">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Bell size={11} /> Live Alerts
        </p>
        {alerts.length > 0 && (
          <span className="text-xs bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {alerts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-4 px-2">
            No alerts yet. Configure alert rules to see real-time notifications here.
          </p>
        ) : (
          alerts.slice(0, 20).map((a, i) => {
            const isEntry = a.event_type === 'entry'
            return (
              <div
                key={i}
                className={`rounded-lg p-2.5 text-xs ${
                  isEntry
                    ? 'bg-green-50 border border-green-100'
                    : 'bg-red-50 border border-red-100'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-semibold ${isEntry ? 'text-green-800' : 'text-red-800'}`}>
                    {isEntry ? '↘ Entry' : '↗ Exit'}
                  </span>
                  <span className="text-gray-400 text-[10px]">
                    {format(new Date(a.timestamp), 'HH:mm:ss')}
                  </span>
                </div>
                <p className={`font-medium truncate ${isEntry ? 'text-green-900' : 'text-red-900'}`}>
                  {a.vehicle.vehicle_number}
                </p>
                <p className={`truncate ${isEntry ? 'text-green-700' : 'text-red-700'} opacity-80`}>
                  {a.geofence.geofence_name}
                </p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
