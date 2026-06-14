import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

const MapBoundsUpdater = ({ originCoords, destCoords }) => {
  const map = useMap();
  React.useEffect(() => {
    if (originCoords && destCoords) {
      const bounds = L.latLngBounds([
        [parseFloat(originCoords.lat), parseFloat(originCoords.lon)],
        [parseFloat(destCoords.lat), parseFloat(destCoords.lon)]
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, originCoords, destCoords]);
  return null;
};

export default function WebMap({ originCoords, destCoords, routeCoordinates, trafficMarkers = [] }) {
  if (!originCoords || !destCoords) return null;

  const positions = routeCoordinates 
    ? routeCoordinates.map(c => [parseFloat(c.lat), parseFloat(c.lon)])
    : [
        [parseFloat(originCoords.lat), parseFloat(originCoords.lon)],
        [parseFloat(destCoords.lat), parseFloat(destCoords.lon)]
      ];

  const center = [
    (parseFloat(originCoords.lat) + parseFloat(destCoords.lat)) / 2,
    (parseFloat(originCoords.lon) + parseFloat(destCoords.lon)) / 2
  ] as L.LatLngExpression;

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ width: '100%', height: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[parseFloat(originCoords.lat), parseFloat(originCoords.lon)] as L.LatLngExpression} />
        <Marker position={[parseFloat(destCoords.lat), parseFloat(destCoords.lon)] as L.LatLngExpression} />
        <Polyline positions={positions as L.LatLngExpression[]} color="#FF2E93" weight={5} opacity={0.8} className="animated-route-path" />
        
        {trafficMarkers.map((marker, index) => (
          <CircleMarker 
            key={`traffic-${index}`}
            center={[parseFloat(marker.lat), parseFloat(marker.lon)] as L.LatLngExpression}
            radius={8}
            pathOptions={{
              color: marker.severity === 'heavy' ? '#FF3B30' : '#FF9500',
              fillColor: marker.severity === 'heavy' ? '#FF3B30' : '#FF9500',
              fillOpacity: 0.8,
              weight: 2
            }}
          />
        ))}

        <MapBoundsUpdater originCoords={originCoords} destCoords={destCoords} />
      </MapContainer>
    </div>
  );
}
