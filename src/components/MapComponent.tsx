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
    employees: any[];
}

export default function MapComponent({ colleges, selectedCollege, setSelectedCollege, mapRef, employees }: MapComponentProps) {
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
            {colleges.map((c) => {
                const campusEmployees = employees.filter(e => e.location === c.id);
                const empCount = campusEmployees.length;

                return (
                    <Marker
                        key={c.id}
                        position={[c.lat, c.lng]}
                        icon={L.divIcon({
                            className: "custom-marker",
                            html: `
                                <div class="relative group">
                                    <div class="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center animate-pulse group-hover:bg-primary/40 transition-all">
                                        <div class="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                                    </div>
                                    ${empCount > 0 ? `<div class="absolute -top-1 -right-1 bg-white text-zinc-950 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-zinc-900 shadow-md group-hover:scale-110 transition-transform">${empCount}</div>` : ''}
                                </div>
                            `,
                            iconSize: [40, 40],
                            iconAnchor: [20, 20]
                        })}
                        eventHandlers={{ click: () => setSelectedCollege(c.id) }}
                    >
                        <Popup className="custom-popup">
                            <div className="p-4 bg-zinc-900 text-white rounded-2xl border border-zinc-800 space-y-3 shadow-2xl min-w-[200px]">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-base text-primary leading-tight">{c.shortName}</h3>
                                    <p className="text-[10px] text-zinc-400 leading-tight">{c.address}</p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Assigned Reportees (${empCount})</h4>
                                    <div className="max-h-32 overflow-y-auto pr-1 flex flex-wrap gap-1">
                                        {empCount > 0 ? campusEmployees.map(e => (
                                            <div key={e.id} className="bg-zinc-800/80 px-2 py-1 rounded-lg text-[10px] border border-zinc-700/50 text-zinc-300">
                                                ${e.name}
                                            </div>
                                        )) : <p className="text-[10px] text-zinc-600 italic">No employees assigned</p>}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                                    <span className="text-[9px] bg-zinc-950 px-2 py-1 rounded-lg text-zinc-500 font-mono">LAT: ${c.lat.toFixed(4)}</span>
                                    <span className="text-[9px] bg-zinc-950 px-2 py-1 rounded-lg text-zinc-500 font-mono">LNG: ${c.lng.toFixed(4)}</span>
                                </div>
                            </div>
                        </Popup>
                        <Circle center={[c.lat, c.lng]} radius={c.radiusKm * 1000} pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.05, weight: 1, dashArray: '5, 5' }} />
                    </Marker>
                );
            })}
        </MapContainer>
    );
}
