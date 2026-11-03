import * as React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Phone, Tag, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import type { ResultRow } from '@/types';

// Fix default marker icon path issue with bundlers (Leaflet expects images relative to CSS)
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const INDONESIA_CENTER: [number, number] = [-2.5, 118];

function FitBounds({ points }: { points: ResultRow[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.latitude as number, p.longitude as number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [points, map]);
  return null;
}

export function ResultsMap({ taskId }: { taskId: string }) {
  const [points, setPoints] = React.useState<ResultRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Ambil semua hasil yang punya koordinat. Batasi 5000 titik per load
    // supaya map tetap ringan (brief: jangan render puluhan ribu marker
    // tanpa clustering) - clustering sendiri menangani sisanya di sisi client.
    api.getResults(taskId, { hasCoords: true, pageSize: 5000, page: 1 }).then((res) => {
      setPoints(res.rows);
      setLoading(false);
    });
  }, [taskId]);

  if (loading) {
    return <div className="flex h-[520px] items-center justify-center text-sm text-[var(--color-text-muted)]">Memuat peta...</div>;
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[520px] flex-col items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
        <MapPin className="h-6 w-6" />
        Belum ada hasil dengan koordinat untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="h-[520px] overflow-hidden rounded-lg border border-[var(--color-border)]">
      <MapContainer center={INDONESIA_CENTER} zoom={5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        <MarkerClusterGroup chunkedLoading>
          {points.map((p) => (
            <Marker key={p.id} position={[p.latitude as number, p.longitude as number]} icon={markerIcon}>
              <Popup>
                <div className="min-w-[180px] space-y-1">
                  <p className="text-sm font-semibold">{p.name}</p>
                  {p.category && (
                    <p className="flex items-center gap-1 text-xs text-gray-600">
                      <Tag className="h-3 w-3" /> {p.category}
                    </p>
                  )}
                  <p className="text-xs text-gray-600">{p.full_address}</p>
                  {p.phones && (
                    <p className="flex items-center gap-1 text-xs text-gray-600">
                      <Phone className="h-3 w-3" /> {p.phones}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-gray-400">
                    {p.latitude?.toFixed(5)}, {p.longitude?.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
