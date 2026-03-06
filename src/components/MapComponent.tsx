"use client";
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";

interface MapComponentProps {
    colleges: any[];
    selectedCollege: string | null;
    setSelectedCollege: (id: string | null) => void;
    mapRef: any;
}

export default function MapComponent({ colleges, selectedCollege, setSelectedCollege, mapRef }: MapComponentProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className="w-full h-full bg-zinc-950 animate-pulse" />;

    return (
        <MapContainer
            center={[22.9734, 78.6569]}
            zoom={5}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
            ref={mapRef}
        >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
            <ZoomControl position="bottomright" />
            {colleges.map((c) => (
                <Marker
                    key={c.id}
                    position={[c.lat, c.lng]}
                    icon={L.divIcon({
                        className: "custom-marker",
                        html: `<div class="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center animate-pulse"><div class="w-2 h-2 rounded-full bg-primary"></div></div>`,
                        iconSize: [32, 32]
                    })}
                    eventHandlers={{ click: () => setSelectedCollege(c.id) }}
                >
                    <Popup className="custom-popup">
                        <div className="p-3 bg-zinc-900 text-white rounded-lg border border-zinc-800 space-y-2">
                            <h3 className="font-bold text-sm text-primary">{c.shortName}</h3>
                            <p className="text-[10px] text-zinc-400 leading-tight">{c.address}</p>
                            <div className="flex gap-2">
                                <span className="text-[9px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 font-mono">Lat: {c.lat}</span>
                                <span className="text-[9px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 font-mono">Lng: {c.lng}</span>
                            </div>
                        </div>
                    </Popup>
                    <Circle center={[c.lat, c.lng]} radius={c.radiusKm * 1000} pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.1, weight: 1 }} />
                </Marker>
            ))}
        </MapContainer>
    );
}
