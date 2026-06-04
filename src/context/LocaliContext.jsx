// ─── Position de l'utilisateur + chargement des commerces ─
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { reverseGeocode, geocodePlace } from '../utils/geo';
import { loadShops } from '../utils/overpass';
import { loadMarkets } from '../utils/markets';
import { fetchOpenAgenda, OPENAGENDA_ENABLED } from '../utils/openagenda';

const Ctx = createContext(null);
// Repli par défaut : Bassilly (Silly, Hainaut, Belgique)
const FALLBACK = { lat: 50.645, lon: 3.91, city: 'Bassilly, Silly (Belgique)' };

export function LocaliProvider({ children }) {
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [city, setCity] = useState('Détection en cours…');
  const [shops, setShops] = useState([]);
  // status : locating | loading | ready | error
  const [status, setStatus] = useState('locating');
  // geo : locating | real | fallback (origine de la position)
  const [geo, setGeo] = useState('locating');
  // Événements externes (OpenAgenda) à venir près de l'utilisateur
  const [extEvents, setExtEvents] = useState([]);
  // Marchés OSM chargés autour de la position (universel)
  const [osmMarkets, setOsmMarkets] = useState([]);

  const fetchShops = useCallback((la, lo) => {
    setStatus('loading');
    return loadShops(la, lo)
      .then((s) => { setShops(s); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const go = (la, lo) => {
      if (cancelled) return;
      setLat(la);
      setLon(lo);
      fetchShops(la, lo);
    };

    const fallback = () => {
      setGeo('fallback');
      setCity(FALLBACK.city);
      go(FALLBACK.lat, FALLBACK.lon);
    };

    // 1) Override de test via l'URL :
    //    ?lat=50.645&lon=3.91   ou   ?place=Bassilly
    const params = new URLSearchParams(window.location.search);
    const pLat = parseFloat(params.get('lat'));
    const pLon = parseFloat(params.get('lon'));
    const place = params.get('place');

    if (!isNaN(pLat) && !isNaN(pLon)) {
      setGeo('real');
      reverseGeocode(pLat, pLon).then((c) => { if (!cancelled) setCity(c + ' (test)'); }).catch(() => setCity('Position de test'));
      go(pLat, pLon);
      return () => { cancelled = true; };
    }
    if (place) {
      setCity('Recherche de « ' + place + ' »…');
      geocodePlace(place)
        .then((r) => { if (!cancelled) { setGeo('real'); setCity(r.label + ' (test)'); go(r.lat, r.lon); } })
        .catch(() => fallback());
      return () => { cancelled = true; };
    }

    // 2) Géolocalisation réelle du navigateur
    if (!navigator.geolocation) { fallback(); return; }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setGeo('real');
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        reverseGeocode(la, lo).then((c) => { if (!cancelled) setCity(c); }).catch(() => {});
        go(la, lo);
      },
      () => fallback(), // 3) Repli : Bassilly
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    return () => { cancelled = true; };
  }, [fetchShops]);

  // Marchés OSM autour de la position (rayon large, indépendant des commerces)
  useEffect(() => {
    if (lat == null) return;
    let cancelled = false;
    loadMarkets(lat, lon).then((mk) => { if (!cancelled) setOsmMarkets(mk); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lat, lon]);

  // Événements OpenAgenda (si configuré) autour de la position courante
  useEffect(() => {
    if (lat == null || !OPENAGENDA_ENABLED) return;
    let cancelled = false;
    fetchOpenAgenda(lat, lon).then((ev) => { if (!cancelled) setExtEvents(ev); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  const retry = useCallback(() => {
    if (lat != null) fetchShops(lat, lon);
  }, [lat, lon, fetchShops]);

  // Relancer la géolocalisation à la demande (bouton « Me localiser »)
  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeo('locating');
    setCity('Localisation…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude, lo = pos.coords.longitude;
        setGeo('real'); setLat(la); setLon(lo);
        reverseGeocode(la, lo).then(setCity).catch(() => {});
        fetchShops(la, lo);
      },
      () => { setGeo('fallback'); setCity(FALLBACK.city); setLat(FALLBACK.lat); setLon(FALLBACK.lon); fetchShops(FALLBACK.lat, FALLBACK.lon); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [fetchShops]);

  return (
    <Ctx.Provider value={{ lat, lon, city, shops, status, geo, extEvents, osmMarkets, retry, locate }}>{children}</Ctx.Provider>
  );
}

export const useLocali = () => useContext(Ctx);
